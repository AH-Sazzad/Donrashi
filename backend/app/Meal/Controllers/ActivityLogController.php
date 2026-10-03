<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MealBook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /** GET /meal-books/{mealBook}/activity */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $request->validate([
            'event' => ['nullable', 'string'],
            'from'  => ['nullable', 'date'],
            'to'    => ['nullable', 'date'],
        ]);

        $logs = $mealBook->activityLogs()
            ->with('actor:id,name')
            ->when($request->event, fn ($q) => $q->where('event', $request->event))
            ->when($request->from, fn ($q) => $q->whereDate('created_at', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->whereDate('created_at', '<=', $request->to))
            ->latest()
            ->paginate(50);

        return response()->json($logs);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }
}
