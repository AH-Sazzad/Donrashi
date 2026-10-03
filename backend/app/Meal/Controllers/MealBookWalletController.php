<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Services\DepositService;
use App\Models\MealBook;
use App\Models\MealBookDeposit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MealBookWalletController extends Controller
{
    public function __construct(private DepositService $depositService) {}

    /** GET /meal-books/{mealBook}/wallet */
    public function show(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $wallet = $mealBook->wallet;

        return response()->json([
            'available_balance' => $wallet->available_balance,
            'pending_balance'   => $wallet->pending_balance,
            'expected_balance'  => $wallet->expectedBalance(),
            'currency'          => $wallet->currency,
        ]);
    }

    /** GET /meal-books/{mealBook}/deposits */
    public function deposits(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $deposits = $mealBook->deposits()
            ->with(['member:id,name,email', 'fromWallet:id,name,currency', 'approver:id,name'])
            ->latest()
            ->get();

        return response()->json($deposits);
    }

    /** POST /meal-books/{mealBook}/deposits — member makes a deposit */
    public function storeDeposit(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $data = $request->validate([
            'from_personal_wallet_id' => ['required', 'integer', 'exists:wallets,id'],
            'amount'                  => ['required', 'numeric', 'min:1'],
            'note'                    => ['nullable', 'string', 'max:500'],
            'month_year'              => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        $wallet = $request->user()->wallets()->findOrFail($data['from_personal_wallet_id']);

        if ($wallet->balance < $data['amount']) {
            abort(422, 'Insufficient balance in your personal wallet.');
        }

        $deposit = $this->depositService->create(
            $mealBook,
            $request->user(),
            $wallet,
            (float) $data['amount'],
            $data['note'] ?? null,
            $data['month_year'] ?? now()->format('Y-m')
        );

        return response()->json($deposit->load(['member:id,name', 'fromWallet:id,name,currency']), 201);
    }

    /** POST /meal-books/{mealBook}/deposits/{deposit}/approve — manager */
    public function approveDeposit(Request $request, MealBook $mealBook, MealBookDeposit $deposit): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        $this->requireDepositBelongsToBook($deposit, $mealBook);

        if ($deposit->status->value !== 'pending') {
            abort(422, 'Only pending deposits can be approved.');
        }

        $approved = $this->depositService->approve($deposit, $request->user());

        return response()->json($approved);
    }

    /** POST /meal-books/{mealBook}/deposits/{deposit}/reject — manager */
    public function rejectDeposit(Request $request, MealBook $mealBook, MealBookDeposit $deposit): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        $this->requireDepositBelongsToBook($deposit, $mealBook);

        if ($deposit->status->value !== 'pending') {
            abort(422, 'Only pending deposits can be rejected.');
        }

        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        $rejected = $this->depositService->reject($deposit, $request->user(), $data['reason'] ?? null);

        return response()->json($rejected);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }

    private function requireManager(MealBook $book, int $userId): void
    {
        if (! $book->isManager($userId)) abort(403, 'Manager only.');
    }

    private function requireDepositBelongsToBook(MealBookDeposit $deposit, MealBook $book): void
    {
        if ($deposit->meal_book_id !== $book->id) abort(404);
    }
}
