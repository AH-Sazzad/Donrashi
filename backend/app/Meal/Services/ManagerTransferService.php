<?php

namespace App\Meal\Services;

use App\Meal\Enums\MealBookRole;
use App\Meal\Enums\ManagerTransferStatus;
use App\Models\MealBook;
use App\Models\ManagerTransfer;
use App\Models\ManagerTransferVote;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ManagerTransferService
{
    public function __construct(private ActivityLogService $log) {}

    /**
     * Current manager nominates a new manager.
     * Opens a 7-day handover window.
     */
    public function initiate(MealBook $mealBook, User $currentManager, User $nominee): ManagerTransfer
    {
        // Ensure no active transfer already exists
        $existing = ManagerTransfer::where('meal_book_id', $mealBook->id)
            ->whereIn('status', ['pending', 'expired'])
            ->first();

        if ($existing) {
            throw new \RuntimeException('An active manager transfer already exists for this meal book.');
        }

        $transfer = ManagerTransfer::create([
            'meal_book_id'       => $mealBook->id,
            'initiated_by'       => $currentManager->id,
            'nominated_member_id'=> $nominee->id,
            'status'             => ManagerTransferStatus::Pending,
            'handover_deadline'  => now()->addDays(7),
        ]);

        $this->log->log(
            $mealBook, $currentManager,
            'manager_transfer.initiated',
            "{$currentManager->name} nominated {$nominee->name} as next manager. Deadline: 7 days.",
            $transfer
        );

        return $transfer;
    }

    /**
     * Current manager completes the handover early (or within deadline).
     */
    public function complete(ManagerTransfer $transfer, User $currentManager): ManagerTransfer
    {
        return DB::transaction(function () use ($transfer, $currentManager) {
            $mealBook = $transfer->mealBook;

            // Swap roles
            $mealBook->mealBookMembers()
                ->where('user_id', $currentManager->id)
                ->update(['role' => MealBookRole::Member]);

            $mealBook->mealBookMembers()
                ->where('user_id', $transfer->nominated_member_id)
                ->update(['role' => MealBookRole::Manager]);

            $transfer->update([
                'status'       => ManagerTransferStatus::Completed,
                'completed_at' => now(),
            ]);

            $this->log->log(
                $mealBook, $currentManager,
                'manager_transfer.completed',
                "{$currentManager->name} completed handover to {$transfer->nominatedMember->name}",
                $transfer
            );

            return $transfer->fresh();
        });
    }

    /**
     * Open voting after deadline expires (called by manager or via scheduled job).
     */
    public function openVote(ManagerTransfer $transfer): ManagerTransfer
    {
        if ($transfer->status !== ManagerTransferStatus::Pending) {
            throw new \RuntimeException('Transfer is not in pending state.');
        }

        if (! $transfer->handover_deadline->isPast()) {
            throw new \RuntimeException('Handover deadline has not passed yet.');
        }

        $transfer->update(['status' => ManagerTransferStatus::Expired]);

        $this->log->log(
            $transfer->mealBook,
            $transfer->initiator,
            'manager_transfer.vote_opened',
            "Handover deadline passed. Manager vote opened for {$transfer->nominatedMember->name}",
            $transfer
        );

        return $transfer->fresh();
    }

    /**
     * Cast a vote. Each member gets exactly one vote.
     */
    public function castVote(ManagerTransfer $transfer, User $voter, bool $vote): ManagerTransferVote
    {
        if ($transfer->status !== ManagerTransferStatus::Expired) {
            throw new \RuntimeException('Voting is not open for this transfer.');
        }

        $existing = ManagerTransferVote::where('manager_transfer_id', $transfer->id)
            ->where('voter_id', $voter->id)
            ->first();

        if ($existing) {
            throw new \RuntimeException('You have already voted.');
        }

        $voteRecord = ManagerTransferVote::create([
            'manager_transfer_id' => $transfer->id,
            'voter_id'            => $voter->id,
            'vote'                => $vote,
        ]);

        $this->log->log(
            $transfer->mealBook, $voter,
            'manager_transfer.vote_cast',
            "{$voter->name} voted " . ($vote ? 'YES' : 'NO') . " for {$transfer->nominatedMember->name}",
            $transfer
        );

        // Auto-resolve if all eligible members have voted
        $this->tryResolve($transfer);

        return $voteRecord;
    }

    /**
     * If > 50% of eligible members voted YES, complete the transfer.
     */
    private function tryResolve(ManagerTransfer $transfer): void
    {
        $eligibleCount = $transfer->mealBook->mealBookMembers()->count();
        $totalVotes    = $transfer->votes()->count();
        $yesVotes      = $transfer->votes()->where('vote', true)->count();

        // Need > 50% yes from eligible (not just voters)
        if ($yesVotes > $eligibleCount / 2) {
            DB::transaction(function () use ($transfer) {
                $mealBook = $transfer->mealBook;

                $mealBook->mealBookMembers()
                    ->where('user_id', $transfer->initiated_by)
                    ->update(['role' => MealBookRole::Member]);

                $mealBook->mealBookMembers()
                    ->where('user_id', $transfer->nominated_member_id)
                    ->update(['role' => MealBookRole::Manager]);

                $transfer->update([
                    'status'       => ManagerTransferStatus::Voted,
                    'completed_at' => now(),
                ]);

                $this->log->log(
                    $mealBook, $transfer->nominatedMember,
                    'manager_transfer.voted_complete',
                    "Vote passed ({$yesVotes}/{$eligibleCount}). {$transfer->nominatedMember->name} is now manager.",
                    $transfer
                );
            });
        }
    }
}
