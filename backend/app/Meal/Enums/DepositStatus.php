<?php

namespace App\Meal\Enums;

enum DepositStatus: string
{
    case Pending  = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
