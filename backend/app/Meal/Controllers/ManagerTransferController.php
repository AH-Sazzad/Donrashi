<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Services\ManagerTransferService;
use App\Models\MealBook;
use App\Models\ManagerTransfer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManagerTransferController extends Controller
{
    public function __construct(private ManagerTransferService $service) {}

    /** GET /meal-books/{mealBook}/manager-transfer */
    public function show(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $transfer = ManagerTransfer::where('meal_book_id', $mealBook->id)
            ->whereIn('status', ['pending', 'expired'])
            ->with(['initiator:id,name', 'nominatedMember:id,name', 'votes.voter:id,name'])
            ->latest()
            ->first();

        return response()->json($transfer);
    }

    /** POST /meal-books/{mealBook}/manager-transfer — current manager initiates */
    public function initiate(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $data = $request->validate([
            'nominated_member_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $nominee = User::findOrFail($data['nominated_member_id']);

        if (! $mealBook->isMember($nominee->id)) {
            abort(422, 'Nominated user is not a member of this meal book.');
        }

        $transfer = $this->service->initiate($mealBook, $request->user(), $nominee);

        return response()->json($transfer->load(['initiator:id,name', 'nominatedMember:id,name']), 201);
    }

    /** POST /meal-books/{mealBook}/manager-transfer/{transfer}/complete */
    public function complete(Request $request, MealBook $mealBook, ManagerTransfer $transfer): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($transfer->meal_book_id !== $mealBook->id) abort(404);

        $result = $this->service->complete($transfer, $request->user());

        return response()->json($result);
    }

    /** POST /meal-books/{mealBook}/manager-transfer/{transfer}/open-vote */
    public function openVote(Request $request, MealBook $mealBook, ManagerTransfer $transfer): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($transfer->meal_book_id !== $mealBook->id) abort(404);

        $result = $this->service->openVote($transfer);

        return response()->json($result);
    }

    /** POST /meal-books/{mealBook}/manager-transfer/{transfer}/vote */
    public function vote(Request $request, MealBook $mealBook, ManagerTransfer $transfer): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);
        if ($transfer->meal_book_id !== $mealBook->id) abort(404);

        $data = $request->validate(['vote' => ['required', 'boolean']]);

        $vote = $this->service->castVote($transfer, $request->user(), $data['vote']);

        return response()->json($vote);
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
