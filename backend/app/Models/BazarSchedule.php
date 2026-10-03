<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BazarSchedule extends Model
{
    protected $fillable = [
        'meal_book_id', 'date',
        'is_auto_generated', 'generated_by', 'note',
    ];

    protected function casts(): array
    {
        return [
            'date'               => 'date',
            'is_auto_generated'  => 'boolean',
        ];
    }

    public function mealBook(): BelongsTo
    {
        return $this->belongsTo(MealBook::class);
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function teamMembers(): HasMany
    {
        return $this->hasMany(BazarScheduleMember::class);
    }
}
