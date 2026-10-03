/**
 * Meal Management API service.
 * Uses the same underlying request() function as api.ts.
 */
import {
  BazarSchedule,
  MealBook,
  MealBookActivityLog,
  MealBookDeposit,
  MealBookDashboard,
  MealBookExpense,
  MealRecord,
  MealType,
  ManagerTransfer,
  MemberLeave,
  MonthlySettlement,
  ShoppingList,
  GuestMeal,
} from '@/types';

// Re-use the internals from api.ts
import { getAuthToken } from '@/services/api';

const BASE_URL = 'http://192.168.0.104:8000/api';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach server.');
  }

  const text = await response.text();
  if (text.trim().startsWith('<')) throw new Error('Server returned HTML. Check server.');

  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.slice(0, 120)}`); }

  if (!response.ok) {
    const d = data as Record<string, string>;
    throw new Error(d?.message || d?.error || `HTTP ${response.status}`);
  }
  return data as T;
}

// ─── Meal Books ───────────────────────────────────────────────────────────────

export const mealBooksApi = {
  list: () => req<MealBook[]>('/meal-books'),

  get: (id: number) => req<MealBook>(`/meal-books/${id}`),

  create: (body: {
    name: string;
    description?: string;
    currency?: string;
    min_billable_meals?: number;
    bazar_team_size?: number;
  }) => req<MealBook>('/meal-books', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: number, body: Partial<{ name: string; description: string; min_billable_meals: number; bazar_team_size: number }>) =>
    req<MealBook>(`/meal-books/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  dashboard: (id: number, monthYear?: string) =>
    req<MealBookDashboard>(`/meal-books/${id}/dashboard${monthYear ? `?month_year=${monthYear}` : ''}`),
};

// ─── Members ──────────────────────────────────────────────────────────────────

export const mealMembersApi = {
  list: (mealBookId: number) => req<import('@/types').MealBookMember[]>(`/meal-books/${mealBookId}/members`),

  remove: (mealBookId: number, userId: number) =>
    req<void>(`/meal-books/${mealBookId}/members/${userId}`, { method: 'DELETE' }),

  invite: (mealBookId: number, email: string) =>
    req<import('@/types').MealBookInvitation>(`/meal-books/${mealBookId}/invitations`, {
      method: 'POST', body: JSON.stringify({ email }),
    }),

  acceptInvitation: (token: string) =>
    req<{ message: string }>(`/invitations/${token}/accept`, { method: 'POST' }),
};

// ─── Wallet & Deposits ────────────────────────────────────────────────────────

export const mealWalletApi = {
  get: (mealBookId: number) => req<import('@/types').MealBookWallet>(`/meal-books/${mealBookId}/wallet`),

  deposits: (mealBookId: number) => req<MealBookDeposit[]>(`/meal-books/${mealBookId}/deposits`),

  createDeposit: (mealBookId: number, body: {
    from_personal_wallet_id: number;
    amount: number;
    note?: string;
    month_year?: string;
  }) => req<MealBookDeposit>(`/meal-books/${mealBookId}/deposits`, { method: 'POST', body: JSON.stringify(body) }),

  approveDeposit: (mealBookId: number, depositId: number) =>
    req<MealBookDeposit>(`/meal-books/${mealBookId}/deposits/${depositId}/approve`, { method: 'POST' }),

  rejectDeposit: (mealBookId: number, depositId: number, reason?: string) =>
    req<MealBookDeposit>(`/meal-books/${mealBookId}/deposits/${depositId}/reject`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),
};

// ─── Meal Types ───────────────────────────────────────────────────────────────

