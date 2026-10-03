<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bazar_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->boolean('is_auto_generated')->default(true);
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['meal_book_id', 'date']);
            $table->index('meal_book_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bazar_schedules');
    }
};
