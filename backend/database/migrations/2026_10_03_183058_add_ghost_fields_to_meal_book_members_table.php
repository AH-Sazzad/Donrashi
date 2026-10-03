<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meal_book_members', function (Blueprint $table) {
            // Make user_id nullable — ghost members have no account
            $table->foreignId('user_id')->nullable()->change();

            // Ghost member fields — only populated when user_id is null
            $table->string('ghost_name')->nullable()->after('user_id');
            $table->string('ghost_email')->nullable()->after('ghost_name');
            $table->string('ghost_phone')->nullable()->after('ghost_email');

            // Added by which manager
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete()->after('ghost_phone');

            // Drop the old unique constraint (user_id was NOT NULL before)
            // and replace with a partial-style check via index
            $table->dropUnique(['meal_book_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('meal_book_members', function (Blueprint $table) {
            $table->dropColumn(['ghost_name', 'ghost_email', 'ghost_phone', 'added_by']);
            $table->foreignId('user_id')->nullable(false)->change();
            $table->unique(['meal_book_id', 'user_id']);
        });
    }
};
