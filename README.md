# Donrashi — Personal Finance Tracker

A full-stack mobile application for tracking income, expenses, and wallet balances across multiple currencies. Built with a Laravel REST API backend and a React Native (Expo) mobile frontend.

---

## Why This Exists

Managing money across multiple wallets and currencies is painful. Most finance apps are either too simple (no multi-wallet support) or too bloated (subscription-gated features). Donrashi is a lean, self-hosted alternative — you own your data, your server, and your experience.

The app solves three core problems:

- **Where is my money?** — A consolidated balance view across all wallets, auto-converted to your preferred currency using live exchange rates.
- **Where did it go?** — A monthly expense breakdown with a category pie chart so spending patterns are visible at a glance.
- **What happened?** — A filterable transaction history with full CRUD, so records stay accurate and correctable.

---

## Architecture

```
Donrashi/
├── backend/      # Laravel 12 REST API (PHP 8.2)
└── donrashi/     # React Native app (Expo SDK 54)
```

The two parts are intentionally decoupled. The backend is a stateless JSON API; the mobile app is the only client. This makes it straightforward to add a web client later, or swap the mobile framework, without touching server logic.

---

## Tech Stack

### Backend (`backend/`)

| Layer | Technology |
|---|---|
| Framework | Laravel 12 |
| Language | PHP 8.2+ |
| Authentication | JWT via `tymon/jwt-auth` |
| Database | SQLite (dev) / MySQL / PostgreSQL |
| Testing | Pest 3 |
| Code style | Laravel Pint |

### Mobile (`donrashi/`)

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript 5.9 |
| Navigation | Expo Router (file-based) |
| State | React Context API |
| Storage | AsyncStorage (session persistence) |
| Charts | Custom SVG pie chart (react-native-svg) |
| Animations | React Native Reanimated 4 |

---

## Features

### Authentication
- Register and login with email/password
- JWT tokens issued on auth, stored securely in AsyncStorage
- Silent token refresh and background session restore on app start
- Login rate-limiting via Laravel's `throttle:login` middleware

### Wallets
- Create multiple wallets with a name, currency, icon, color, and default flag
- Each wallet tracks its own balance — automatically adjusted when transactions are added, edited, or deleted
- Supports BDT, USD, and EUR per wallet

### Categories
- User-defined income and expense categories
- Each category carries an icon and a color, used throughout the UI
- Full CRUD — create, rename, recolor, delete

### Transactions
- Log income or expenses against any wallet and category
- Fields: title, amount, type, date, optional note
- Filter by type, wallet, category, and date range
- Editing a transaction correctly reverses the old balance effect before applying the new one

### Dashboard (Home Screen)
- **Total balance card** — sum of all wallet balances, converted to your chosen base currency
- **Monthly income vs. expense summary** inside the balance card
- **Expense pie chart** — category breakdown for the current month with percentage labels
- **Transaction list** — all transactions for the current month, most recent first
- Pull-to-refresh on the entire screen
- FAB shortcut to add a new transaction

### Multi-currency
- Live exchange rates fetched from `open.er-api.com` on app start (BDT base)
- Graceful fallback to static rates if the network is unavailable
- Base currency preference persisted to AsyncStorage
- All balances and totals on the dashboard are auto-converted

### Dark mode
- Full dark/light theme support, respects system preference

---

## Data Model

```
User
 ├── has many Wallets    (name, currency, balance, icon, color, is_default)
 ├── has many Categories (name, type: income|expense, icon, color)
 └── has many Transactions
          ├── belongs to Wallet
          ├── belongs to Category
          └── fields: type, amount, title, note, transaction_date
```

All resources are scoped to the authenticated user — no cross-user data leakage is possible at the query level.

---

## API Reference

All endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ✗ | Create account, returns JWT |
| POST | `/auth/login` | ✗ | Login, returns JWT |
| GET | `/auth/me` | ✓ | Get current user |
| POST | `/auth/logout` | ✓ | Invalidate token |
| POST | `/auth/refresh` | ✓ | Rotate JWT |

### Wallets, Categories, Transactions

Each resource exposes the standard Laravel `apiResource` routes:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/{resource}` | List all (user-scoped) |
| POST | `/{resource}` | Create |
| GET | `/{resource}/{id}` | Show single |
| PUT | `/{resource}/{id}` | Update |
| DELETE | `/{resource}/{id}` | Delete |

Transactions support optional query filters: `type`, `wallet_id`, `category_id`, `from`, `to`.

---

## Getting Started

### Backend

```bash
cd backend

# Install dependencies
composer install

# Configure environment
cp .env.example .env
php artisan key:generate
php artisan jwt:secret

# Run migrations
php artisan migrate

# Start dev server
php artisan serve
```

The API will be available at `http://127.0.0.1:8000/api`.

### Mobile

```bash
cd donrashi

# Install dependencies
npm install

# Update the API base URL in services/api.ts
# BASE_URL = 'http://<your-local-ip>:8000/api'

# Start Expo dev server
npx expo start
```

Scan the QR code with Expo Go (for JS-only changes) or run a development build for full native module support:

```bash
npx expo run:android
# or
npx expo run:ios
```

---

## Project Structure

### Backend

```
backend/
├── app/
│   ├── Http/Controllers/   # AuthController, WalletController, CategoryController, TransactionController
│   └── Models/             # User, Wallet, Category, Transaction
├── database/migrations/    # Schema definitions
├── routes/api.php          # All API routes
└── config/jwt.php          # JWT configuration
```

### Mobile

```
donrashi/
├── app/
│   ├── (auth)/             # login.tsx, register.tsx
│   ├── (tabs)/             # index.tsx (dashboard), wallets.tsx, categories.tsx, account.tsx
│   └── add-transaction.tsx
├── components/ui/          # PieChart, Collapsible, IconSymbol
├── context/                # AuthContext, CurrencyContext
├── services/api.ts         # Typed API client (fetch-based)
├── types/index.ts          # Shared TypeScript types
└── hooks/                  # useColorScheme, useThemeColor
```

---

## Security

- Passwords hashed with bcrypt via Laravel's `hashed` cast
- JWTs issued with configurable TTL, invalidated on logout
- All data mutations validate ownership before proceeding — wallets and categories are checked against the authenticated user before a transaction is created or updated
- Login endpoint is rate-limited
- API responses never expose password hashes or internal tokens

---

## Running Tests

```bash
cd backend
composer test
```

Tests are written with Pest. The test suite covers authentication flows and controller behavior.

---

## License

MIT
