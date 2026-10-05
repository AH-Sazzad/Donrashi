<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonthlySettlementMember extends Model
{
    protected $fillable = [
        'monthly_settlement_id', 'member_id',
        'is_meal_active',
        'actual_meals', 'billable_meals', 'meal_cost',
        'utility_share', 'other_share', 'total_bill',
        'total_deposited', 'due_amount',
        'meal_paid', 'utility_paid',
        'meal_due', 'utility_due',
        'meal_credit', 'utility_credit',
        'snapshots',
    ];

    protected function casts(): array
    {
        return [
            'is_meal_active'  => 'boolean',
            'actual_meals'    => 'decimal:2',
            'billable_meals'  => 'decimal:2',
            'meal_cost'       => 'decimal:2',
            'utility_share'   => 'decimal:2',
            'other_share'     => 'decimal:2',
            'total_bill'      => 'decimal:2',
            'total_deposited' => 'decimal:2',
            'due_amount'      => 'decimal:2',
            'meal_paid'       => 'decimal:2',
            'utility_paid'    => 'decimal:2',
            'meal_due'        => 'decimal:2',
            'utility_due'     => 'decimal:2',
            'meal_credit'     => 'decimal:2',
            'utility_credit'  => 'decimal:2',
            'snapshots'       => 'array',
        ];
    }

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(MonthlySettlement::class, 'monthly_settlement_id');
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'member_id');
    }

    /** Positive = member owes, negative = refund due */
    public function isRefund(): bool
    {
        return (float) $this->due_amount < 0;
    }
}
