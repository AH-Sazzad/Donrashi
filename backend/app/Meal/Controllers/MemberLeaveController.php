<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MealBook;
use App\Models\MemberLeave;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberLeaveController extends Controller
{
    /** GET /meal-books/{mealBook}/leaves */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        return response()->json(
            $mealBook->memberLeaves()
                ->with(['member:id,name', 'approver:id,name'])
                ->latest('start_date')
                ->get()
        );
    }

    /** POST /meal-books/{mealBook}/leaves — member declares own leave */
    public function store(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $data = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date'   => ['required', 'date', 'after_or_equal:start_date'],
            'reason'     => ['nullable', 'string', 'max:500'],
            'member_id'  => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $targetId = $data['member_id'] ?? $request->user()->id;

        // Only manager can create leave for others
        if ($targetId !== $request->user()->id && ! $mealBook->isManager($request->user()->id)) {
            abort(403, 'Only the manager can set leave for other members.');
        }

        if (! $mealBook->isMember($targetId)) {
            abort(422, 'Target user is not a member of this meal book.');
        }

        $leave = MemberLeave::create([
            'meal_book_id' => $mealBook->id,
            'member_id'    => $targetId,
            'start_date'   => $data['start_date'],
            'end_date'     => $data['end_date'],
            'reason'       => $data['reason'] ?? null,
        ]);

        return response()->json($leave->load('member:id,name'), 201);
    }

    /** DELETE /meal-books/{mealBook}/leaves/{leave} */
    public function destroy(Request $request, MealBook $mealBook, MemberLeave $leave): JsonResponse
    {
        if ($leave->meal_book_id !== $mealBook->id) abort(404);

        $canDelete = $leave->member_id === $request->user()->id
            || $mealBook->isManager($request->user()->id);

        if (! $canDelete) abort(403);

        $leave->delete();

        return response()->json(['message' => 'Leave cancelled.']);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }
}
