<?php

namespace App\Meal\Enums;

enum MealBookStatus: string
{
    case Active   = 'active';
    case Archived = 'archived';
}
