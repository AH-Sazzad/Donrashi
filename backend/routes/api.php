<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\TransferController;
use App\Http\Controllers\WalletController;
use App\Meal\Controllers\ActivityLogController;
use App\Meal\Controllers\BazarController;
use App\Meal\Controllers\DashboardController;
use App\Meal\Controllers\GuestMealController;
use App\Meal\Controllers\ManagerTransferController;
use App\Meal\Controllers\MealBookController;
use App\Meal\Controllers\MealBookExpenseController;
use App\Meal\Controllers\MealBookMemberController;
use App\Meal\Controllers\MealBookWalletController;
use App\Meal\Controllers\MealRecordController;
use App\Meal\Controllers\MealTypeController;
use App\Meal\Controllers\MemberLeaveController;
use App\Meal\Controllers\MonthlySettlementController;
use App\Meal\Controllers\ShoppingListController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware('auth:api')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
    });
});

Route::middleware('auth:api')->group(function (): void {
    // Categories
    Route::apiResource('categories', CategoryController::class);

    // Wallets
    Route::apiResource('wallets', WalletController::class);

    // Transactions
    Route::apiResource('transactions', TransactionController::class);

    // Transfers
    Route::get('/transfers', [TransferController::class, 'index']);
    Route::post('/transfers', [TransferController::class, 'store']);

    // ── Meal Management ───────────────────────────────────────────────────────

    // Invitation accept (token-based, no mealBook scope needed)
    Route::post('/invitations/{token}/accept', [MealBookMemberController::class, 'acceptInvitation']);

    Route::prefix('meal-books')->group(function () {
        Route::get('/',       [MealBookController::class, 'index']);
        Route::post('/',      [MealBookController::class, 'store']);
        Route::post('/join',  [MealBookController::class, 'joinByCode']);

        Route::prefix('{mealBook}')->group(function () {
            Route::get('/',     [MealBookController::class, 'show']);
            Route::put('/',     [MealBookController::class, 'update']);
            Route::delete('/',  [MealBookController::class, 'destroy']);

            // Dashboard
            Route::get('/dashboard', [DashboardController::class, 'show']);

            // Members
            Route::get('/members',          [MealBookMemberController::class, 'index']);
            Route::delete('/members/{user}', [MealBookMemberController::class, 'destroy']);
            Route::post('/invitations',      [MealBookMemberController::class, 'invite']);

            // Wallet
            Route::get('/wallet',             [MealBookWalletController::class, 'show']);
            Route::get('/deposits',           [MealBookWalletController::class, 'deposits']);
            Route::post('/deposits',          [MealBookWalletController::class, 'storeDeposit']);
            Route::post('/deposits/{deposit}/approve', [MealBookWalletController::class, 'approveDeposit']);
            Route::post('/deposits/{deposit}/reject',  [MealBookWalletController::class, 'rejectDeposit']);

            // Meal types
            Route::get('/meal-types',          [MealTypeController::class, 'index']);
            Route::post('/meal-types',         [MealTypeController::class, 'store']);
            Route::put('/meal-types/{mealType}', [MealTypeController::class, 'update']);

            // Meal records
            Route::get('/meals',             [MealRecordController::class, 'index']);
            Route::post('/meals',            [MealRecordController::class, 'store']);
            Route::delete('/meals/{mealRecord}', [MealRecordController::class, 'destroy']);

            // Guest meals
            Route::get('/guest-meals',           [GuestMealController::class, 'index']);
            Route::post('/guest-meals',          [GuestMealController::class, 'store']);
            Route::delete('/guest-meals/{guestMeal}', [GuestMealController::class, 'destroy']);

            // Expenses
            Route::get('/expenses',               [MealBookExpenseController::class, 'index']);
            Route::post('/expenses',              [MealBookExpenseController::class, 'store']);
            Route::put('/expenses/{expense}',     [MealBookExpenseController::class, 'update']);
            Route::delete('/expenses/{expense}',  [MealBookExpenseController::class, 'destroy']);

            // Bazar
            Route::get('/bazar',               [BazarController::class, 'index']);
            Route::post('/bazar/generate',     [BazarController::class, 'generate']);
            Route::get('/bazar/my-duties',     [BazarController::class, 'myDuties']);

            // Shopping list
            Route::get('/shopping-list',       [ShoppingListController::class, 'index']);
            Route::post('/shopping-list',      [ShoppingListController::class, 'store']);
            Route::post('/shopping-list/items/{item}/purchase', [ShoppingListController::class, 'markPurchased']);

            // Leave
            Route::get('/leaves',              [MemberLeaveController::class, 'index']);
            Route::post('/leaves',             [MemberLeaveController::class, 'store']);
            Route::delete('/leaves/{leave}',   [MemberLeaveController::class, 'destroy']);

            // Settlements
            Route::get('/settlements',                      [MonthlySettlementController::class, 'index']);
            Route::post('/settlements',                     [MonthlySettlementController::class, 'store']);
            Route::get('/settlements/my',                   [MonthlySettlementController::class, 'my']);
            Route::get('/settlements/{settlement}',         [MonthlySettlementController::class, 'show']);
            Route::post('/settlements/{settlement}/calculate', [MonthlySettlementController::class, 'calculate']);
            Route::post('/settlements/{settlement}/close',  [MonthlySettlementController::class, 'close']);

            // Manager transfer
            Route::get('/manager-transfer',                                      [ManagerTransferController::class, 'show']);
            Route::post('/manager-transfer',                                     [ManagerTransferController::class, 'initiate']);
            Route::post('/manager-transfer/{transfer}/complete',                 [ManagerTransferController::class, 'complete']);
            Route::post('/manager-transfer/{transfer}/open-vote',                [ManagerTransferController::class, 'openVote']);
            Route::post('/manager-transfer/{transfer}/vote',                     [ManagerTransferController::class, 'vote']);

            // Activity log
            Route::get('/activity', [ActivityLogController::class, 'index']);
        });
    });
});
