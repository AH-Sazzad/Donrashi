<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);   // Breakfast, Lunch, Dinner, Special
            $table->decimal('weight', 4, 2)->default(1.00); // meal value
            $table->boolean('is_special')->default(false);
            $table->time('cutoff_time')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['meal_book_id', 'name']);
            $table->index('meal_book_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_types');
    }
};
