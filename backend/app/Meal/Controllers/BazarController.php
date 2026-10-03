<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Services\BazarSchedulerService;
use App\Models\BazarSchedule;
use App\Models\MealBook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BazarController extends Controller
{
    public function __construct(private BazarSchedulerService $scheduler) {}

    /** GET /meal-books/{mealBook}/bazar */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $request->validate([
            'from' => ['nullable', 'date'],
            'to'   => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $schedules = $mealBook->bazarSchedules()
            ->with(['teamMembers.user:id,name'])
            ->when($request->from, fn ($q) => $q->where('date', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->where('date', '<=', $request->to))
            ->orderBy('date')
            ->get();

        return response()->json($schedules);
    }

    /** POST /meal-books/{mealBook}/bazar/generate — manager */
    public function generate(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $data = $request->validate([
            'dates' => ['required', 'array', 'min:1'],
            'dates.*' => ['required', 'date'],
        ]);

        $schedules = $this->scheduler->generate($mealBook, $data['dates'], $request->user());

        return response()->json($schedules, 201);
    }

    /** GET /meal-books/{mealBook}/bazar/my-duties */
    public function myDuties(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $duties = BazarSchedule::where('meal_book_id', $mealBook->id)
            ->whereHas('teamMembers', fn ($q) => $q->where('user_id', $request->user()->id))
            ->with(['teamMembers.user:id,name'])
            ->orderBy('date', 'desc')
            ->get();

        return response()->json($duties);
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
