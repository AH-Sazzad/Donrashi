<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_book_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('available_balance', 15, 2)->default(0); // approved deposits only
            $table->decimal('pending_balance', 15, 2)->default(0);   // awaiting approval
            $table->string('currency', 10)->default('BDT');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_book_wallets');
    }
};
