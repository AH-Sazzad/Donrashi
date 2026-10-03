<?php

namespace App\Meal\Enums;

enum ManagerTransferStatus: string
{
    case Pending   = 'pending';
    case Completed = 'completed';
    case Expired   = 'expired';
    case Voted     = 'voted';
}
