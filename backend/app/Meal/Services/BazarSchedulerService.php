<?php

namespace App\Meal\Services;

use App\Models\BazarSchedule;
use App\Models\BazarScheduleMember;
use App\Models\MealBook;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BazarSchedulerService
{
    public function __construct(private ActivityLogService $log) {}

    /**
     * Generate bazar schedules for a date range.
     *
     * Algorithm:
     *  1. Count each member's existing duty count in this meal book.
     *  2. Sort members by duty count ascending (fairness).
     *  3. Avoid repeating the exact same team as the previous schedule.
     *  4. Exclude members on leave on that date.
     *  5. Assign the team_size members with the lowest duty counts.
     */
    public function generate(
        MealBook $mealBook,
        array $dates,
        User $generatedBy
    ): Collection {
        return DB::transaction(function () use ($mealBook, $dates, $generatedBy) {
            $schedules = collect();
            $teamSize  = $mealBook->bazar_team_size;

            // Duty count map: user_id => count
            $dutyCounts = $this->buildDutyCounts($mealBook);

            // All active member ids
            $memberIds = $mealBook->mealBookMembers()->pluck('user_id')->toArray();

            $lastTeam = $this->getLastTeam($mealBook);

            foreach ($dates as $date) {
                $carbonDate = Carbon::parse($date);

                // Members on leave that day
                $onLeave = $mealBook->memberLeaves()
                    ->where('start_date', '<=', $carbonDate)
                    ->where('end_date', '>=', $carbonDate)
                    ->pluck('member_id')
                    ->toArray();

                $available = array_diff($memberIds, $onLeave);

                if (count($available) < $teamSize) {
                    // Not enough available members — skip or use all available
                    $team = $available;
                } else {
                    $team = $this->pickTeam($available, $dutyCounts, $lastTeam, $teamSize);
                }

                // Skip date if already scheduled
                if (BazarSchedule::where('meal_book_id', $mealBook->id)->where('date', $date)->exists()) {
                    continue;
                }

                $schedule = BazarSchedule::create([
                    'meal_book_id'      => $mealBook->id,
                    'date'              => $date,
                    'is_auto_generated' => true,
                    'generated_by'      => $generatedBy->id,
                ]);

                foreach ($team as $userId) {
                    BazarScheduleMember::create([
                        'bazar_schedule_id'       => $schedule->id,
                        'user_id'                 => $userId,
                        'duty_count_at_assignment' => $dutyCounts[$userId] ?? 0,
                    ]);
                    $dutyCounts[$userId] = ($dutyCounts[$userId] ?? 0) + 1;
                }

                $lastTeam = $team;
                $schedules->push($schedule->load('teamMembers.user'));
            }

            $this->log->log(
                $mealBook, $generatedBy,
                'bazar.scheduled',
                "{$generatedBy->name} generated bazar schedule for " . count($dates) . " dates",
            );

            return $schedules;
        });
    }

    private function buildDutyCounts(MealBook $mealBook): array
    {
        return BazarScheduleMember::whereHas(
            'schedule', fn ($q) => $q->where('meal_book_id', $mealBook->id)
        )
        ->select('user_id', DB::raw('count(*) as count'))
        ->groupBy('user_id')
        ->pluck('count', 'user_id')
        ->toArray();
    }

    private function getLastTeam(MealBook $mealBook): array
    {
        $last = BazarSchedule::where('meal_book_id', $mealBook->id)
            ->latest('date')
            ->first();

        return $last
            ? $last->teamMembers()->pluck('user_id')->toArray()
            : [];
    }

    private function pickTeam(array $available, array $dutyCounts, array $lastTeam, int $size): array
    {
        // Sort available members by duty count ascending
        usort($available, fn ($a, $b) => ($dutyCounts[$a] ?? 0) <=> ($dutyCounts[$b] ?? 0));

        // Try to avoid repeating the last exact team
        $candidates = $available;
        $team = array_slice($candidates, 0, $size);

        // If the team is identical to lastTeam and we have more candidates, rotate one
        if (
            count($lastTeam) === count($team)
            && empty(array_diff($team, $lastTeam))
            && count($available) > $size
        ) {
            // Replace last member of team with next candidate
            $team[$size - 1] = $candidates[$size];
        }

        return $team;
    }
}
