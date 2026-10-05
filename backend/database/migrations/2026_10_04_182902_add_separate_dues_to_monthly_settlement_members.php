<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monthly_settlement_members', function (Blueprint $table) {
            // Separate meal and utility tracking
            $table->boolean('is_meal_active')->default(true)->after('actual_meals');
            // Paid amounts split by type
            $table->decimal('meal_paid', 15, 2)->default(0)->after('total_deposited');
            $table->decimal('utility_paid', 15, 2)->default(0)->after('meal_paid');
            // Due amounts split by type
            $table->decimal('meal_due', 15, 2)->default(0)->after('due_amount');
            $table->decimal('utility_due', 15, 2)->default(0)->after('meal_due');
            // Overpayment/advance credit per type
            $table->decimal('meal_credit', 15, 2)->default(0)->after('utility_due');
            $table->decimal('utility_credit', 15, 2)->default(0)->after('meal_credit');
        });
    }

    public function down(): void
    {
        Schema::table('monthly_settlement_members', function (Blueprint $table) {
            $table->dropColumn([
                'is_meal_active', 'meal_paid', 'utility_paid',
                'meal_due', 'utility_due', 'meal_credit', 'utility_credit',
            ]);
        });
    }
};
