<?php

namespace App\Models;

use App\Meal\Enums\ManagerTransferStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ManagerTransfer extends Model
{
    protected $fillable = [
        'meal_book_id', 'initiated_by', 'nominated_member_id',
        'status', 'handover_deadline', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status'            => ManagerTransferStatus::class,
            'handover_deadline' => 'datetime',
            'completed_at'      => 'datetime',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    public function nominatedMember(): BelongsTo
    {
        return $this->belongsTo(User::class, 'nominated_member_id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(ManagerTransferVote::class);
    }

    public function isExpired(): bool
    {
        return $this->handover_deadline->isPast()
            && $this->status === ManagerTransferStatus::Pending;
    }

    public function yesVoteCount(): int
    {
        return $this->votes()->where('vote', true)->count();
    }

    public function totalVotes(): int
    {
        return $this->votes()->count();
    }
}
