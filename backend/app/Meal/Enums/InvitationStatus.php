<?php

namespace App\Meal\Enums;

enum InvitationStatus: string
{
    case Pending  = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Expired  = 'expired';
}
