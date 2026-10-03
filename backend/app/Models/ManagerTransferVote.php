<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManagerTransferVote extends Model
{
    protected $fillable = ['manager_transfer_id', 'voter_id', 'vote'];

    protected function casts(): array
    {
        return ['vote' => 'boolean'];
    }

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(ManagerTransfer::class, 'manager_transfer_id');
    }

    public function voter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voter_id');
    }
}
