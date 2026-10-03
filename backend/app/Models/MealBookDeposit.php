<?php

namespace App\Models;

use App\Meal\Enums\DepositStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealBookDeposit extends Model
{
    protected $fillable = [
        'meal_book_id', 'member_id', 'from_personal_wallet_id',
        'amount', 'status', 'note',
        'approved_by', 'approved_at', 'rejected_reason', 'month_year',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'status'      => DepositStatus::class,
            'approved_at' => 'datetime',
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

    public function fromWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'from_personal_wallet_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
