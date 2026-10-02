<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL requires modifying the enum directly via raw SQL
        DB::statement("ALTER TABLE transactions MODIFY COLUMN type ENUM('income', 'expense', 'transfer') NOT NULL");
    }

    public function down(): void
    {
        // Revert — existing 'transfer' rows would need to be handled first in production
        DB::statement("ALTER TABLE transactions MODIFY COLUMN type ENUM('income', 'expense') NOT NULL");
    }
};
