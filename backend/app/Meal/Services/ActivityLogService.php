<?php

namespace App\Meal\Services;

use App\Models\MealBook;
use App\Models\MealBookActivityLog;
use App\Models\User;

class ActivityLogService
{
    public function log(
        MealBook $mealBook,
        User $actor,
        string $event,
        string $description,
        mixed $subject = null,
        array $meta = []
    ): MealBookActivityLog {
        return MealBookActivityLog::create([
            'meal_book_id' => $mealBook->id,
            'actor_id'     => $actor->id,
            'event'        => $event,
            'description'  => $description,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id'   => $subject?->id,
            'meta'         => $meta ?: null,
        ]);
    }
}
