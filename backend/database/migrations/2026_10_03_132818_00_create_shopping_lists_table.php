<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shopping_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->date('date');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index('meal_book_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopping_lists');
    }
};
