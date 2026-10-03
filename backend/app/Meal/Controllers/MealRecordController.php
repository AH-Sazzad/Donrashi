<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Services\ActivityLogService;
use App\Models\MealBook;
use App\Models\MealRecord;
use App\Models\MealType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MealRecordController extends Controller
{
    public function __construct(private ActivityLogService $log) {}

    /** GET /meal-books/{mealBook}/meals?date=&member_id= */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $request->validate([
            'date'      => ['nullable', 'date'],
            'member_id' => ['nullable', 'integer'],
            'from'      => ['nullable', 'date'],
            'to'        => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $records = $mealBook->mealRecords()
            ->with(['member:id,name', 'mealType', 'recorder:id,name'])
            ->when($request->date, fn ($q) => $q->where('date', $request->date))
            ->when($request->member_id, fn ($q) => $q->where('member_id', $request->member_id))
            ->when($request->from, fn ($q) => $q->where('date', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->where('date', '<=', $request->to))
            ->orderBy('date')
            ->get();

        return response()->json($records);
    }

    /** POST /meal-books/{mealBook}/meals */
    public function store(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $data = $request->validate([
            'meal_type_id' => ['required', 'integer', 'exists:meal_types,id'],
            'date'         => ['required', 'date'],
            'quantity'     => ['nullable', 'integer', 'min:0', 'max:10'],
            'member_id'    => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $mealType  = MealType::where('meal_book_id', $mealBook->id)->findOrFail($data['meal_type_id']);
        $targetId  = $data['member_id'] ?? $request->user()->id;
        $isForSelf = $targetId === $request->user()->id;

        // Verify target is a member
        if (! $mealBook->isMember($targetId)) {
            abort(422, 'The specified member does not belong to this meal book.');
        }

        // Non-managers can only record for themselves
        if (! $isForSelf && ! $mealBook->isManager($request->user()->id)) {
            abort(403, 'Only the manager can record meals for other members.');
        }

        // Cutoff check
        $isPastCutoff = $mealType->isPastCutoff() && $data['date'] === now()->toDateString();
        if ($isPastCutoff && ! $mealBook->isManager($request->user()->id)) {
            abort(422, 'Meal cutoff has passed. Only the manager can modify.');
        }

        $isManagerEdit = ! $isForSelf || $isPastCutoff;

        $editReason = null;
        if ($isManagerEdit && $isPastCutoff) {
            $editReason = $request->input('edit_reason', 'Manager edit after cutoff');
        }

        $record = MealRecord::updateOrCreate(
            [
                'meal_book_id' => $mealBook->id,
                'member_id'    => $targetId,
                'meal_type_id' => $mealType->id,
                'date'         => $data['date'],
            ],
            [
                'quantity'        => $data['quantity'] ?? 1,
                'is_manager_edit' => $isManagerEdit,
                'edit_reason'     => $editReason,
                'recorded_by'     => $request->user()->id,
            ]
        );

        if ($isManagerEdit) {
            $this->log->log(
                $mealBook, $request->user(),
                'meal.manager_edit',
                "{$request->user()->name} edited meal record for member #{$targetId} on {$data['date']}",
                $record,
                ['quantity' => $data['quantity'], 'reason' => $editReason]
            );
        }

        return response()->json($record->load(['member:id,name', 'mealType', 'recorder:id,name']), 201);
    }

    /** DELETE /meal-books/{mealBook}/meals/{mealRecord} */
    public function destroy(Request $request, MealBook $mealBook, MealRecord $mealRecord): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        if ($mealRecord->meal_book_id !== $mealBook->id) abort(404);

        $canDelete = $mealRecord->member_id === $request->user()->id
            || $mealBook->isManager($request->user()->id);

        if (! $canDelete) abort(403);

        $mealRecord->delete();

        return response()->json(['message' => 'Meal record deleted.']);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }
}
