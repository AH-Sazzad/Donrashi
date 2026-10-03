<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MealBook;
use App\Models\MealType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MealTypeController extends Controller
{
    /** GET /meal-books/{mealBook}/meal-types */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);
        return response()->json($mealBook->mealTypes);
    }

    /** POST /meal-books/{mealBook}/meal-types — manager */
    public function store(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $data = $request->validate([
            'name'         => ['required', 'string', 'max:50'],
            'weight'       => ['required', 'numeric', 'min:0.1', 'max:10'],
            'is_special'   => ['nullable', 'boolean'],
            'cutoff_time'  => ['nullable', 'date_format:H:i'],
            'sort_order'   => ['nullable', 'integer', 'min:0'],
        ]);

        $type = MealType::create([...$data, 'meal_book_id' => $mealBook->id]);

        return response()->json($type, 201);
    }

    /** PUT /meal-books/{mealBook}/meal-types/{mealType} — manager */
    public function update(Request $request, MealBook $mealBook, MealType $mealType): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($mealType->meal_book_id !== $mealBook->id) abort(404);

        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:50'],
            'weight'      => ['sometimes', 'numeric', 'min:0.1', 'max:10'],
            'is_special'  => ['nullable', 'boolean'],
            'cutoff_time' => ['nullable', 'date_format:H:i'],
            'is_active'   => ['nullable', 'boolean'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        $mealType->update($data);

        return response()->json($mealType->fresh());
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
