export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface Wallet {
  id: number;
  name: string;
  currency: string;
  balance: number;
  icon: string;
  color: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: number;
  wallet_id: number;
  category_id: number;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  title: string;
  note?: string;
  transaction_date: string;
  wallet?: Wallet;
  category?: Category;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface TransactionFilters {
  type?: 'income' | 'expense' | 'transfer';
  wallet_id?: number;
  category_id?: number;
  from?: string;
  to?: string;
}

export interface Transfer {
  id: number;
  user_id: number;
  from_wallet_id: number;
  to_wallet_id: number;
  from_amount: number;
  to_amount: number;
  fee: number;
  debit_transaction_id: number | null;
  credit_transaction_id: number | null;
  fee_transaction_id: number | null;
  note?: string;
  transfer_date: string;
  from_wallet?: Wallet;
  to_wallet?: Wallet;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryBreakdown {
  category: Category;
  total: number;
  percentage: number;
  count: number;
}

// ─── Meal Management Types ────────────────────────────────────────────────────

export type MealBookRole   = 'manager' | 'member';
export type DepositStatus  = 'pending' | 'approved' | 'rejected';
export type MonthStatus    = 'open' | 'calculating' | 'finalized' | 'closed';
export type ExpenseCategory = 'food' | 'utilities' | 'other';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type ManagerTransferStatus = 'pending' | 'completed' | 'expired' | 'voted';

export interface MealBook {
  id: number;
  name: string;
  description?: string;
  currency: string;
  min_billable_meals: number;
  bazar_team_size: number;
  join_code: string;
  status: 'active' | 'archived';
  created_by: number;
  member_count?: number;
  wallet?: MealBookWallet;
  meal_types?: MealType[];
  meal_book_members?: MealBookMember[];
  created_at?: string;
  updated_at?: string;
}

export interface MealBookMember {
  id: number;
  meal_book_id: number;
  user_id: number | null;
  role: MealBookRole;
  joined_at?: string;
  /** true when user_id is null — no app account */
  is_ghost: boolean;
  display_name: string;
  ghost_name?: string;
  ghost_email?: string;
  ghost_phone?: string;
  added_by?: number;
  user?: User;
}

export interface MealBookWallet {
  available_balance: number;
  pending_balance: number;
  expected_balance: number;
  currency: string;
}

export interface MealBookDeposit {
  id: number;
  meal_book_id: number;
  member_id: number;
  from_personal_wallet_id: number;
  amount: number;
  status: DepositStatus;
  note?: string;
  approved_by?: number;
  approved_at?: string;
  rejected_reason?: string;
  month_year?: string;
  member?: User;
  from_wallet?: Wallet;
  approver?: User;
  created_at?: string;
}

export interface MealType {
  id: number;
  meal_book_id: number;
  name: string;
  weight: number;
  is_special: boolean;
  cutoff_time?: string;
  is_active: boolean;
  sort_order: number;
}

export interface MealRecord {
  id: number;
  meal_book_id: number;
  member_id: number;
  meal_type_id: number;
  date: string;
  quantity: number;
  is_manager_edit: boolean;
  edit_reason?: string;
  recorded_by: number;
  member?: User;
  meal_type?: MealType;
  recorder?: User;
}

export interface GuestMeal {
  id: number;
  meal_book_id: number;
  recorded_by: number;
  meal_type_id: number;
  guest_name?: string;
  date: string;
  quantity: number;
  meal_value: number;
  note?: string;
  meal_type?: MealType;
  recorder?: User;
}

export interface MealBookExpense {
  id: number;
  meal_book_id: number;
  paid_by: number;
  created_by: number;
  category: ExpenseCategory;
  sub_category?: string;
  amount: number;
  description?: string;
  expense_date: string;
  month_year: string;
  paid_by_user?: User;
  created_by_user?: User;
}

export interface BazarSchedule {
  id: number;
  meal_book_id: number;
  date: string;
  is_auto_generated: boolean;
  note?: string;
  team_members?: BazarScheduleMember[];
}

export interface BazarScheduleMember {
  id: number;
  bazar_schedule_id: number;
  user_id: number;
  duty_count_at_assignment: number;
  user?: User;
}

export interface ShoppingList {
  id: number;
  meal_book_id: number;
  created_by: number;
  date: string;
  note?: string;
  items?: ShoppingListItem[];
  creator?: User;
}

export interface ShoppingListItem {
  id: number;
  shopping_list_id: number;
  name: string;
  quantity?: string;
  is_purchased: boolean;
  purchased_by?: number;
  purchased_at?: string;
}

export interface MemberLeave {
  id: number;
  meal_book_id: number;
  member_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  approved_by?: number;
  member?: User;
}

export interface MonthlySettlement {
  id: number;
  meal_book_id: number;
  month_year: string;
  status: MonthStatus;
  total_food_expense: number;
  total_utility_expense: number;
  total_other_expense: number;
  total_actual_meals: number;
  meal_rate: number;
  finalized_at?: string;
  closed_at?: string;
  member_settlements?: MonthlySettlementMember[];
}

export interface MonthlySettlementMember {
  id: number;
  monthly_settlement_id: number;
  member_id: number;
  actual_meals: number;
  billable_meals: number;
  meal_cost: number;
  utility_share: number;
  other_share: number;
  total_bill: number;
  total_deposited: number;
  due_amount: number;
  snapshots?: Record<string, unknown>;
  member?: User;
}

export interface ManagerTransfer {
  id: number;
  meal_book_id: number;
  initiated_by: number;
  nominated_member_id: number;
  status: ManagerTransferStatus;
  handover_deadline: string;
  completed_at?: string;
  initiator?: User;
  nominated_member?: User;
  votes?: ManagerTransferVote[];
}

export interface ManagerTransferVote {
  id: number;
  manager_transfer_id: number;
  voter_id: number;
  vote: boolean;
  voter?: User;
}

export interface MealBookActivityLog {
  id: number;
  meal_book_id: number;
  actor_id: number;
  event: string;
  description: string;
  subject_type?: string;
  subject_id?: number;
  meta?: Record<string, unknown>;
  actor?: User;
  created_at?: string;
}

export interface MealBookInvitation {
  id: number;
  meal_book_id: number;
  invited_by: number;
  email: string;
  token: string;
  status: InvitationStatus;
  expires_at?: string;
  created_at?: string;
}

export interface MealBookDashboard {
  month_year: string;
  meal_book: Pick<MealBook, 'id' | 'name' | 'currency' | 'min_billable_meals'>;
  my_role: MealBookRole;
  wallet: MealBookWallet;
  my_meals: number;
  my_contribution: number;
  my_due: number | null;
  meal_rate: number | null;
  upcoming_bazar: BazarSchedule[];
  recent_expenses: MealBookExpense[];
  pending_deposits: MealBookDeposit[];
}
