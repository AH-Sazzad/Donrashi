<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bazar_schedule_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bazar_schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('duty_count_at_assignment')->default(0);
            $table->timestamps();

            $table->unique(['bazar_schedule_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bazar_schedule_members');
    }
};
