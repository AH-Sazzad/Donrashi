<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealRecord extends Model
{
    protected $fillable = [
        'meal_book_id', 'member_id', 'meal_type_id',
        'date', 'quantity', 'status',
        'is_manager_edit', 'edit_reason', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'date'            => 'date',
            'is_manager_edit' => 'boolean',
            'quantity'        => 'integer',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'member_id');
    }

    public function mealType(): BelongsTo
    {
        return $this->belongsTo(MealType::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /** Weighted meal value = quantity × meal_type.weight */
    public function weightedValue(): float
    {
        return $this->quantity * (float) $this->mealType->weight;
    }
}
