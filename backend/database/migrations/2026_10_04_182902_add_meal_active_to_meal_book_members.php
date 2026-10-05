<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meal_book_members', function (Blueprint $table) {
            // Monthly meal participation status — manager can deactivate per month
            // This is NOT the same as removing from mess. Just skips meal billing.
            $table->boolean('is_meal_active')->default(true)->after('role');
            $table->string('meal_inactive_month', 7)->nullable()->after('is_meal_active');
            // Comment: if meal_inactive_month = '2026-10', member is inactive for that month only
        });
    }

    public function down(): void
    {
        Schema::table('meal_book_members', function (Blueprint $table) {
            $table->dropColumn(['is_meal_active', 'meal_inactive_month']);
        });
    }
};
