<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealBookWallet extends Model
{
    protected $fillable = [
        'meal_book_id', 'available_balance',
        'pending_balance', 'currency',
    ];

    protected function casts(): array
    {
        return [
            'available_balance' => 'decimal:2',
            'pending_balance'   => 'decimal:2',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function expectedBalance(): float
    {
        return (float) $this->available_balance + (float) $this->pending_balance;
    }
}