export const mealTypesApi = {
  list: (mealBookId: number) => req<MealType[]>(`/meal-books/${mealBookId}/meal-types`),

  create: (mealBookId: number, body: { name: string; weight: number; cutoff_time?: string; sort_order?: number }) =>
    req<MealType>(`/meal-books/${mealBookId}/meal-types`, { method: 'POST', body: JSON.stringify(body) }),

  update: (mealBookId: number, id: number, body: Partial<MealType>) =>
    req<MealType>(`/meal-books/${mealBookId}/meal-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

// ─── Meal Records ─────────────────────────────────────────────────────────────

export const mealRecordsApi = {
  list: (mealBookId: number, params?: { date?: string; member_id?: number; from?: string; to?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<MealRecord[]>(`/meal-books/${mealBookId}/meals${qs ? `?${qs}` : ''}`);
  },

  record: (mealBookId: number, body: {
    meal_type_id: number;
    date: string;
    quantity?: number;
    member_id?: number;
    edit_reason?: string;
  }) => req<MealRecord>(`/meal-books/${mealBookId}/meals`, { method: 'POST', body: JSON.stringify(body) }),

  delete: (mealBookId: number, id: number) =>
    req<void>(`/meal-books/${mealBookId}/meals/${id}`, { method: 'DELETE' }),
};

// ─── Guest Meals ──────────────────────────────────────────────────────────────

export const guestMealsApi = {
  list: (mealBookId: number) => req<GuestMeal[]>(`/meal-books/${mealBookId}/guest-meals`),

  create: (mealBookId: number, body: { meal_type_id: number; date: string; quantity?: number; guest_name?: string; note?: string }) =>
    req<GuestMeal>(`/meal-books/${mealBookId}/guest-meals`, { method: 'POST', body: JSON.stringify(body) }),

  delete: (mealBookId: number, id: number) =>
    req<void>(`/meal-books/${mealBookId}/guest-meals/${id}`, { method: 'DELETE' }),
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const mealExpensesApi = {
  list: (mealBookId: number, params?: { month_year?: string; category?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<MealBookExpense[]>(`/meal-books/${mealBookId}/expenses${qs ? `?${qs}` : ''}`);
  },

  create: (mealBookId: number, body: {
    paid_by: number;
    category: string;
    sub_category?: string;
    amount: number;
    description?: string;
    expense_date: string;
    month_year?: string;
  }) => req<MealBookExpense>(`/meal-books/${mealBookId}/expenses`, { method: 'POST', body: JSON.stringify(body) }),

  update: (mealBookId: number, id: number, body: Partial<MealBookExpense>) =>
    req<MealBookExpense>(`/meal-books/${mealBookId}/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (mealBookId: number, id: number) =>
    req<void>(`/meal-books/${mealBookId}/expenses/${id}`, { method: 'DELETE' }),
};

// ─── Bazar ────────────────────────────────────────────────────────────────────

export const bazarApi = {
  list: (mealBookId: number, params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<BazarSchedule[]>(`/meal-books/${mealBookId}/bazar${qs ? `?${qs}` : ''}`);
  },

  generate: (mealBookId: number, dates: string[]) =>
    req<BazarSchedule[]>(`/meal-books/${mealBookId}/bazar/generate`, {
      method: 'POST', body: JSON.stringify({ dates }),
    }),

  myDuties: (mealBookId: number) =>
    req<BazarSchedule[]>(`/meal-books/${mealBookId}/bazar/my-duties`),
};

// ─── Shopping List ────────────────────────────────────────────────────────────

export const shoppingApi = {
  list: (mealBookId: number) => req<ShoppingList[]>(`/meal-books/${mealBookId}/shopping-list`),

  create: (mealBookId: number, body: { date: string; note?: string; items?: { name: string; quantity?: string }[] }) =>
    req<ShoppingList>(`/meal-books/${mealBookId}/shopping-list`, { method: 'POST', body: JSON.stringify(body) }),

  markPurchased: (mealBookId: number, itemId: number) =>
    req<import('@/types').ShoppingListItem>(`/meal-books/${mealBookId}/shopping-list/items/${itemId}/purchase`, { method: 'POST' }),
};

// ─── Leaves ───────────────────────────────────────────────────────────────────

export const leavesApi = {
  list: (mealBookId: number) => req<MemberLeave[]>(`/meal-books/${mealBookId}/leaves`),

  create: (mealBookId: number, body: { start_date: string; end_date: string; reason?: string; member_id?: number }) =>
    req<MemberLeave>(`/meal-books/${mealBookId}/leaves`, { method: 'POST', body: JSON.stringify(body) }),

  delete: (mealBookId: number, id: number) =>
    req<void>(`/meal-books/${mealBookId}/leaves/${id}`, { method: 'DELETE' }),
};

// ─── Settlements ──────────────────────────────────────────────────────────────

export const settlementsApi = {
  list: (mealBookId: number) => req<MonthlySettlement[]>(`/meal-books/${mealBookId}/settlements`),

  get: (mealBookId: number, id: number) => req<MonthlySettlement>(`/meal-books/${mealBookId}/settlements/${id}`),

  create: (mealBookId: number, monthYear: string) =>
    req<MonthlySettlement>(`/meal-books/${mealBookId}/settlements`, {
      method: 'POST', body: JSON.stringify({ month_year: monthYear }),
    }),

  calculate: (mealBookId: number, id: number) =>
    req<MonthlySettlement>(`/meal-books/${mealBookId}/settlements/${id}/calculate`, { method: 'POST' }),

  close: (mealBookId: number, id: number) =>
    req<MonthlySettlement>(`/meal-books/${mealBookId}/settlements/${id}/close`, { method: 'POST' }),

  my: (mealBookId: number, monthYear: string) =>
    req<MonthlySettlement>(`/meal-books/${mealBookId}/settlements/my?month_year=${monthYear}`),
};

// ─── Manager Transfer ─────────────────────────────────────────────────────────

export const managerTransferApi = {
  get: (mealBookId: number) => req<ManagerTransfer | null>(`/meal-books/${mealBookId}/manager-transfer`),

  initiate: (mealBookId: number, nominatedMemberId: number) =>
    req<ManagerTransfer>(`/meal-books/${mealBookId}/manager-transfer`, {
      method: 'POST', body: JSON.stringify({ nominated_member_id: nominatedMemberId }),
    }),

  complete: (mealBookId: number, transferId: number) =>
    req<ManagerTransfer>(`/meal-books/${mealBookId}/manager-transfer/${transferId}/complete`, { method: 'POST' }),

  openVote: (mealBookId: number, transferId: number) =>
    req<ManagerTransfer>(`/meal-books/${mealBookId}/manager-transfer/${transferId}/open-vote`, { method: 'POST' }),

  vote: (mealBookId: number, transferId: number, vote: boolean) =>
    req<import('@/types').ManagerTransferVote>(`/meal-books/${mealBookId}/manager-transfer/${transferId}/vote`, {
      method: 'POST', body: JSON.stringify({ vote }),
    }),
};

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const activityLogApi = {
  list: (mealBookId: number, params?: { event?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<{ data: MealBookActivityLog[] }>(`/meal-books/${mealBookId}/activity${qs ? `?${qs}` : ''}`);
  },
};
