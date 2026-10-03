<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meal_books', function (Blueprint $table) {
            // Unique 6-character uppercase join code — auto-generated, never changes
            $table->string('join_code', 8)->nullable()->unique()->after('status');
        });

        // Backfill existing rows with a unique code
        $books = DB::table('meal_books')->whereNull('join_code')->get();
        foreach ($books as $book) {
            do {
                $code = strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 6));
            } while (DB::table('meal_books')->where('join_code', $code)->exists());

            DB::table('meal_books')->where('id', $book->id)->update(['join_code' => $code]);
        }

        // Now make it NOT NULL
        Schema::table('meal_books', function (Blueprint $table) {
            $table->string('join_code', 8)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('meal_books', function (Blueprint $table) {
            $table->dropUnique(['join_code']);
            $table->dropColumn('join_code');
        });
    }
};
