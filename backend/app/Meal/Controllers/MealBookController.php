<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Enums\MealBookRole;
use App\Meal\Services\ActivityLogService;
use App\Models\MealBook;
use App\Models\MealBookMember;
use App\Models\MealBookWallet;
use App\Models\MealType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MealBookController extends Controller
{
    public function __construct(private ActivityLogService $log) {}

    /** GET /meal-books — list meal books the authenticated user belongs to */
    public function index(Request $request): JsonResponse
    {
        $books = $request->user()
            ->mealBooks()
            ->with(['mealBookMembers.user', 'wallet'])
            ->withCount('mealBookMembers as member_count')
            ->latest()
            ->get();

        return response()->json($books);
    }

    /** POST /meal-books — create a new meal book */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'               => ['required', 'string', 'max:255'],
            'description'        => ['nullable', 'string'],
            'currency'           => ['nullable', 'string', 'max:10'],
            'min_billable_meals' => ['nullable', 'integer', 'min:0'],
            'bazar_team_size'    => ['nullable', 'integer', 'in:2,3'],
        ]);

        return DB::transaction(function () use ($request, $validated): JsonResponse {
            $book = MealBook::create([
                ...$validated,
                'created_by' => $request->user()->id,
            ]);

            // Creator becomes the first manager
            MealBookMember::create([
                'meal_book_id' => $book->id,
                'user_id'      => $request->user()->id,
                'role'         => MealBookRole::Manager,
                'joined_at'    => now(),
            ]);

            // Create shared wallet
            MealBookWallet::create([
                'meal_book_id' => $book->id,
                'currency'     => $validated['currency'] ?? 'BDT',
            ]);

            // Seed default meal types
            $this->seedDefaultMealTypes($book->id);

            $this->log->log(
                $book, $request->user(),
                'meal_book.created',
                "{$request->user()->name} created meal book \"{$book->name}\""
            );

            return response()->json($book->load(['mealBookMembers.user', 'wallet', 'mealTypes']), 201);
        });
    }

    /** GET /meal-books/{mealBook} */
    public function show(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        return response()->json(
            $mealBook->load(['mealBookMembers.user', 'wallet', 'mealTypes'])
                ->loadCount('mealBookMembers as member_count')
        );
    }

    /** PUT /meal-books/{mealBook} — manager only */
    public function update(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $validated = $request->validate([
            'name'               => ['sometimes', 'required', 'string', 'max:255'],
            'description'        => ['nullable', 'string'],
            'min_billable_meals' => ['nullable', 'integer', 'min:0'],
            'bazar_team_size'    => ['nullable', 'integer', 'in:2,3'],
        ]);

        $mealBook->update($validated);

        $this->log->log(
            $mealBook, $request->user(),
            'meal_book.updated',
            "{$request->user()->name} updated meal book settings",
            $mealBook,
            $validated
        );

        return response()->json($mealBook->fresh());
    }

    /** DELETE /meal-books/{mealBook} — archives the book */
    public function destroy(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $mealBook->update(['status' => 'archived']);

        $this->log->log(
            $mealBook, $request->user(),
            'meal_book.archived',
            "{$request->user()->name} archived the meal book"
        );

        return response()->json(['message' => 'Meal book archived.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'You are not a member of this meal book.');
    }

    private function requireManager(MealBook $book, int $userId): void
    {
        if (! $book->isManager($userId)) abort(403, 'Only the manager can perform this action.');
    }

    private function seedDefaultMealTypes(int $mealBookId): void
    {
        $defaults = [
            ['name' => 'Breakfast', 'weight' => 0.5,  'sort_order' => 1, 'cutoff_time' => '08:00:00'],
            ['name' => 'Lunch',     'weight' => 1.0,  'sort_order' => 2, 'cutoff_time' => '11:00:00'],
            ['name' => 'Dinner',    'weight' => 1.0,  'sort_order' => 3, 'cutoff_time' => '17:00:00'],
        ];

        foreach ($defaults as $d) {
            MealType::create([...$d, 'meal_book_id' => $mealBookId]);
        }
    }
}
