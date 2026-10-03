<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MealBook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /** GET /meal-books/{mealBook}/dashboard */
    public function show(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $user      = $request->user();
        $monthYear = $request->query('month_year', now()->format('Y-m'));
        [$startDate, $endDate] = $this->monthBounds($monthYear);

        // Wallet
        $wallet = $mealBook->wallet;

        // My meals this month
        $myMeals = $mealBook->mealRecords()
            ->with('mealType')
            ->where('member_id', $user->id)
            ->whereBetween('date', [$startDate, $endDate])
            ->get();

        $myActualMeals = $myMeals->sum(fn ($r) => $r->quantity * (float) $r->mealType->weight);

        // My approved deposits this month
        $myContribution = $mealBook->deposits()
            ->where('member_id', $user->id)
            ->where('month_year', $monthYear)
            ->where('status', 'approved')
            ->sum('amount');

        // Settlement for this month (if exists)
        $settlement = $mealBook->settlements()
            ->where('month_year', $monthYear)
            ->with(['memberSettlements' => fn ($q) => $q->where('member_id', $user->id)])
            ->first();

        $myDue = $settlement?->memberSettlements->first()?->due_amount ?? null;

        // Bazar schedule — upcoming 7 days
        $upcoming = $mealBook->bazarSchedules()
            ->with('teamMembers.user:id,name')
            ->where('date', '>=', now()->toDateString())
            ->where('date', '<=', now()->addDays(7)->toDateString())
            ->orderBy('date')
            ->get();

        // Recent expenses
        $recentExpenses = $mealBook->expenses()
            ->with('paidByUser:id,name')
            ->where('month_year', $monthYear)
            ->latest('expense_date')
            ->take(5)
            ->get();

        // Pending deposits
        $pendingDeposits = $mealBook->deposits()
            ->with('member:id,name')
            ->where('status', 'pending')
            ->latest()
            ->get();

        // Meal rate
        $mealRate = $settlement?->meal_rate ?? null;

        return response()->json([
            'month_year'      => $monthYear,
            'meal_book'       => $mealBook->only(['id', 'name', 'currency', 'min_billable_meals']),
            'my_role'         => $mealBook->mealBookMembers()->where('user_id', $user->id)->value('role'),
            'wallet'          => [
                'available_balance' => $wallet?->available_balance ?? 0,
                'pending_balance'   => $wallet?->pending_balance ?? 0,
                'expected_balance'  => $wallet?->expectedBalance() ?? 0,
            ],
            'my_meals'        => round($myActualMeals, 2),
            'my_contribution' => round((float) $myContribution, 2),
            'my_due'          => $myDue,
            'meal_rate'       => $mealRate,
            'upcoming_bazar'  => $upcoming,
            'recent_expenses' => $recentExpenses,
            'pending_deposits'=> $pendingDeposits,
        ]);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }

    private function monthBounds(string $monthYear): array
    {
        [$year, $month] = explode('-', $monthYear);
        return ["{$year}-{$month}-01", date('Y-m-t', strtotime("{$year}-{$month}-01"))];
    }
}
