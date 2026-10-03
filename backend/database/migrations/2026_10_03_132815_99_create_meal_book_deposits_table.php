<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_book_deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('from_personal_wallet_id')->constrained('wallets')->restrictOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('status', 20)->default('pending'); // pending, approved, rejected
            $table->text('note')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejected_reason')->nullable();
            $table->string('month_year', 7)->nullable(); // "2026-10" — settlement period
            $table->timestamps();

            $table->index(['meal_book_id', 'status']);
            $table->index(['meal_book_id', 'member_id']);
            $table->index('month_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_book_deposits');
    }
};
