<?php

namespace App\Console\Commands;

use App\Meal\Services\SettlementCalculatorService;
use App\Models\MealBook;
use App\Models\MonthlySettlement;
use Illuminate\Console\Command;

class CalculateMealSettlement extends Command
{
    protected $signature   = 'meal:calculate {mess_name} {month_year}';
    protected $description = 'Calculate settlement for a mess for a given month (YYYY-MM)';

    public function handle(SettlementCalculatorService $calculator): int
    {
        $name      = $this->argument('mess_name');
        $monthYear = $this->argument('month_year');

        $mess = MealBook::where('name', $name)->first();
        if (! $mess) {
            $this->error("Mess not found: {$name}");
            return 1;
        }

        $manager = $mess->mealBookMembers()->where('role', 'manager')->first()?->user;
        if (! $manager) {
            $this->error('No manager found for this mess.');
            return 1;
        }

        $settlement = MonthlySettlement::firstOrCreate(
            ['meal_book_id' => $mess->id, 'month_year' => $monthYear],
            ['status' => 'open']
        );

        if ($settlement->status->value === 'closed') {
            $this->error('Settlement is already closed.');
            return 1;
        }

        $result = $calculator->calculate($settlement, $manager);

        $this->info("✓ Settlement calculated for {$mess->name} — {$monthYear}");
        $this->info("  Meal Rate:       ৳{$result->meal_rate}/meal");
        $this->info("  Total Meals:     {$result->total_actual_meals}");
        $this->info("  Food Expense:    ৳{$result->total_food_expense}");
        $this->info("  Utility Expense: ৳{$result->total_utility_expense}");
        $this->newLine();

        foreach ($result->memberSettlements as $ms) {
            $name = $ms->member?->name ?? "Member #{$ms->member_id}";
            $due  = Number_format((float)$ms->due_amount, 2);
            $status = (float)$ms->due_amount >= 0 ? "owes ৳{$due}" : "refund ৳" . abs((float)$ms->due_amount);
            $this->info("  {$name}: {$ms->billable_meals} meals → {$status}");
        }

        return 0;
    }
}
