<?php

namespace Database\Seeders;

use App\Meal\Enums\MealBookRole;
use App\Models\MealBook;
use App\Models\MealBookActivityLog;
use App\Models\MealBookDeposit;
use App\Models\MealBookExpense;
use App\Models\MealBookMember;
use App\Models\MealBookWallet;
use App\Models\MealRecord;
use App\Models\MealType;
use App\Models\User;
use App\Models\Wallet;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class MealTestSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Creating test mess data...');

        DB::transaction(function () {

            // ── Month: October 2026 ───────────────────────────────────────────
            $month = '2026-10';
            $year  = 2026;
            $mon   = 10;
            $daysInMonth = 31;

            // ── 1. Create or find manager user ────────────────────────────────
            $manager = User::firstOrCreate(
                ['email' => 'sazzad@mess.test'],
                [
                    'name'     => 'Asmaul Hasan Sazzad',
                    'password' => Hash::make('password'),
                ]
            );

            // Give manager a personal wallet
            $managerWallet = Wallet::firstOrCreate(
                ['user_id' => $manager->id, 'name' => 'bKash'],
                ['currency' => 'BDT', 'balance' => 5000, 'icon' => 'wallet', 'color' => '#FF6584', 'is_default' => true]
            );

            // ── 2. Create 4 registered members ───────────────────────────────
            $memberData = [
                ['name' => 'Mahbob Hossain',   'email' => 'mahbob@mess.test'],
                ['name' => 'Nayeem Islam',      'email' => 'nayeem@mess.test'],
                ['name' => 'Karim Uddin',       'email' => 'karim@mess.test'],
                ['name' => 'Rahim Sheikh',      'email' => 'rahim@mess.test'],
            ];

            $members = collect($memberData)->map(function ($data) {
                $user = User::firstOrCreate(
                    ['email' => $data['email']],
                    ['name' => $data['name'], 'password' => Hash::make('password')]
                );
                Wallet::firstOrCreate(
                    ['user_id' => $user->id, 'name' => 'Cash'],
                    ['currency' => 'BDT', 'balance' => 3000, 'icon' => 'wallet', 'color' => '#43C59E', 'is_default' => true]
                );
                return $user;
            });

            // ── 3. Create the mess ────────────────────────────────────────────
            // Delete existing test mess to keep seeder idempotent
            MealBook::where('name', 'Mirpur Bachelor Mess (Test)')->each(fn ($b) => $b->delete());

            $mess = MealBook::create([
                'name'               => 'Mirpur Bachelor Mess (Test)',
                'description'        => 'Demo mess for testing — 6 members, October 2026 data',
                'currency'           => 'BDT',
                'min_billable_meals' => 30,
                'bazar_team_size'    => 2,
                'status'             => 'active',
                'created_by'         => $manager->id,
                'join_code'          => MealBook::generateJoinCode(),
            ]);

            // Shared wallet
            $messWallet = MealBookWallet::create([
                'meal_book_id'      => $mess->id,
                'available_balance' => 0,
                'pending_balance'   => 0,
                'currency'          => 'BDT',
            ]);

            // ── 4. Add members ────────────────────────────────────────────────
            // Manager
            MealBookMember::create([
                'meal_book_id' => $mess->id,
                'user_id'      => $manager->id,
                'role'         => MealBookRole::Manager,
                'joined_at'    => now(),
            ]);

            // Registered members
            foreach ($members as $member) {
                MealBookMember::create([
                    'meal_book_id' => $mess->id,
                    'user_id'      => $member->id,
                    'role'         => MealBookRole::Member,
                    'joined_at'    => now(),
                ]);
            }

            // 1 ghost member
            MealBookMember::create([
                'meal_book_id' => $mess->id,
                'user_id'      => null,
                'role'         => MealBookRole::Member,
                'ghost_name'   => 'Hasan Mia (Offline)',
                'ghost_phone'  => '01700000000',
                'added_by'     => $manager->id,
                'joined_at'    => now(),
            ]);

            $this->command->info("  ✓ Mess created: {$mess->name} (join code: {$mess->join_code})");

            // ── 5. Meal types ─────────────────────────────────────────────────
            $breakfast = MealType::create(['meal_book_id' => $mess->id, 'name' => 'Breakfast', 'weight' => 0.5,  'sort_order' => 1, 'cutoff_time' => '08:00:00', 'is_active' => true, 'is_special' => false]);
            $lunch     = MealType::create(['meal_book_id' => $mess->id, 'name' => 'Lunch',     'weight' => 1.0,  'sort_order' => 2, 'cutoff_time' => '11:00:00', 'is_active' => true, 'is_special' => false]);
            $dinner    = MealType::create(['meal_book_id' => $mess->id, 'name' => 'Dinner',    'weight' => 1.0,  'sort_order' => 3, 'cutoff_time' => '17:00:00', 'is_active' => true, 'is_special' => false]);

            // ── 6. All members list (for meal/deposit data) ───────────────────
            $allMembers = $mess->mealBookMembers()->get(); // 6 entries
            $registeredMembers = $allMembers->whereNotNull('user_id');

            // ── 7. Deposits — ৳500-1500 per registered member ─────────────────
            $totalDeposited = 0;
            foreach ($registeredMembers as $mbr) {
                $depositAmount = rand(800, 1500);
                MealBookDeposit::create([
                    'meal_book_id'            => $mess->id,
                    'member_id'               => $mbr->user_id,
                    'from_personal_wallet_id' => $manager->wallets()->first()?->id ?? 1,
                    'amount'                  => $depositAmount,
                    'status'                  => 'approved',
                    'note'                    => 'Cash — October contribution (recorded by manager)',
                    'approved_by'             => $manager->id,
                    'approved_at'             => now(),
                    'month_year'              => $month,
                ]);
                $totalDeposited += $depositAmount;
            }

            // Ghost member cash deposit
            MealBookDeposit::create([
                'meal_book_id'            => $mess->id,
                'member_id'               => $manager->id, // fallback
                'from_personal_wallet_id' => $managerWallet->id,
                'amount'                  => 600,
                'status'                  => 'approved',
                'note'                    => 'Cash — Hasan Mia October contribution (recorded by manager)',
                'approved_by'             => $manager->id,
                'approved_at'             => now(),
                'month_year'              => $month,
            ]);
            $totalDeposited += 600;

            // One pending deposit
            MealBookDeposit::create([
                'meal_book_id'            => $mess->id,
                'member_id'               => $members->first()->id,
                'from_personal_wallet_id' => $managerWallet->id,
                'amount'                  => 400,
                'status'                  => 'pending',
                'note'                    => 'bKash — waiting approval',
                'month_year'              => $month,
            ]);
            $messWallet->update([
                'available_balance' => $totalDeposited,
                'pending_balance'   => 400,
            ]);

            $this->command->info("  ✓ Deposits: ৳{$totalDeposited} approved + ৳400 pending");

            // ── 8. Meal records — realistic October data ───────────────────────
            // Each member eats breakfast ~60%, lunch ~95%, dinner ~90% of days
            // Manager (Sazzad) eats most consistently
            $allUserIds = $registeredMembers->pluck('user_id')->toArray();
            $mealCount  = 0;

            $breakfastProb = [
                $manager->id    => 0.7,
                $members[0]->id => 0.5,
                $members[1]->id => 0.8,
                $members[2]->id => 0.4,
                $members[3]->id => 0.6,
            ];
            $lunchProb = array_fill_keys($allUserIds, 0.95);
            $lunchProb[$manager->id] = 0.98;
            $dinnerProb = array_fill_keys($allUserIds, 0.88);

            for ($day = 1; $day <= $daysInMonth; $day++) {
                $date = sprintf('%04d-%02d-%02d', $year, $mon, $day);

                foreach ($allUserIds as $userId) {
                    // Breakfast
                    if ((mt_rand() / mt_getrandmax()) < ($breakfastProb[$userId] ?? 0.6)) {
                        MealRecord::create([
                            'meal_book_id' => $mess->id,
                            'member_id'    => $userId,
                            'meal_type_id' => $breakfast->id,
                            'date'         => $date,
                            'quantity'     => 1,
                            'status'       => 'approved',
                            'recorded_by'  => $manager->id,
                        ]);
                        $mealCount++;
                    }

                    // Lunch
                    if ((mt_rand() / mt_getrandmax()) < ($lunchProb[$userId] ?? 0.95)) {
                        MealRecord::create([
                            'meal_book_id' => $mess->id,
                            'member_id'    => $userId,
                            'meal_type_id' => $lunch->id,
                            'date'         => $date,
                            'quantity'     => 1,
                            'status'       => 'approved',
                            'recorded_by'  => $manager->id,
                        ]);
                        $mealCount++;
                    }

                    // Dinner
                    if ((mt_rand() / mt_getrandmax()) < ($dinnerProb[$userId] ?? 0.88)) {
                        MealRecord::create([
                            'meal_book_id' => $mess->id,
                            'member_id'    => $userId,
                            'meal_type_id' => $dinner->id,
                            'date'         => $date,
                            'quantity'     => 1,
                            'status'       => 'approved',
                            'recorded_by'  => $manager->id,
                        ]);
                        $mealCount++;
                    }
                }
            }

            // A few pending records (members submitted, not yet approved)
            MealRecord::create([
                'meal_book_id' => $mess->id,
                'member_id'    => $members[0]->id,
                'meal_type_id' => $lunch->id,
                'date'         => sprintf('%04d-%02d-31', $year, $mon),
                'quantity'     => 1,
                'status'       => 'pending',
                'recorded_by'  => $members[0]->id,
            ]);

            $this->command->info("  ✓ Meal records: {$mealCount} approved + 1 pending");

            // ── 9. Bazar expenses ─────────────────────────────────────────────
            $bazarItems = [
                ['sub_category' => 'Rice 10kg',        'amount' => 650,  'day' => 1],
                ['sub_category' => 'Chicken 3kg',      'amount' => 750,  'day' => 3],
                ['sub_category' => 'Fish (Hilsha) 2kg','amount' => 1200, 'day' => 5],
                ['sub_category' => 'Vegetables mixed', 'amount' => 380,  'day' => 7],
                ['sub_category' => 'Oil 5L',           'amount' => 850,  'day' => 8],
                ['sub_category' => 'Egg 6 dozen',      'amount' => 720,  'day' => 10],
                ['sub_category' => 'Chicken 4kg',      'amount' => 1000, 'day' => 12],
                ['sub_category' => 'Rice 10kg',        'amount' => 650,  'day' => 15],
                ['sub_category' => 'Fish 3kg',         'amount' => 900,  'day' => 17],
                ['sub_category' => 'Vegetables + lentil','amount' => 420,'day' => 19],
                ['sub_category' => 'Beef 2kg',         'amount' => 1400, 'day' => 21],
                ['sub_category' => 'Oil 3L + spices',  'amount' => 650,  'day' => 22],
                ['sub_category' => 'Chicken 3kg',      'amount' => 750,  'day' => 24],
                ['sub_category' => 'Rice 10kg',        'amount' => 650,  'day' => 26],
                ['sub_category' => 'Fish + vegetables','amount' => 980,  'day' => 28],
                ['sub_category' => 'Egg 4 dozen + misc','amount' => 580, 'day' => 30],
            ];

            $paidByUsers = $allUserIds;
            $totalFood = 0;
            foreach ($bazarItems as $i => $item) {
                $paidBy  = $paidByUsers[$i % count($paidByUsers)];
                $dateStr = sprintf('%04d-%02d-%02d', $year, $mon, $item['day']);
                $expense = MealBookExpense::create([
                    'meal_book_id' => $mess->id,
                    'paid_by'      => $paidBy,
                    'created_by'   => $manager->id,
                    'category'     => 'food',
                    'sub_category' => $item['sub_category'],
                    'amount'       => $item['amount'],
                    'description'  => 'Bazar purchase',
                    'expense_date' => $dateStr,
                    'month_year'   => $month,
                ]);
                $totalFood += $item['amount'];
            }

            // ── 10. Utility expenses ──────────────────────────────────────────
            $utilities = [
                ['sub_category' => 'House Rent',   'amount' => 8000],
                ['sub_category' => 'Gas Bill',     'amount' => 950],
                ['sub_category' => 'Electricity',  'amount' => 1200],
                ['sub_category' => 'WiFi',         'amount' => 700],
                ['sub_category' => 'Water',        'amount' => 300],
                ['sub_category' => 'Cleaning',     'amount' => 200],
            ];

            $totalUtility = 0;
            foreach ($utilities as $util) {
                MealBookExpense::create([
                    'meal_book_id' => $mess->id,
                    'paid_by'      => $manager->id,
                    'created_by'   => $manager->id,
                    'category'     => 'utilities',
                    'sub_category' => $util['sub_category'],
                    'amount'       => $util['amount'],
                    'expense_date' => sprintf('%04d-%02d-01', $year, $mon),
                    'month_year'   => $month,
                ]);
                $totalUtility += $util['amount'];
            }

            // Update wallet balance (deposits - food - utilities)
            $totalExpenses = $totalFood + $totalUtility;
            $newBalance    = max(0, $totalDeposited - $totalExpenses);
            $messWallet->update(['available_balance' => $newBalance]);

            $this->command->info("  ✓ Food expenses: ৳{$totalFood}");
            $this->command->info("  ✓ Utility expenses: ৳{$totalUtility}");
            $this->command->info("  ✓ Wallet balance: ৳{$newBalance}");

            // ── 11. Activity log ──────────────────────────────────────────────
            MealBookActivityLog::create([
                'meal_book_id' => $mess->id,
                'actor_id'     => $manager->id,
                'event'        => 'meal_book.created',
                'description'  => 'Asmaul Hasan Sazzad created the mess "Mirpur Bachelor Mess (Test)"',
            ]);
            MealBookActivityLog::create([
                'meal_book_id' => $mess->id,
                'actor_id'     => $manager->id,
                'event'        => 'deposit.approved',
                'description'  => 'Manager approved October deposits from all members',
            ]);

            // ── 12. Summary ───────────────────────────────────────────────────
            $this->command->newLine();
            $this->command->info('═══════════════════════════════════════════════');
            $this->command->info('  TEST MESS CREATED SUCCESSFULLY');
            $this->command->info('═══════════════════════════════════════════════');
            $this->command->info("  Mess:       {$mess->name}");
            $this->command->info("  Join Code:  {$mess->join_code}");
            $this->command->info("  Month:      October 2026");
            $this->command->newLine();
            $this->command->info('  LOGIN CREDENTIALS:');
            $this->command->info('  ─────────────────────────────────────────────');
            $this->command->info('  Manager:  sazzad@mess.test     / password');
            $this->command->info('  Member 1: mahbob@mess.test     / password');
            $this->command->info('  Member 2: nayeem@mess.test     / password');
            $this->command->info('  Member 3: karim@mess.test      / password');
            $this->command->info('  Member 4: rahim@mess.test      / password');
            $this->command->info('  Member 5: Hasan Mia (ghost - no account)');
            $this->command->newLine();
            $this->command->info('  DATA SUMMARY:');
            $this->command->info('  ─────────────────────────────────────────────');
            $this->command->info("  Meal records:     {$mealCount} approved");
            $this->command->info("  Food expenses:    ৳{$totalFood}");
            $this->command->info("  Utility expenses: ৳{$totalUtility}");
            $this->command->info("  Total deposited:  ৳{$totalDeposited}");
            $this->command->info("  Wallet balance:   ৳{$newBalance}");
            $this->command->info('═══════════════════════════════════════════════');
        });
    }
}
