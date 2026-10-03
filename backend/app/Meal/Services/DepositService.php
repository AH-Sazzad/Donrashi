<?php

namespace App\Meal\Services;

use App\Meal\Enums\DepositStatus;
use App\Models\MealBook;
use App\Models\MealBookDeposit;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;

class DepositService
{
    public function __construct(private ActivityLogService $log) {}

    /**
     * Create a pending deposit.
     * Immediately debits the member's personal wallet and puts the amount in pending_balance.
     */
    public function create(
        MealBook $mealBook,
        User $member,
        Wallet $fromWallet,
        float $amount,
        ?string $note,
        string $monthYear
    ): MealBookDeposit {
        return DB::transaction(function () use ($mealBook, $member, $fromWallet, $amount, $note, $monthYear) {
            // Debit personal wallet immediately (member's money is "in transit")
            $fromWallet->decrement('balance', $amount);

            $deposit = MealBookDeposit::create([
                'meal_book_id'            => $mealBook->id,
                'member_id'               => $member->id,
                'from_personal_wallet_id' => $fromWallet->id,
                'amount'                  => $amount,
                'status'                  => DepositStatus::Pending,
                'note'                    => $note,
                'month_year'              => $monthYear,
            ]);

            // Increase pending balance on shared wallet
            $mealBook->wallet()->increment('pending_balance', $amount);

            $this->log->log(
                $mealBook, $member,
                'deposit.created',
                "{$member->name} submitted a deposit of ৳{$amount}",
                $deposit,
                ['amount' => $amount, 'wallet' => $fromWallet->name]
            );

            return $deposit;
        });
    }

    /**
     * Manager approves a pending deposit.
     * Moves amount from pending_balance to available_balance.
     */
    public function approve(MealBookDeposit $deposit, User $manager): MealBookDeposit
    {
        return DB::transaction(function () use ($deposit, $manager) {
            $deposit->update([
                'status'      => DepositStatus::Approved,
                'approved_by' => $manager->id,
                'approved_at' => now(),
            ]);

            $wallet = $deposit->mealBook->wallet;
            $wallet->decrement('pending_balance', $deposit->amount);
            $wallet->increment('available_balance', $deposit->amount);

            $this->log->log(
                $deposit->mealBook, $manager,
                'deposit.approved',
                "{$manager->name} approved {$deposit->member->name}'s deposit of ৳{$deposit->amount}",
                $deposit,
                ['amount' => $deposit->amount]
            );

            return $deposit->fresh();
        });
    }

    /**
     * Manager rejects a pending deposit.
     * Returns money to member's personal wallet and clears pending_balance.
     */
    public function reject(MealBookDeposit $deposit, User $manager, ?string $reason): MealBookDeposit
    {
        return DB::transaction(function () use ($deposit, $manager, $reason) {
            // Refund personal wallet
            $deposit->fromWallet->increment('balance', $deposit->amount);

            $deposit->update([
                'status'          => DepositStatus::Rejected,
                'rejected_reason' => $reason,
                'approved_by'     => $manager->id,
                'approved_at'     => now(),
            ]);

            $deposit->mealBook->wallet()->decrement('pending_balance', $deposit->amount);

            $this->log->log(
                $deposit->mealBook, $manager,
                'deposit.rejected',
                "{$manager->name} rejected {$deposit->member->name}'s deposit of ৳{$deposit->amount}",
                $deposit,
                ['amount' => $deposit->amount, 'reason' => $reason]
            );

            return $deposit->fresh();
        });
    }
}
