<?php

namespace App\Models;

use App\Meal\Enums\MonthStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MonthlySettlement extends Model
{
    protected $fillable = [
        'meal_book_id', 'month_year', 'status',
        'total_food_expense', 'total_utility_expense', 'total_other_expense',
        'total_actual_meals', 'meal_rate',
        'finalized_by', 'finalized_at',
        'closed_by', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'status'                => MonthStatus::class,
            'total_food_expense'    => 'decimal:2',
            'total_utility_expense' => 'decimal:2',
            'total_other_expense'   => 'decimal:2',
            'total_actual_meals'    => 'decimal:2',
            'meal_rate'             => 'decimal:4',
            'finalized_at'          => 'datetime',
            'closed_at'             => 'datetime',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function finalizedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    public function closedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function memberSettlements(): HasMany
    {
        return $this->hasMany(MonthlySettlementMember::class);
    }

    public function isClosed(): bool
    {
        return $this->status === MonthStatus::Closed;
    }

    public function totalExpense(): float
    {
        return (float) $this->total_food_expense
            + (float) $this->total_utility_expense
            + (float) $this->total_other_expense;
    }
}
