<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('meal_type_id')->constrained()->restrictOnDelete();
            $table->date('date');
            $table->unsignedTinyInteger('quantity')->default(1);
            $table->boolean('is_manager_edit')->default(false);
            $table->text('edit_reason')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            // One record per member per meal type per day
            $table->unique(['meal_book_id', 'member_id', 'meal_type_id', 'date'], 'meal_records_unique');
            $table->index(['meal_book_id', 'date']);
            $table->index(['meal_book_id', 'member_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_records');
    }
};
