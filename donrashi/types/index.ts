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
