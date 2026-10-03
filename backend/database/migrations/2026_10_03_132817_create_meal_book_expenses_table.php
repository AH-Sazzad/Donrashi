<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_book_expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('paid_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('category', 30); // food, utilities, other
            $table->string('sub_category', 100)->nullable(); // Rice, Gas, Electricity…
            $table->decimal('amount', 15, 2);
            $table->text('description')->nullable();
            $table->date('expense_date');
            $table->string('receipt_path')->nullable();
            $table->string('month_year', 7); // "2026-10"
            $table->timestamps();

            $table->index(['meal_book_id', 'month_year']);
            $table->index(['meal_book_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_book_expenses');
    }
};
