<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Models\GuestMeal;
use App\Models\MealBook;
use App\Models\MealType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuestMealController extends Controller
{
    /** GET /meal-books/{mealBook}/guest-meals */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        return response()->json(
            $mealBook->guestMeals()
                ->with(['mealType', 'recorder:id,name'])
                ->latest('date')
                ->get()
        );
    }

    /** POST /meal-books/{mealBook}/guest-meals */
    public function store(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $data = $request->validate([
            'meal_type_id' => ['required', 'integer', 'exists:meal_types,id'],
            'guest_name'   => ['nullable', 'string', 'max:255'],
            'date'         => ['required', 'date'],
            'quantity'     => ['nullable', 'integer', 'min:1', 'max:20'],
            'note'         => ['nullable', 'string'],
        ]);

        $mealType = MealType::where('meal_book_id', $mealBook->id)->findOrFail($data['meal_type_id']);

        $guestMeal = GuestMeal::create([
            ...$data,
            'meal_book_id' => $mealBook->id,
            'recorded_by'  => $request->user()->id,
            'meal_value'   => $mealType->weight, // snapshot weight at time of recording
            'quantity'     => $data['quantity'] ?? 1,
        ]);

        return response()->json($guestMeal->load(['mealType', 'recorder:id,name']), 201);
    }

    /** DELETE /meal-books/{mealBook}/guest-meals/{guestMeal} */
    public function destroy(Request $request, MealBook $mealBook, GuestMeal $guestMeal): JsonResponse
    {
        if ($guestMeal->meal_book_id !== $mealBook->id) abort(404);

        $canDelete = $guestMeal->recorded_by === $request->user()->id
            || $mealBook->isManager($request->user()->id);

        if (! $canDelete) abort(403);

        $guestMeal->delete();

        return response()->json(['message' => 'Guest meal deleted.']);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }
}
