<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type'        => ['nullable', 'in:income,expense,transfer'],
            'wallet_id'   => ['nullable', 'integer', 'exists:wallets,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'from'        => ['nullable', 'date'],
            'to'          => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $transactions = $request->user()
            ->transactions()
            ->with(['wallet:id,name', 'category:id,name,type,icon,color'])
            ->when($request->type, fn ($q) => $q->where('type', $request->type))
            ->when($request->wallet_id, fn ($q) => $q->where('wallet_id', $request->wallet_id))
            ->when($request->category_id, fn ($q) => $q->where('category_id', $request->category_id))
            ->when($request->from, fn ($q) => $q->whereDate('transaction_date', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->whereDate('transaction_date', '<=', $request->to))
            ->latest('transaction_date')
            ->get();

        return response()->json($transactions);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'wallet_id'        => ['required', 'integer', 'exists:wallets,id'],
            'category_id'      => ['required', 'integer', 'exists:categories,id'],
            'type'             => ['required', 'in:income,expense,transfer'],
            'amount'           => ['required', 'numeric', 'min:0.01'],
            'title'            => ['required', 'string', 'max:255'],
            'note'             => ['nullable', 'string'],
            'transaction_date' => ['required', 'date'],
        ]);

        // Verify the wallet and category belong to the authenticated user
        $this->authorizeWalletAndCategory($request, $validated);

        $transaction = $request->user()->transactions()->create($validated);

        // Update wallet balance
        $this->adjustWalletBalance($transaction);

        $transaction->load(['wallet:id,name', 'category:id,name,type,icon,color']);

        return response()->json($transaction, 201);
    }

    public function show(Request $request, Transaction $transaction): JsonResponse
    {
        $this->authorizeOwnership($request, $transaction);

        $transaction->load(['wallet:id,name', 'category:id,name,type,icon,color']);

        return response()->json($transaction);
    }

    public function update(Request $request, Transaction $transaction): JsonResponse
    {
        $this->authorizeOwnership($request, $transaction);

        $validated = $request->validate([
            'wallet_id'        => ['sometimes', 'required', 'integer', 'exists:wallets,id'],
            'category_id'      => ['sometimes', 'required', 'integer', 'exists:categories,id'],
            'type'             => ['sometimes', 'required', 'in:income,expense,transfer'],
            'amount'           => ['sometimes', 'required', 'numeric', 'min:0.01'],
            'title'            => ['sometimes', 'required', 'string', 'max:255'],
            'note'             => ['nullable', 'string'],
            'transaction_date' => ['sometimes', 'required', 'date'],
        ]);

        if (isset($validated['wallet_id']) || isset($validated['category_id'])) {
            $this->authorizeWalletAndCategory($request, array_merge(
                ['wallet_id' => $transaction->wallet_id, 'category_id' => $transaction->category_id],
                $validated
            ));
        }

        // Reverse the old balance effect before applying the new one
        $this->reverseWalletBalance($transaction);
        $transaction->update($validated);
        $transaction->refresh();
        $this->adjustWalletBalance($transaction);

        $transaction->load(['wallet:id,name', 'category:id,name,type,icon,color']);

        return response()->json($transaction);
    }

    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        $this->authorizeOwnership($request, $transaction);

        $this->reverseWalletBalance($transaction);
        $transaction->delete();

        return response()->json(['message' => 'Transaction deleted successfully.']);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function authorizeOwnership(Request $request, Transaction $transaction): void
    {
        if ($transaction->user_id !== $request->user()->id) {
            abort(403, 'This action is unauthorized.');
        }
    }

    private function authorizeWalletAndCategory(Request $request, array $data): void
    {
        $user = $request->user();

        if (! $user->wallets()->where('id', $data['wallet_id'])->exists()) {
            abort(403, 'The selected wallet does not belong to you.');
        }

        if (! $user->categories()->where('id', $data['category_id'])->exists()) {
            abort(403, 'The selected category does not belong to you.');
        }
    }

    private function adjustWalletBalance(Transaction $transaction): void
    {
        $wallet = $transaction->wallet;

        if ($transaction->type === 'income' || $transaction->type === 'transfer') {
            // For transfer: the credit side uses 'transfer' type and increments
            // We determine direction by checking if it's a "Transfer from" (income side)
            // Since transfer debit/credit are handled atomically in TransferController,
            // individual transaction balance adjustment is skipped for transfer type here.
            // TransferController handles balances directly — do nothing for 'transfer'.
            if ($transaction->type === 'transfer') return;
            $wallet->increment('balance', $transaction->amount);
        } else {
            $wallet->decrement('balance', $transaction->amount);
        }
    }

    private function reverseWalletBalance(Transaction $transaction): void
    {
        $wallet = $transaction->wallet;

        // Transfer balance is managed by TransferController — skip here
        if ($transaction->type === 'transfer') return;

        if ($transaction->type === 'income') {
            $wallet->decrement('balance', $transaction->amount);
        } else {
            $wallet->increment('balance', $transaction->amount);
        }
    }
}
