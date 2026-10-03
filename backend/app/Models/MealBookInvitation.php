<?php

namespace App\Models;

use App\Meal\Enums\InvitationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealBookInvitation extends Model
{
    protected $fillable = [
        'meal_book_id', 'invited_by', 'email',
        'token', 'status', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'status'     => InvitationStatus::class,
            'expires_at' => 'datetime',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }
}
