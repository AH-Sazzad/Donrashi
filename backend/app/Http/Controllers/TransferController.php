<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransferController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_wallet_id' => ['required', 'integer', 'exists:wallets,id'],
            'to_wallet_id'   => ['required', 'integer', 'exists:wallets,id', 'different:from_wallet_id'],
            'from_amount'    => ['required', 'numeric', 'min:0.01'],
            'to_amount'      => ['required', 'numeric', 'min:0.01'],
            'fee'            => ['nullable', 'numeric', 'min:0'],
            'note'           => ['nullable', 'string', 'max:500'],
            'transfer_date'  => ['required', 'date'],
        ]);

        $user       = $request->user();
        $fee        = (float) ($validated['fee'] ?? 0);
        $fromAmount = (float) $validated['from_amount'];
        $toAmount   = (float) $validated['to_amount'];

        // Verify ownership of both wallets
        $fromWallet = $user->wallets()->find($validated['from_wallet_id']);
        $toWallet   = $user->wallets()->find($validated['to_wallet_id']);

        if (! $fromWallet) {
            return response()->json(['message' => 'Source wallet does not belong to you.'], 403);
        }
        if (! $toWallet) {
            return response()->json(['message' => 'Destination wallet does not belong to you.'], 403);
        }

        // Get or create a hidden system "Transfer" expense category for this user
        $transferCategory = $user->categories()->firstOrCreate(
            ['name' => 'Transfer', 'type' => 'expense'],
            [
                'icon'  => 'swap-horizontal-outline',
                'color' => '#6C63FF',
            ]
        );

        $transfer = DB::transaction(function () use (
            $user, $fromWallet, $toWallet,
            $fromAmount, $toAmount, $fee,
            $validated, $transferCategory
        ) {
            $date = $validated['transfer_date'];

            // 1. Debit transaction — transfer type on source wallet
            $debit = Transaction::create([
                'user_id'          => $user->id,
                'wallet_id'        => $fromWallet->id,
                'category_id'      => $transferCategory->id,
                'type'             => 'transfer',
                'amount'           => $fromAmount,
                'title'            => 'Transfer to ' . $toWallet->name,
                'note'             => $validated['note'] ?? null,
                'transaction_date' => $date,
            ]);
            $fromWallet->decrement('balance', $fromAmount);

            // 2. Credit transaction — transfer type on destination wallet
            $credit = Transaction::create([
                'user_id'          => $user->id,
                'wallet_id'        => $toWallet->id,
                'category_id'      => $transferCategory->id,
                'type'             => 'transfer',
                'amount'           => $toAmount,
                'title'            => 'Transfer from ' . $fromWallet->name,
                'note'             => $validated['note'] ?? null,
                'transaction_date' => $date,
            ]);
            $toWallet->increment('balance', $toAmount);

            // 3. Fee expense (if any) — separate transaction on source wallet
            $feeTransaction = null;
            if ($fee > 0) {
                $feeTransaction = Transaction::create([
                    'user_id'          => $user->id,
                    'wallet_id'        => $fromWallet->id,
                    'category_id'      => $transferCategory->id,
                    'type'             => 'expense',
                    'amount'           => $fee,
                    'title'            => 'MFS Charge',
                    'note'             => 'Transfer fee for sending to ' . $toWallet->name,
                    'transaction_date' => $date,
                ]);
                $fromWallet->decrement('balance', $fee);
            }

            // 4. Create the transfer record
            $transfer = Transfer::create([
                'user_id'              => $user->id,
                'from_wallet_id'       => $fromWallet->id,
                'to_wallet_id'         => $toWallet->id,
                'from_amount'          => $fromAmount,
                'to_amount'            => $toAmount,
                'fee'                  => $fee,
                'debit_transaction_id' => $debit->id,
                'credit_transaction_id'=> $credit->id,
                'fee_transaction_id'   => $feeTransaction?->id,
                'note'                 => $validated['note'] ?? null,
                'transfer_date'        => $date,
            ]);

            return $transfer;
        });

        $transfer->load([
            'fromWallet:id,name,currency,color',
            'toWallet:id,name,currency,color',
            'debitTransaction',
            'creditTransaction',
            'feeTransaction',
        ]);

        return response()->json($transfer, 201);
    }

    public function index(Request $request): JsonResponse
    {
        $transfers = $request->user()
            ->transfers()
            ->with([
                'fromWallet:id,name,currency,color',
                'toWallet:id,name,currency,color',
            ])
            ->latest('transfer_date')
            ->get();

        return response()->json($transfers);
    }
}
