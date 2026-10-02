import {
  AuthResponse,
  Category,
  Transaction,
  TransactionFilters,
  User,
  Wallet,
} from '@/types';

const BASE_URL = 'http://192.168.0.102:8000/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach server. Check your network or server is running.');
  }

  const text = await response.text();

  // Guard against HTML error pages (e.g. hosting provider challenge pages)
  if (text.trim().startsWith('<')) {
    throw new Error(`Server returned an HTML page instead of JSON. Check that the server is reachable at ${BASE_URL}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 120)}`);
  }

  if (!response.ok) {
    const msg =
      (data as Record<string, string>)?.message ||
      (data as Record<string, string>)?.error ||
      `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  me: () => request<{ user: User }>('/auth/me'),

  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () => request<{ data: Category[] } | Category[]>('/categories').then(res =>
    ({ data: Array.isArray(res) ? res : (res.data ?? []) })
  ),

  get: (id: number) => request<{ data: Category } | Category>(`/categories/${id}`).then(res =>
    ({ data: ('data' in res ? res.data : res) as Category })
  ),

  create: (body: Omit<Category, 'id' | 'created_at' | 'updated_at'>) =>
    request<{ data: Category } | Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(res => ({ data: ('data' in res ? res.data : res) as Category })),

  update: (id: number, body: Partial<Omit<Category, 'id'>>) =>
    request<{ data: Category } | Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }).then(res => ({ data: ('data' in res ? res.data : res) as Category })),

  delete: (id: number) =>
    request<void>(`/categories/${id}`, { method: 'DELETE' }),
};

// ─── Wallets ──────────────────────────────────────────────────────────────────

function normaliseWallet(w: Wallet): Wallet {
  return { ...w, balance: Number(w.balance) };
}

export const walletsApi = {
  list: () => request<{ data: Wallet[] } | Wallet[]>('/wallets').then(res => {
    const arr = Array.isArray(res) ? res : (res.data ?? []);
    return { data: arr.map(normaliseWallet) };
  }),

  get: (id: number) => request<{ data: Wallet } | Wallet>(`/wallets/${id}`).then(res =>
    ({ data: normaliseWallet(('data' in res ? res.data : res) as Wallet) })
  ),

  create: (body: Omit<Wallet, 'id' | 'created_at' | 'updated_at'>) =>
    request<{ data: Wallet } | Wallet>('/wallets', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(res => ({ data: normaliseWallet(('data' in res ? res.data : res) as Wallet) })),

  update: (id: number, body: Partial<Omit<Wallet, 'id'>>) =>
    request<{ data: Wallet } | Wallet>(`/wallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }).then(res => ({ data: normaliseWallet(('data' in res ? res.data : res) as Wallet) })),

  delete: (id: number) =>
    request<void>(`/wallets/${id}`, { method: 'DELETE' }),
};

// ─── Transactions ─────────────────────────────────────────────────────────────

function normaliseTransaction(t: Transaction): Transaction {
  return { ...t, amount: Number(t.amount) };
}

export const transactionsApi = {
  list: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.wallet_id) params.set('wallet_id', String(filters.wallet_id));
    if (filters?.category_id) params.set('category_id', String(filters.category_id));
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    const qs = params.toString();
    return request<{ data: Transaction[] } | Transaction[]>(
      `/transactions${qs ? `?${qs}` : ''}`
    ).then(res => {
      const arr = Array.isArray(res) ? res : (res.data ?? []);
      return { data: arr.map(normaliseTransaction) };
    });
  },

  get: (id: number) => request<{ data: Transaction } | Transaction>(`/transactions/${id}`).then(res =>
    ({ data: ('data' in res ? res.data : res) as Transaction })
  ),

  create: (body: {
    wallet_id: number;
    category_id: number;
    type: 'income' | 'expense';
    amount: number;
    title: string;
    note?: string;
    transaction_date: string;
  }) =>
    request<{ data: Transaction } | Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(res => ({ data: ('data' in res ? res.data : res) as Transaction })),

  update: (
    id: number,
    body: Partial<{ title: string; amount: number; note: string; transaction_date: string }>
  ) =>
    request<{ data: Transaction } | Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }).then(res => ({ data: ('data' in res ? res.data : res) as Transaction })),

  delete: (id: number) =>
    request<void>(`/transactions/${id}`, { method: 'DELETE' }),
};
