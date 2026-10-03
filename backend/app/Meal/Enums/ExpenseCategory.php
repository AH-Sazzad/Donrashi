<?php

namespace App\Meal\Enums;

enum ExpenseCategory: string
{
    case Food      = 'food';
    case Utilities = 'utilities';
    case Other     = 'other';
}
