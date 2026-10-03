<?php

namespace App\Models;

use App\Meal\Enums\ExpenseCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealBookExpense extends Model
{
    protected $fillable = [
        'meal_book_id', 'paid_by', 'created_by',
        'category', 'sub_category', 'amount',
        'description', 'expense_date', 'receipt_path', 'month_year',
    ];

    protected function casts(): array
    {
        return [
            'amount'       => 'decimal:2',
            'expense_date' => 'date',
            'category'     => ExpenseCategory::class,
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function paidByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
