<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuestMeal extends Model
{
    protected $fillable = [
        'meal_book_id', 'recorded_by', 'meal_type_id',
        'guest_name', 'date', 'quantity', 'meal_value', 'note',
    ];

    protected function casts(): array
    {
        return [
            'date'       => 'date',
            'quantity'   => 'integer',
            'meal_value' => 'decimal:2',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function mealType(): BelongsTo
    {
        return $this->belongsTo(MealType::class);
    }
}
