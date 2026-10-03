<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_books', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('currency', 10)->default('BDT');
            $table->unsignedSmallInteger('min_billable_meals')->default(30);
            $table->unsignedTinyInteger('bazar_team_size')->default(2);
            $table->string('status', 20)->default('active'); // active, archived
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_books');
    }
};
