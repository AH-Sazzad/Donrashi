<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Enums\MonthStatus;
use App\Meal\Services\SettlementCalculatorService;
use App\Models\MealBook;
use App\Models\MonthlySettlement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MonthlySettlementController extends Controller
{
    public function __construct(private SettlementCalculatorService $calculator) {}

    /** GET /meal-books/{mealBook}/settlements */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        return response()->json(
            $mealBook->settlements()
                ->with(['memberSettlements.member:id,name', 'finalizedByUser:id,name', 'closedByUser:id,name'])
                ->latest()
                ->get()
        );
    }

    /** GET /meal-books/{mealBook}/settlements/{settlement} */
    public function show(Request $request, MealBook $mealBook, MonthlySettlement $settlement): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);
        if ($settlement->meal_book_id !== $mealBook->id) abort(404);

        return response()->json(
            $settlement->load(['memberSettlements.member:id,name'])
        );
    }

    /** POST /meal-books/{mealBook}/settlements */
    public function store(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $data = $request->validate([
            'month_year' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        if (MonthlySettlement::where('meal_book_id', $mealBook->id)->where('month_year', $data['month_year'])->exists()) {
            abort(422, 'Settlement for this month already exists.');
        }

        $settlement = MonthlySettlement::create([
            'meal_book_id' => $mealBook->id,
            'month_year'   => $data['month_year'],
            'status'       => MonthStatus::Open,
        ]);

        return response()->json($settlement, 201);
    }

    /** POST /meal-books/{mealBook}/settlements/{settlement}/calculate */
    public function calculate(Request $request, MealBook $mealBook, MonthlySettlement $settlement): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($settlement->meal_book_id !== $mealBook->id) abort(404);

        return response()->json($this->calculator->calculate($settlement, $request->user()));
    }

    /** POST /meal-books/{mealBook}/settlements/{settlement}/close */
    public function close(Request $request, MealBook $mealBook, MonthlySettlement $settlement): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($settlement->meal_book_id !== $mealBook->id) abort(404);

        return response()->json($this->calculator->close($settlement, $request->user()));
    }

    /** GET /meal-books/{mealBook}/settlements/my */
    public function my(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $monthYear = $request->query('month_year', now()->format('Y-m'));

        $settlement = MonthlySettlement::where('meal_book_id', $mealBook->id)
            ->where('month_year', $monthYear)
            ->with(['memberSettlements' => fn ($q) => $q->where('member_id', $request->user()->id)])
            ->first();

        return response()->json($settlement);
    }

    /** GET /meal-books/{mealBook}/report?month_year= */
    public function report(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $monthYear = $request->query('month_year', now()->format('Y-m'));
        [$start, $end] = $this->monthBounds($monthYear);

        $settlement = MonthlySettlement::where('meal_book_id', $mealBook->id)
            ->where('month_year', $monthYear)
            ->with(['memberSettlements.member:id,name'])
            ->first();

        $expenses = $mealBook->expenses()
            ->where('month_year', $monthYear)
            ->with('paidByUser:id,name')
            ->get();

        $mealRecords = $mealBook->mealRecords()
            ->with(['member:id,name', 'mealType'])
            ->where('status', 'approved')
            ->whereBetween('date', [$start, $end])
            ->get();

        $members = $mealBook->mealBookMembers()->with('user:id,name')->get();
        $mealSummary = $members->map(function ($m) use ($mealRecords) {
            $records = $mealRecords->where('member_id', $m->user_id ?? -1);
            $total   = $records->sum(fn ($r) => $r->quantity * (float) $r->mealType->weight);
            return [
                'member_id'    => $m->id,
                'name'         => $m->user?->name ?? $m->ghost_name ?? "Member #{$m->id}",
                'is_ghost'     => $m->isGhost(),
                'actual_meals' => round($total, 2),
            ];
        });

        $bazar = $mealBook->bazarSchedules()
            ->with('teamMembers.user:id,name')
            ->whereBetween('date', [$start, $end])
            ->get();

        return response()->json([
            'month_year'   => $monthYear,
            'meal_book'    => $mealBook->only(['id', 'name', 'currency', 'min_billable_meals']),
            'settlement'   => $settlement,
            'expenses'     => $expenses,
            'meal_summary' => $mealSummary,
            'bazar'        => $bazar,
            'totals'       => [
                'food_expense'    => $expenses->where('category', 'food')->sum('amount'),
                'utility_expense' => $expenses->where('category', 'utilities')->sum('amount'),
                'other_expense'   => $expenses->where('category', 'other')->sum('amount'),
                'total_meals'     => round($mealRecords->sum(fn ($r) => $r->quantity * (float) $r->mealType->weight), 2),
                'meal_rate'       => $settlement?->meal_rate ?? 0,
            ],
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }

    private function requireManager(MealBook $book, int $userId): void
    {
        if (! $book->isManager($userId)) abort(403, 'Manager only.');
    }

    private function monthBounds(string $monthYear): array
    {
        [$year, $month] = explode('-', $monthYear);
        return ["{$year}-{$month}-01", date('Y-m-t', strtotime("{$year}-{$month}-01"))];
    }
}
