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
     * Calculate settlement with SEPARATE utility and meal dues.
     *
     * Business rules:
     * 1. UTILITY — split equally among ALL active registered members.
     *    Every member pays utility even if they took zero meals.
     *
     * 2. MEAL — food expense divided only among MEAL-ACTIVE members.
     *    A member deactivated from meal (is_meal_active=false for this month)
     *    pays zero meal cost. Their utility share is unchanged.
     *
     * 3. DEPOSIT ALLOCATION — total deposits are split proportionally:
     *    utility_paid = deposit × (utility_share / total_bill)
     *    meal_paid    = deposit × (meal_cost / total_bill)
     *    If no bill, all deposit goes to utility.
     *
     * 4. CREDIT — if paid > share, credit is recorded (not silently absorbed).
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

            // ── Expenses ──────────────────────────────────────────────────────
            $expenses     = $mealBook->expenses()->where('month_year', $monthYear)->get();
            $totalFood    = (float) $expenses->where('category', 'food')->sum('amount');
            $totalUtility = (float) $expenses->where('category', 'utilities')->sum('amount');
            $totalOther   = (float) $expenses->where('category', 'other')->sum('amount');

            // ── Members ───────────────────────────────────────────────────────
            // All registered (non-ghost) members = utility contributors
            $allMemberRows = $mealBook->mealBookMembers()
                ->whereNotNull('user_id')
                ->get();

            $totalMemberCount = $allMemberRows->count();

            // Meal-active members = those not deactivated for this month
            $mealActiveMembers = $allMemberRows->filter(
                fn ($m) => $m->is_meal_active || $m->meal_inactive_month !== $monthYear
            );
            $mealMemberCount = $mealActiveMembers->count();

            // ── Meal records (approved only) ──────────────────────────────────
            [$startDate, $endDate] = $this->monthBounds($monthYear);

            $mealRecords = $mealBook->mealRecords()
                ->with('mealType')
                ->where('status', 'approved')
                ->whereBetween('date', [$startDate, $endDate])
                ->get();

            // Total weighted meals across MEAL-ACTIVE members only
            $mealActiveMemberIds = $mealActiveMembers->pluck('user_id')->toArray();
            $totalActualMeals    = $mealRecords
                ->whereIn('member_id', $mealActiveMemberIds)
                ->sum(fn ($r) => $r->quantity * (float) $r->mealType->weight);

            // Meal rate = food / meals of active participants
            $mealRate = $totalActualMeals > 0
                ? round($totalFood / $totalActualMeals, 4)
                : 0;

            // ── Per-member bills ──────────────────────────────────────────────
            $utilityPerMember = $totalMemberCount > 0
                ? round($totalUtility / $totalMemberCount, 2)
                : 0;

            $otherPerMember = $totalMemberCount > 0
                ? round($totalOther / $totalMemberCount, 2)
                : 0;

            foreach ($allMemberRows as $memberRow) {
                $memberId   = $memberRow->user_id;
                $isMealActive = $memberRow->is_meal_active &&
                                $memberRow->meal_inactive_month !== $monthYear;

                // Meal calculation
                $memberMealRecords = $mealRecords->where('member_id', $memberId);
                $actualMeals = $isMealActive
                    ? $memberMealRecords->sum(fn ($r) => $r->quantity * (float) $r->mealType->weight)
                    : 0;

                // Meal cost — only for meal-active members
                $mealCost = $isMealActive ? round($actualMeals * $mealRate, 2) : 0.0;

                // Utility + other — ALL members pay regardless
                $utilityShare = $utilityPerMember;
                $otherShare   = $otherPerMember;

                $totalBill = $mealCost + $utilityShare + $otherShare;

                // Deposits for this member this month
                $totalDeposited = (float) $mealBook->deposits()
                    ->where('member_id', $memberId)
                    ->where('month_year', $monthYear)
                    ->where('status', 'approved')
                    ->sum('amount');

                // ── Payment allocation ────────────────────────────────────────
                // Split deposit proportionally between meal and utility
                if ($totalBill > 0) {
                    $mealFraction    = $totalBill > 0 ? $mealCost / $totalBill : 0;
                    $utilityFraction = $totalBill > 0 ? ($utilityShare + $otherShare) / $totalBill : 1;
                } else {
                    $mealFraction    = 0;
                    $utilityFraction = 1;
                }

                $mealPaid    = round($totalDeposited * $mealFraction, 2);
                $utilityPaid = round($totalDeposited * $utilityFraction, 2);

                // Due (positive = owes, negative = overpaid/credit)
                $mealDue    = round($mealCost - $mealPaid, 2);
                $utilityDue = round(($utilityShare + $otherShare) - $utilityPaid, 2);
                $dueAmount  = round($totalBill - $totalDeposited, 2);

                // Credit (overpayment stored separately, not silently absorbed)
                $mealCredit    = $mealDue < 0    ? abs($mealDue)    : 0;
                $utilityCredit = $utilityDue < 0 ? abs($utilityDue) : 0;
                // Clamp dues at 0 — actual due is non-negative; credit tracks the excess
                $mealDue    = max(0, $mealDue);
                $utilityDue = max(0, $utilityDue);

                MonthlySettlementMember::updateOrCreate(
                    ['monthly_settlement_id' => $settlement->id, 'member_id' => $memberId],
                    [
                        'is_meal_active'  => $isMealActive,
                        'actual_meals'    => $actualMeals,
                        'billable_meals'  => $actualMeals,   // no min-billable in this model
                        'meal_cost'       => $mealCost,
                        'utility_share'   => $utilityShare,
                        'other_share'     => $otherShare,
                        'total_bill'      => $totalBill,
                        'total_deposited' => $totalDeposited,
                        'due_amount'      => $dueAmount,
                        'meal_paid'       => $mealPaid,
                        'utility_paid'    => $utilityPaid,
                        'meal_due'        => $mealDue,
                        'utility_due'     => $utilityDue,
                        'meal_credit'     => $mealCredit,
                        'utility_credit'  => $utilityCredit,
                        'snapshots'       => [
                            'is_meal_active'   => $isMealActive,
                            'actual_meals'     => $actualMeals,
                            'meal_rate'        => $mealRate,
                            'meal_cost'        => $mealCost,
                            'utility_share'    => $utilityShare,
                            'other_share'      => $otherShare,
                            'total_bill'       => $totalBill,
                            'total_deposited'  => $totalDeposited,
                            'meal_paid'        => $mealPaid,
                            'utility_paid'     => $utilityPaid,
                            'meal_due'         => $mealDue,
                            'utility_due'      => $utilityDue,
                            'meal_credit'      => $mealCredit,
                            'utility_credit'   => $utilityCredit,
                            'due_amount'       => $dueAmount,
                            'meal_members'     => $mealMemberCount,
                            'total_members'    => $totalMemberCount,
                            'calculated_at'    => now()->toISOString(),
                        ],
                    ]
                );
            }

            $settlement->update([
                'total_food_expense'    => $totalFood,
                'total_utility_expense' => $totalUtility,
                'total_other_expense'   => $totalOther,
                'total_actual_meals'    => $totalActualMeals,
                'meal_rate'             => $mealRate,
                'status'                => MonthStatus::Finalized,
                'finalized_by'          => $manager->id,
                'finalized_at'          => now(),
            ]);

            $this->log->log(
                $mealBook, $manager,
                'settlement.calculated',
                "{$manager->name} calculated {$monthYear} settlement. " .
                "Meal rate: ৳{$mealRate}. Active meal members: {$mealMemberCount}/{$totalMemberCount}.",
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
