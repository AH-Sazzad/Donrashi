<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->string('month_year', 7); // "2026-10"
            $table->string('status', 20)->default('open'); // open, calculating, finalized, closed
            $table->decimal('total_food_expense', 15, 2)->default(0);
            $table->decimal('total_utility_expense', 15, 2)->default(0);
            $table->decimal('total_other_expense', 15, 2)->default(0);
            $table->decimal('total_actual_meals', 10, 2)->default(0); // weighted sum
            $table->decimal('meal_rate', 10, 4)->default(0);
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('finalized_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unique(['meal_book_id', 'month_year']);
            $table->index(['meal_book_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_settlements');
    }
};
