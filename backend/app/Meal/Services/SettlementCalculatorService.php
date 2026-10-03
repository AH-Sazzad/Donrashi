<?php

namespace App\Meal\Services;

use App\Meal\Enums\MonthStatus;
use App\Models\MealBook;
use App\Models\MonthlySettlement;
use App\Models\MonthlySettlementMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SettlementCalculatorService
{
    public function __construct(private ActivityLogService $log) {}

    /**
     * Calculate (or recalculate) settlement for a given month.
     * Sets status to 'calculating', computes all values, then 'finalized'.
     * Throws if the month is already closed.
     */
    public function calculate(MonthlySettlement $settlement, User $manager): MonthlySettlement
    {
        if ($settlement->status === MonthStatus::Closed) {
            throw new \RuntimeException('Cannot recalculate a closed settlement.');
        }

        return DB::transaction(function () use ($settlement, $manager) {
            $mealBook  = $settlement->mealBook;
            $monthYear = $settlement->month_year;

            $settlement->update(['status' => MonthStatus::Calculating]);

            // ── Expenses ─────────────────────────────────────────────────────
            $expenses = $mealBook->expenses()->where('month_year', $monthYear)->get();

            $totalFood      = $expenses->where('category', 'food')->sum('amount');
            $totalUtility   = $expenses->where('category', 'utilities')->sum('amount');
            $totalOther     = $expenses->where('category', 'other')->sum('amount');

            // ── Meals ────────────────────────────────────────────────────────
            // All meal records for this month
            [$startDate, $endDate] = $this->monthBounds($monthYear);

            $mealRecords = $mealBook->mealRecords()
                ->with('mealType')
                ->whereBetween('date', [$startDate, $endDate])
                ->get();

            // Total weighted actual meals across all members (used for meal rate)
            $totalActualMeals = $mealRecords->sum(fn ($r) => $r->quantity * (float) $r->mealType->weight);

            // Meal rate = total food expense / total actual weighted meals
            $mealRate = $totalActualMeals > 0
                ? round($totalFood / $totalActualMeals, 4)
                : 0;

            $settlement->update([
                'total_food_expense'    => $totalFood,
                'total_utility_expense' => $totalUtility,
                'total_other_expense'   => $totalOther,
                'total_actual_meals'    => $totalActualMeals,
                'meal_rate'             => $mealRate,
            ]);

            // ── Per-member calculation ────────────────────────────────────────
            $memberIds = $mealBook->mealBookMembers()->pluck('user_id');
            $memberCount = $memberIds->count();

            foreach ($memberIds as $memberId) {
                $memberRecords = $mealRecords->where('member_id', $memberId);

                $actualMeals = $memberRecords->sum(fn ($r) => $r->quantity * (float) $r->mealType->weight);
                $billableMeals = max($actualMeals, $mealBook->min_billable_meals);
                $mealCost = round($billableMeals * $mealRate, 2);

                $utilityShare = $memberCount > 0 ? round($totalUtility / $memberCount, 2) : 0;
                $otherShare   = $memberCount > 0 ? round($totalOther / $memberCount, 2) : 0;
                $totalBill    = $mealCost + $utilityShare + $otherShare;

                // Approved deposits this member made this month
                $totalDeposited = $mealBook->deposits()
                    ->where('member_id', $memberId)
                    ->where('month_year', $monthYear)
                    ->where('status', 'approved')
                    ->sum('amount');

                $dueAmount = round($totalBill - $totalDeposited, 2);

                MonthlySettlementMember::updateOrCreate(
                    ['monthly_settlement_id' => $settlement->id, 'member_id' => $memberId],
                    [
                        'actual_meals'    => $actualMeals,
                        'billable_meals'  => $billableMeals,
                        'meal_cost'       => $mealCost,
                        'utility_share'   => $utilityShare,
                        'other_share'     => $otherShare,
                        'total_bill'      => $totalBill,
                        'total_deposited' => $totalDeposited,
                        'due_amount'      => $dueAmount,
                        'snapshots'       => [
                            'actual_meals'      => $actualMeals,
                            'min_billable'      => $mealBook->min_billable_meals,
                            'billable_meals'    => $billableMeals,
                            'meal_rate'         => $mealRate,
                            'meal_cost'         => $mealCost,
                            'utility_share'     => $utilityShare,
                            'other_share'       => $otherShare,
                            'total_bill'        => $totalBill,
                            'total_deposited'   => $totalDeposited,
                            'due_amount'        => $dueAmount,
                            'calculated_at'     => now()->toISOString(),
                        ],
                    ]
                );
            }

            $settlement->update([
                'status'       => MonthStatus::Finalized,
                'finalized_by' => $manager->id,
                'finalized_at' => now(),
            ]);

            $this->log->log(
                $mealBook, $manager,
                'settlement.calculated',
                "{$manager->name} calculated settlement for {$monthYear}. Meal rate: ৳{$mealRate}",
                $settlement
            );

            return $settlement->fresh()->load('memberSettlements.member');
        });
    }

    public function close(MonthlySettlement $settlement, User $manager): MonthlySettlement
    {
        if ($settlement->status !== MonthStatus::Finalized) {
            throw new \RuntimeException('Settlement must be finalized before closing.');
        }

        $settlement->update([
            'status'    => MonthStatus::Closed,
            'closed_by' => $manager->id,
            'closed_at' => now(),
        ]);

        $this->log->log(
            $settlement->mealBook, $manager,
            'settlement.closed',
            "{$manager->name} closed settlement for {$settlement->month_year}",
            $settlement
        );

        return $settlement->fresh();
    }

    private function monthBounds(string $monthYear): array
    {
        [$year, $month] = explode('-', $monthYear);
        $start = "{$year}-{$month}-01";
        $end   = date('Y-m-t', strtotime($start));
        return [$start, $end];
    }
}
