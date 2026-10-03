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

    /** POST /meal-books/{mealBook}/settlements — open a new month */
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

    /** POST /meal-books/{mealBook}/settlements/{settlement}/calculate — manager */
    public function calculate(Request $request, MealBook $mealBook, MonthlySettlement $settlement): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($settlement->meal_book_id !== $mealBook->id) abort(404);

        $result = $this->calculator->calculate($settlement, $request->user());

        return response()->json($result);
    }

    /** POST /meal-books/{mealBook}/settlements/{settlement}/close — manager */
    public function close(Request $request, MealBook $mealBook, MonthlySettlement $settlement): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($settlement->meal_book_id !== $mealBook->id) abort(404);

        $result = $this->calculator->close($settlement, $request->user());

        return response()->json($result);
    }

    /** GET /meal-books/{mealBook}/settlements/my — authenticated member's own settlement summary */
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

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }

    private function requireManager(MealBook $book, int $userId): void
    {
        if (! $book->isManager($userId)) abort(403, 'Manager only.');
    }
}
