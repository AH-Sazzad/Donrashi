<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_settlement_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monthly_settlement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('users')->restrictOnDelete();
            $table->decimal('actual_meals', 10, 2)->default(0);    // weighted sum of consumed meals
            $table->decimal('billable_meals', 10, 2)->default(0);  // max(actual, min_billable)
            $table->decimal('meal_cost', 15, 2)->default(0);       // billable_meals * meal_rate
            $table->decimal('utility_share', 15, 2)->default(0);
            $table->decimal('other_share', 15, 2)->default(0);
            $table->decimal('total_bill', 15, 2)->default(0);
            $table->decimal('total_deposited', 15, 2)->default(0); // approved deposits this period
            $table->decimal('due_amount', 15, 2)->default(0);      // positive=owes, negative=refund
            $table->json('snapshots')->nullable();                  // full audit detail
            $table->timestamps();

            $table->unique(['monthly_settlement_id', 'member_id'], 'msm_settlement_member_unique');
            $table->index('monthly_settlement_id', 'msm_settlement_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_settlement_members');
    }
};
