<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Services\ActivityLogService;
use App\Models\MealBook;
use App\Models\MealBookExpense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MealBookExpenseController extends Controller
{
    public function __construct(private ActivityLogService $log) {}

    /** GET /meal-books/{mealBook}/expenses?month_year= */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        $request->validate([
            'month_year' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'category'   => ['nullable', 'string', 'in:food,utilities,other'],
        ]);

        $expenses = $mealBook->expenses()
            ->with(['paidByUser:id,name', 'createdByUser:id,name'])
            ->when($request->month_year, fn ($q) => $q->where('month_year', $request->month_year))
            ->when($request->category, fn ($q) => $q->where('category', $request->category))
            ->latest('expense_date')
            ->get();

        return response()->json($expenses);
    }

    /** POST /meal-books/{mealBook}/expenses — manager */
    public function store(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $data = $request->validate([
            'paid_by'      => ['required', 'integer', 'exists:users,id'],
            'category'     => ['required', 'string', 'in:food,utilities,other'],
            'sub_category' => ['nullable', 'string', 'max:100'],
            'amount'       => ['required', 'numeric', 'min:0.01'],
            'description'  => ['nullable', 'string'],
            'expense_date' => ['required', 'date'],
            'month_year'   => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        // Verify paid_by is a member
        if (! $mealBook->isMember($data['paid_by'])) {
            abort(422, 'paid_by must be a member of this meal book.');
        }

        $expense = MealBookExpense::create([
            ...$data,
            'meal_book_id' => $mealBook->id,
            'created_by'   => $request->user()->id,
            'month_year'   => $data['month_year'] ?? now()->format('Y-m'),
        ]);

        // Deduct from shared wallet available balance
        $mealBook->wallet()->decrement('available_balance', (float) $data['amount']);

        $this->log->log(
            $mealBook, $request->user(),
            'expense.created',
            "{$request->user()->name} added {$data['category']} expense ৳{$data['amount']}",
            $expense,
            ['amount' => $data['amount'], 'category' => $data['category']]
        );

        return response()->json($expense->load(['paidByUser:id,name']), 201);
    }

    /** PUT /meal-books/{mealBook}/expenses/{expense} — manager */
    public function update(Request $request, MealBook $mealBook, MealBookExpense $expense): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($expense->meal_book_id !== $mealBook->id) abort(404);

        $data = $request->validate([
            'paid_by'      => ['sometimes', 'integer', 'exists:users,id'],
            'category'     => ['sometimes', 'string', 'in:food,utilities,other'],
            'sub_category' => ['nullable', 'string', 'max:100'],
            'amount'       => ['sometimes', 'numeric', 'min:0.01'],
            'description'  => ['nullable', 'string'],
            'expense_date' => ['sometimes', 'date'],
        ]);

        // If amount changed, adjust wallet balance
        if (isset($data['amount'])) {
            $diff = (float) $data['amount'] - (float) $expense->amount;
            if ($diff > 0) {
                $mealBook->wallet()->decrement('available_balance', $diff);
            } elseif ($diff < 0) {
                $mealBook->wallet()->increment('available_balance', abs($diff));
            }
        }

        $expense->update($data);

        $this->log->log(
            $mealBook, $request->user(),
            'expense.updated',
            "{$request->user()->name} updated expense #{$expense->id}",
            $expense, $data
        );

        return response()->json($expense->fresh());
    }

    /** DELETE /meal-books/{mealBook}/expenses/{expense} — manager */
    public function destroy(Request $request, MealBook $mealBook, MealBookExpense $expense): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);
        if ($expense->meal_book_id !== $mealBook->id) abort(404);

        $this->log->log(
            $mealBook, $request->user(),
            'expense.deleted',
            "{$request->user()->name} deleted expense #{$expense->id} (৳{$expense->amount})",
            $expense
        );

        // Refund amount back to shared wallet
        $mealBook->wallet()->increment('available_balance', (float) $expense->amount);

        $expense->delete();

        return response()->json(['message' => 'Expense deleted.']);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'Not a member.');
    }

    private function requireManager(MealBook $book, int $userId): void
    {
        if (! $book->isManager($userId)) abort(403, 'Manager only.');
    }
}
