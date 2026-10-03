<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_book_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invited_by')->constrained('users')->restrictOnDelete();
            $table->string('email');
            $table->string('token', 64)->unique();
            $table->string('status', 20)->default('pending'); // pending, accepted, rejected, expired
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['meal_book_id', 'email']);
            $table->index('token');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_book_invitations');
    }
};
