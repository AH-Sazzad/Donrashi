<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manager_transfer_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('manager_transfer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voter_id')->constrained('users')->restrictOnDelete();
            $table->boolean('vote'); // true = yes, false = no
            $table->timestamps();

            $table->unique(['manager_transfer_id', 'voter_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manager_transfer_votes');
    }
};
