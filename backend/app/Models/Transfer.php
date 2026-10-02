<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transfer extends Model
{
    protected $fillable = [
        'user_id',
        'from_wallet_id',
        'to_wallet_id',
        'from_amount',
        'to_amount',
        'fee',
        'debit_transaction_id',
        'credit_transaction_id',
        'fee_transaction_id',
        'note',
        'transfer_date',
    ];

    protected function casts(): array
    {
        return [
            'from_amount'   => 'decimal:2',
            'to_amount'     => 'decimal:2',
            'fee'           => 'decimal:2',
            'transfer_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fromWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'from_wallet_id');
    }

    public function toWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'to_wallet_id');
    }

    public function debitTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'debit_transaction_id');
    }

    public function creditTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'credit_transaction_id');
    }

    public function feeTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'fee_transaction_id');
    }
}
