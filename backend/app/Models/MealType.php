<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MealType extends Model
{
    protected $fillable = [
        'meal_book_id', 'name', 'weight',
        'is_special', 'cutoff_time', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'weight'     => 'decimal:2',
            'is_special' => 'boolean',
            'is_active'  => 'boolean',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function mealRecords(): HasMany
    {
        return $this->hasMany(MealRecord::class);
    }

    public function guestMeals(): HasMany
    {
        return $this->hasMany(GuestMeal::class);
    }

    public function isPastCutoff(): bool
    {
        if (! $this->cutoff_time) {
            return false;
        }
        return now()->format('H:i:s') > $this->cutoff_time;
    }
}
