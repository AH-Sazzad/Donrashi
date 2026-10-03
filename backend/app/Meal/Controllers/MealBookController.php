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
                'join_code'  => MealBook::generateJoinCode(),
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

    /** DELETE /meal-books/{mealBook} — permanently deletes the meal book */
    public function destroy(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $this->log->log(
            $mealBook, $request->user(),
            'meal_book.deleted',
            "{$request->user()->name} permanently deleted the meal book \"{$mealBook->name}\""
        );

        $mealBook->delete();

        return response()->json(['message' => 'Meal book deleted.']);
    }

    /** POST /meal-books/join — join a meal book using a 6-char join code */
    public function joinByCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'join_code' => ['required', 'string', 'max:8'],
        ]);

        $code = strtoupper(trim($validated['join_code']));
        $book = MealBook::where('join_code', $code)->where('status', 'active')->first();

        if (! $book) {
            return response()->json(['message' => 'Invalid join code. Check the code and try again.'], 404);
        }

        $user = $request->user();

        if ($book->isMember($user->id)) {
            return response()->json(['message' => 'You are already a member of this meal book.'], 422);
        }

        // Check if a ghost member exists with the same email — claim it
        $ghost = $book->mealBookMembers()
            ->whereNull('user_id')
            ->where('ghost_email', $user->email)
            ->first();

        if ($ghost) {
            $ghost->update([
                'user_id'     => $user->id,
                'ghost_name'  => $ghost->ghost_name, // keep original name
                'joined_at'   => now(),
            ]);
        } else {
            MealBookMember::create([
                'meal_book_id' => $book->id,
                'user_id'      => $user->id,
                'role'         => MealBookRole::Member,
                'joined_at'    => now(),
            ]);
        }

        $this->log->log(
            $book, $user,
            'member.joined',
            "{$user->name} joined via join code"
        );

        return response()->json([
            'message'   => 'Joined successfully.',
            'meal_book' => $book->load(['mealBookMembers.user', 'wallet']),
        ], 201);
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
