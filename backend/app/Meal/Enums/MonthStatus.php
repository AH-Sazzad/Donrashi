<?php

namespace App\Meal\Enums;

enum MonthStatus: string
{
    case Open        = 'open';
    case Calculating = 'calculating';
    case Finalized   = 'finalized';
    case Closed      = 'closed';
}
