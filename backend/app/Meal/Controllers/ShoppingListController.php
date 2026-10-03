<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MealBook;
use App\Models\ShoppingList;
use App\Models\ShoppingListItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShoppingListController extends Controller
{
    /** GET /meal-books/{mealBook}/shopping-list */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        return response()->json(
            $mealBook->shoppingLists()
                ->with(['items', 'creator:id,name'])
                ->latest('date')
                ->get()
        );
    }

    /** POST /meal-books/{mealBook}/shopping-list */
    public function store(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $data = $request->validate([
            'date'          => ['required', 'date'],
            'note'          => ['nullable', 'string'],
            'items'         => ['nullable', 'array'],
            'items.*.name'  => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'string', 'max:100'],
        ]);

        $list = ShoppingList::create([
            'meal_book_id' => $mealBook->id,
            'created_by'   => $request->user()->id,
            'date'         => $data['date'],
            'note'         => $data['note'] ?? null,
        ]);

        foreach ($data['items'] ?? [] as $item) {
            ShoppingListItem::create([
                'shopping_list_id' => $list->id,
                'name'             => $item['name'],
                'quantity'         => $item['quantity'] ?? null,
            ]);
        }

        return response()->json($list->load(['items', 'creator:id,name']), 201);
    }

    /** POST /meal-books/{mealBook}/shopping-list/{item}/purchase */
    public function markPurchased(Request $request, MealBook $mealBook, ShoppingListItem $item): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        // Verify item belongs to this meal book
        $list = ShoppingList::where('meal_book_id', $mealBook->id)->findOrFail($item->shopping_list_id);

        $item->update([
            'is_purchased' => true,
            'purchased_by' => $request->user()->id,
            'purchased_at' => now(),
        ]);

        return response()->json($item->fresh());
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }
}
