<?php

namespace App\Meal\Enums;

enum MealBookRole: string
{
    case Manager = 'manager';
    case Member  = 'member';
}
