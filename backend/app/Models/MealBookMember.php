<?php

namespace App\Models;

use App\Meal\Enums\MealBookRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealBookMember extends Model
{
    protected $fillable = ['meal_book_id', 'user_id', 'role', 'joined_at',
        'ghost_name', 'ghost_email', 'ghost_phone', 'added_by'];

    protected function casts(): array
    {
        return [
            'role'      => MealBookRole::class,
            'joined_at' => 'datetime',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function isManager(): bool
    {
        return $this->role === MealBookRole::Manager;
    }

    /** Ghost members have no user account */
    public function isGhost(): bool
    {
        return $this->user_id === null;
    }

    /** Display name — real user name or ghost name */
    public function getDisplayNameAttribute(): string
    {
        return $this->user?->name ?? $this->ghost_name ?? 'Unknown';
    }
}
