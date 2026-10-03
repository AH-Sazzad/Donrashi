<?php

namespace App\Models;

use App\Meal\Enums\MealBookRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealBookMember extends Model
{
    protected $fillable = ['meal_book_id', 'user_id', 'role', 'joined_at'];

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

    public function isManager(): bool
    {
        return $this->role === MealBookRole::Manager;
    }
}
