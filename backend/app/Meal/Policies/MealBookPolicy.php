<?php

namespace App\Meal\Policies;

use App\Models\MealBook;
use App\Models\User;

class MealBookPolicy
{
    /** Any authenticated user can create a meal book. */
    public function create(User $user): bool
    {
        return true;
    }

    /** Only members can view. */
    public function view(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isMember($user->id);
    }

    /** Only the manager can update settings. */
    public function update(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }

    /** Only the manager can delete (archive). */
    public function delete(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }

    /** Only the manager can approve/reject deposits. */
    public function manageDeposits(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }

    /** Only the manager can manage expenses. */
    public function manageExpenses(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }

    /** Only the manager can finalize/close settlements. */
    public function manageSettlements(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }

    /** Only the manager can initiate manager transfer. */
    public function initiateTransfer(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }

    /** Any member can vote. */
    public function vote(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isMember($user->id);
    }

    /** Only the manager can generate bazar schedules. */
    public function manageBazar(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }

    /** Only the manager can edit someone else's meal records past cutoff. */
    public function editMealRecord(User $user, MealBook $mealBook): bool
    {
        return $mealBook->isManager($user->id);
    }
}
