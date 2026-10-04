<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meal_records', function (Blueprint $table) {
            // pending = member submitted, awaiting approval
            // approved = confirmed by manager (or auto-approved if manager entered it)
            // rejected = manager rejected
            $table->string('status', 20)->default('approved')->after('quantity');
        });

        // All existing records are already approved
        DB::statement("UPDATE meal_records SET status = 'approved'");
    }

    public function down(): void
    {
        Schema::table('meal_records', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
