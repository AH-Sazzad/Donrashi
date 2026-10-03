<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guest_meals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('meal_type_id')->constrained()->restrictOnDelete();
            $table->string('guest_name')->nullable();
            $table->date('date');
            $table->unsignedTinyInteger('quantity')->default(1);
            $table->decimal('meal_value', 4, 2); // snapshot of weight at time of recording
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['meal_book_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guest_meals');
    }
};
