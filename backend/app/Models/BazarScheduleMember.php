<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BazarScheduleMember extends Model
{
    protected $fillable = ['bazar_schedule_id', 'user_id', 'duty_count_at_assignment'];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(BazarSchedule::class, 'bazar_schedule_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
