<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manager_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('initiated_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('nominated_member_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 20)->default('pending'); // pending, completed, expired, voted
            $table->timestamp('handover_deadline');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['meal_book_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manager_transfers');
    }
};
