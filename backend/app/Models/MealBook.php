<?php

namespace App\Models;

use App\Meal\Enums\MealBookStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class MealBook extends Model
{
    protected $fillable = [
        'name', 'description', 'currency',
        'min_billable_meals', 'bazar_team_size',
        'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status'             => MealBookStatus::class,
            'min_billable_meals' => 'integer',
            'bazar_team_size'    => 'integer',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'meal_book_members')
            ->withPivot(['role', 'joined_at'])
            ->withTimestamps();
    }

    public function mealBookMembers(): HasMany
    {
        return $this->hasMany(MealBookMember::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(MealBookInvitation::class);
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(MealBookWallet::class);
    }

    public function deposits(): HasMany
    {
        return $this->hasMany(MealBookDeposit::class);
    }

    public function mealTypes(): HasMany
    {
        return $this->hasMany(MealType::class)->orderBy('sort_order');
    }

    public function mealRecords(): HasMany
    {
        return $this->hasMany(MealRecord::class);
    }

    public function guestMeals(): HasMany
    {
        return $this->hasMany(GuestMeal::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(MealBookExpense::class);
    }

    public function bazarSchedules(): HasMany
    {
        return $this->hasMany(BazarSchedule::class);
    }

    public function shoppingLists(): HasMany
    {
        return $this->hasMany(ShoppingList::class);
    }

    public function memberLeaves(): HasMany
    {
        return $this->hasMany(MemberLeave::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(MonthlySettlement::class);
    }

    public function managerTransfers(): HasMany
    {
        return $this->hasMany(ManagerTransfer::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(MealBookActivityLog::class);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    public function isMember(int $userId): bool
    {
        return $this->mealBookMembers()->where('user_id', $userId)->exists();
    }

    public function isManager(int $userId): bool
    {
        return $this->mealBookMembers()
            ->where('user_id', $userId)
            ->where('role', 'manager')
            ->exists();
    }

    public function getManager(): ?MealBookMember
    {
        return $this->mealBookMembers()->where('role', 'manager')->first();
    }

    public function currentSettlement(): ?MonthlySettlement
    {
        $monthYear = now()->format('Y-m');
        return $this->settlements()->where('month_year', $monthYear)->first();
    }
}
