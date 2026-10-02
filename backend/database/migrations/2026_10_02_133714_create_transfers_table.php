<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_wallet_id')->constrained('wallets')->cascadeOnDelete();
            $table->foreignId('to_wallet_id')->constrained('wallets')->cascadeOnDelete();

            // Amount deducted from the source wallet (in source wallet's currency)
            $table->decimal('from_amount', 15, 2);

            // Amount credited to the destination wallet (may differ if currency differs or vendor gives custom rate)
            $table->decimal('to_amount', 15, 2);

            // Transfer fee charged (in source wallet's currency)
            $table->decimal('fee', 15, 2)->default(0);

            // The two linked transactions (for audit trail and balance tracking)
            $table->foreignId('debit_transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->foreignId('credit_transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            // Fee expense transaction (null when fee = 0)
            $table->foreignId('fee_transaction_id')->nullable()->constrained('transactions')->nullOnDelete();

            $table->string('note')->nullable();
            $table->date('transfer_date');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transfers');
    }
};
