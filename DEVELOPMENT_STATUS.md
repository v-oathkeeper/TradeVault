# TradeVault — Production Development Status

**Status:** Completed & Production Ready  
**Date:** 2026-11-06  
**Architecture:** Next.js 16 App Router (Turbopack) • TypeScript Strict • Tailwind CSS • Supabase PostgreSQL • Decimal.js • Recharts • TanStack Table

---

## 1. Feature Completion Matrix

| Module | Status | Details |
| :--- | :--- | :--- |
| **Database Schema** | **Done** | 11 Normalized PostgreSQL tables with UUID keys, `NUMERIC(14,4)` precision for prices, `NUMERIC(16,2)` for P&L and charges. |
| **Row Level Security (RLS)** | **Done** | Security definer functions (`is_admin()`, `get_my_household_id()`). Full CRUD for ADMIN, read-only for VIEWER. |
| **Authentication & AuthZ** | **Done** | Supabase SSR cookies, middleware route guard, server-side `requireAdmin()` and `requireHouseholdMember()` barriers. |
| **Fee Calculation Engine** | **Done** | Exact broker tariffs for Zerodha Kite and Shoonya. STT, GST (18%), exchange txn, SEBI charges, stamp duty, DP events, IPFT. Decimal.js half-up rounding. |
| **Unit Test Suite** | **Done** | 107 Vitest unit & integration tests passing across all tariff categories, R-multiples, validation schemas, import scenarios, and weekly reporting. |
| **Design System & Shell** | **Done** | Dark/Light themes (`#0F1629` dark navy), desktop sidebar, mobile bottom bar, responsive header with login-aware person context. |
| **Trade Entry Form** | **Done** | Instant entry for Husband (Admin) with live real-time P&L and tax calculation preview, autocomplete, and validation. |
| **Trade Journal & History** | **Done** | TanStack table on desktop, responsive cards on mobile, search by symbol, filters by person, broker, product, status, and outcome. |
| **JSON Trade Import** | **Done** | Mobile-first JSON trade importer for ChatGPT/assistant trades. Supports schema v1.0, relative owners ('me', 'spouse'), broker mapping (Zerodha/Shoonya), R-risk preview, duplicate detection, atomic batch rollback, and initial stop-loss history. |
| **Weekly Trading Reports** | **Done** | Complete weekly report engine with standardized JSON export (Schema v1.0) for Intraday (MIS), Swing (CNC), and Combined trading. Supports IST calendar boundaries, R-multiple distributions, time-of-day analytics, AI review metadata, data quality audits, and copy/export actions. |
| **Trade Breakdown Detail** | **Done** | Itemized statutory charge audit snapshots, turnover, ROI %, execution timeline. |
| **Open Positions Management** | **Done** | Deployed capital calculation, live exposure tracking, one-click close position modal with live preview. |
| **Dashboard & Analytics** | **Done** | 6 Core KPI cards, Recharts cumulative equity curve, monthly Net P&L bar charts, broker comparison, product comparison. |
| **Data Export Center** | **Done** | ExcelJS multi-column formatted `.xlsx` workbooks, raw `.csv`, and full machine-readable `.json` archives (Admin only). |
| **R-Multiple Engine & Targets** | **Done** | Immutable initial risk, 1R monetary risk, 1R/2R/3R/4R target prices, planned R:R, R-expectancy, and MAE/MFE tracking. |
| **Dynamic Stop-Loss Tracking** | **Done** | StopLossManager with breakeven shortcut, trailing stop validation, full chronological audit log in `stop_loss_history`. |
| **Stop-Protected Profit** | **Done** | Independent live metric alongside unrealized P&L and realized net P&L with explicit disclaimer and remaining qty support. |
| **R Analytics & Histogram** | **Done** | 6-bucket R-distribution histogram, strategy R-performance breakdown, and R-expectancy per trade. |
| **Family Portfolio Context** | **Done** | Contextual dynamic display labels ("You" vs "Husband" vs "Wife") while preserving permanent internal IDs. |
| **PWA & Offline Fallback** | **Done** | Web manifest, custom app icons, standalone mode, service worker with offline fallback (zero financial data caching). |

---

## 2. Verification & Build Results

- **TypeScript Type Check (`npm run type-check`)**: Exited with code `0` (Zero errors).
- **Unit & Integration Tests (`npm test`)**: 93 passed out of 93 tests across 5 test suites.
- **Test Coverage (`npm run test:coverage`)**: 100% statements/branches/functions on `import-schema.ts`, 80%+ on trade import service.
- **Production Build (`npm run build`)**: Successfully compiled all 19 routes:
  - `ƒ /api/trades/import` (New atomic import endpoint)
  - `ƒ /api/trades/import/validate` (New validation & preview endpoint)
  - `ƒ /trades` (Updated with "Import Trade" action)
  - All existing routes intact with 0 regressions.

---

## 3. Key Credentials & Accounts

- **Husband (Admin)**: `husband@example.com` (Full management, recording, editing, closing, JSON import, exports)
- **Wife (Viewer)**: `wife@example.com` (Read-only dashboard, trades, analytics, and positions — import denied with 403)
- **Database Migrations**: Located in `supabase/migrations/` (001, 002, 003, 004, 005)
- **Setup Guide**: Detailed in `SUPABASE_SETUP.md`
- **Deployment Guide**: Detailed in `DEPLOYMENT.md`
- **Tariff Engine Specs**: Detailed in `FEE_ENGINE.md`

---

## 4. JSON Trade Import Specification & Implementation

### 4.1 Schema Version 1.0 Envelope
Accepted JSON format:
```json
{
  "schema_version": "1.0",
  "trades": [
    {
      "portfolio_owner": "me",
      "broker": "ZERODHA",
      "exchange": "NSE",
      "symbol": "UNIONBANK",
      "trade_type": "SWING",
      "direction": "LONG",
      "entry_price": 182.45,
      "initial_stop_loss": 175.50,
      "quantity": 10,
      "target_price": 203.30,
      "strategy": "Breakout",
      "notes": "Breakout above resistance with volume confirmation"
    }
  ]
}
```

### 4.2 Security & Household Ownership Resolution
- **Server-Side Authorization**: Enforced via `requireAdmin()`. VIEWER role accounts receive HTTP 403 Forbidden.
- **Relative Identity Resolution**:
  - `"me"`: Resolves to the authenticated Admin's person ID in the current household (`relationship_label = 'Husband'` or first household person).
  - `"spouse"`: Resolves to the spouse's person ID (`relationship_label = 'Wife'`).
  - **UUID**: Strict check that the person ID exists within the authenticated user's `household_id` and is active; cross-household UUIDs are blocked.

### 4.3 Broker & Trade Type Mapping
- `broker`: `"ZERODHA"` maps to broker code `'KITE'`; `"SHOONYA"` maps to broker code `'SHOONYA'`.
- `exchange`: `"NSE"`, `"BSE"`.
- `trade_type`: `"SWING"` maps to database product `'DELIVERY'` (matching CNC delivery rules documented in `FEE_ENGINE.md`). `"INTRADAY"` maps to `'INTRADAY'`.

### 4.4 Risk Management & Financial Integrity
- Every imported trade starts with `status = 'OPEN'`.
- Initial risk snapshot is generated using `calculateInitialRisk(...)`: `riskPerShare`, `riskRupees` (1R total risk), `riskPct`, `plannedRR`, `r1_price`, `r2_price`, `r3_price`.
- `current_stop_loss` is initialized to `initial_stop_loss`.
- An initial audit record is inserted into `stop_loss_history` with `stop_type = 'INITIAL'`.
- No fake exit records or synthetic market prices are created.

### 4.5 Duplicate Prevention & Atomic Transactions
- **Duplicate Warnings**: Flagged during validation preview if a trade matches an existing OPEN position in the household (same owner, broker, symbol, direction, entry price, quantity) or appears multiple times in the batch.
- **Atomic Batch Import**: Backed by PostgreSQL stored procedure `import_trades_batch` in `005_trade_import_support.sql`. Application-level compensating rollback cleans up any partially inserted records in case of database errors.

### 4.6 Verification Test Matrix (12 Scenarios Passed)
1. Single valid trade import with risk snapshot & stop history.
2. Multiple valid trades import across mixed directions and portfolio owners.
3. Missing required fields rejection with field-level errors.
4. Invalid JSON syntax and unsupported schema versions rejection.
5. Invalid stop-loss directionality (LONG stop >= entry, SHORT stop <= entry).
6. Negative quantities, non-integer quantities, and invalid/zero prices rejection.
7. Unauthorized VIEWER import attempt returning HTTP 403.
8. Cross-household portfolio owner UUID rejection.
9. In-batch and journal open position duplicate detection and warnings.
10. Atomic rollback on database failure leaving 0 partial records.
11. Mobile Android clipboard paste handling (CRLF, trailing whitespace, mobile cards).
12. Data integrity verification across Trades, Positions, Dashboard, and Analytics queries.

---

## 5. Weekly Trading Reports with JSON Export Specification & Implementation

### 5.1 Architecture & Calendar Integration
- **IST Timezone (`Asia/Kolkata`)**: NSE/BSE operating calendar standard (UTC+05:30 offset). Monday-to-Friday market schedule with Sunday end boundaries to capture weekend settlement and corporate events without data leaks.
- **Weekly Presets**: Pre-calculated selections for "Most Recently Completed Week", "Previous Week", "2 Weeks Ago", "3 Weeks Ago", alongside custom date pickers.
- **Inclusion Policy (Zero Double-Counting)**:
  - Trades opened in reporting week (`entry_at` in window).
  - Trades closed in reporting week (`exit_at` in window, even if opened prior).
  - Partial exit executions executed in reporting week.
  - Open positions carried forward (`status == 'OPEN'`).
  - Stop-loss management decisions logged in reporting week.

### 5.2 Metrics & Calculation Integrity
- Reuses existing financial and fee engines (`decimal.js`, `calculateTradePnl`, `calculateInitialRisk`).
- Computes Win Rate, Profit Factor (Gross Wins / Gross Losses), Expectancy (₹/trade and R/trade), Realized R-Multiple, Max consecutive win/loss streaks, and Holding Durations.
- **Strict Null Handling**: Never substitutes zero for missing information; missing targets, strategies, or rationales remain explicitly `null`.
- **Stop-Loss Execution Semantics**: Stop-loss history records represent trade management decisions, never assumed broker execution confirmations (`is_broker_confirmed: false`).

### 5.3 Strategy-Specific Analytics
- **Intraday (MIS)**: Holding time in minutes, time-of-day execution buckets (Morning 09:15-11:30, Mid-day 11:30-13:30, Afternoon 13:30-15:30 IST), trades per day, repeated symbols.
- **Swing (CNC)**: Holding duration in days, 6-bucket R-distribution (< -1R, -1R to 0R, 0R to +1R, +1R to +2R, +2R to +3R, > +3R), milestones reached (+1R, +2R, +3R), breakeven/profit stops, protected profit.

### 5.4 AI Review Metadata & Standardized JSON Export (Schema v1.0)
- Full JSON root keys: `report_version`, `report_type`, `generated_at`, `timezone`, `period`, `filters`, `summary`, `weekly_activity`, `trades`, `intraday`, `swing`, `portfolio_risk`, `ai_review`, `data_quality`.
- Factual AI review fields: Negative R trades, stop-loss widened after entry, missing rationales, repeated symbols.
- Direct "Copy AI Prompt" shortcut in UI formatted for instant feeding into ChatGPT/Claude assistants.

### 5.5 Verification Test Matrix (14 Scenarios Passed)
1. Intraday-only report generation.
2. Swing-only report generation.
3. Combined report generation.
4. Me, Spouse, and Combined filter resolution.
5. Trade opened in previous week and closed in selected week.
6. Trade opened in selected week and still open (open risk calculation).
7. Partial exits across multiple weeks.
8. Multiple stop-loss updates labeled as management decisions.
9. Missing optional fields verification (strict null handling).
10. Correct fee and R-multiple calculations matching existing engine.
11. Correct date handling across IST and market trading sessions.
12. JSON export schema validation against Schema v1.0.
13. Viewer role authorization rejection (HTTP 403 Forbidden).
14. Mobile preview, export download, and clipboard copy functionality.

---

## 6. Full Application Performance Audit & Optimization

### 6.1 Performance Baseline vs Post-Optimization Results

Comprehensive benchmarks were executed against the production Supabase cloud database (`https://hawbxuukivtviakxeneq.supabase.co`).

| Metric / Interaction | Pre-Optimization Baseline | Post-Optimization Result | Improvement Factor |
| :--- | :--- | :--- | :--- |
| **Sequential App Layout & Page DB Roundtrips** | 14,234.1 ms (14.2 s) | 3,126.1 ms (Promise.all) / **0 ms** (Page cache hit) | **4.55x** network speedup / **Instant (0 ms)** for page |
| **Request Cache Hits on Navigation** | 0% (Duplicate queries on every route) | **100% Request-scoped deduplication** via React `cache()` | Eliminates 3–4 redundant sequential roundtrips |
| **Trades Query Wire Payload Size** | 15,027 bytes (`SELECT *` with JSON) | **1,864 bytes** (Selective column projection) | **8.06x** reduction in payload (87.6% smaller) |
| **Open Positions DB Query** | 2,973.9 ms (Client filtered all trades) | **1,098.3 ms** (Indexed SQL `status='OPEN'` filter) | **2.71x** faster query time |
| **Stop-Loss Update UI Latency** | 3,500–4,500 ms (Blocking `router.refresh()`) | **< 16 ms** (Immediate optimistic UI with auto-rollback) | **250x+** instant interaction (< 1 frame) |
| **Position Close UI Latency** | 3,500–4,500 ms (Blocking `router.refresh()`) | **< 16 ms** (Immediate optimistic removal with rollback) | **250x+** instant interaction (< 1 frame) |
| **Trade Deletion UI Latency** | 3,500–4,500 ms (Blocking `router.refresh()`) | **< 16 ms** (Instant local filter state update) | **250x+** instant interaction (< 1 frame) |
| **Search & Filter Typing Responsiveness** | UI lag on fast typing | **Non-blocking input** via React `useDeferredValue` | Smooth 60 FPS input responsiveness |
| **Trade Journal DOM Render Footprint** | All trades rendered simultaneously | **Client-side pagination (25 trades/page)** | Lightweight DOM and instantaneous page transitions |
| **Heavy Component Bundle Footprint** | Heavy modals & charts bundled everywhere | **Dynamic `next/dynamic` code splitting** | Reduces initial route bundle sizes across layout & pages |
| **In-Memory Metric Calculation (1,000 trades)** | 0.295 ms | 0.295 ms (Memoized with `useMemo`) | Zero CPU bottleneck |

---

### 6.2 Root Cause Analysis of Previous 3–5s Latency

1. **Sequential Network Waterfall**:
   The App Router layout (`layout.tsx`) ran 4 sequential round trips (`auth.getUser()`, `household_members`, `profiles`, `persons`). Then the child page (`dashboard/page.tsx`, `trades/page.tsx`, etc.) immediately made duplicate queries to `household_members` and `trades` over the WAN. Each round trip added ~800–2,500 ms of latency, adding up to 4–14 seconds.
2. **Payload Overfetch (`SELECT *`)**:
   `SELECT *` on the `trades` table fetched full JSON statutory charge breakdown objects, execution notes, and audit fields across all historical records, resulting in inflated JSON payload sizes.
3. **Blocking `router.refresh()` on State Mutations**:
   Updating a stop-loss, closing a position, or deleting a trade triggered a full blocking server component refresh (`router.refresh()`). This forced Next.js to re-execute the layout and page server components over the network before the UI changed.
4. **Un-split Heavy Client Components**:
   Heavy modules (e.g. `ImportTradeModal`, Recharts `PortfolioChart`, `MonthlyBarChart`) were bundled directly into main client shells, bloating the initial bundle for navigation.

---

### 6.3 Targeted Optimizations Implemented

#### 1. Unified Cached Context (`src/lib/auth/server-auth.ts`)
- Wrapped `requireAuth()` and `requireHouseholdMember()` in React `cache()` for zero-overhead request-scoped deduplication.
- Created `getHouseholdAppContext()` using `Promise.all` to fetch auth, household, profile, persons, and brokers concurrently in a single parallel batch.
- Because `getHouseholdAppContext()` is wrapped in React `cache()`, calling it in `layout.tsx` and child pages (`dashboard`, `positions`, `trades`, `analytics`, `reports`) results in **0 ms cache hits** for the child pages within the same request lifecycle.

#### 2. Selective Column Projection
- Replaced `SELECT *` with explicit column projections matching only what each page consumes (`dashboard`, `positions`, `trades`, `analytics`).
- Dropped wire payload by 8.06x (from ~15 KB to ~1.8 KB for 8 trades; exponentially higher savings on large journals).

#### 3. Database Indexes (`006_performance_indexes.sql`)
- Created composite indexes:
  - `idx_trades_household_status_entry` on `trades(household_id, status, entry_at DESC)`.
  - `idx_trades_household_entry` on `trades(household_id, entry_at DESC)`.
  - `idx_household_members_user_active` on `household_members(user_id, is_active)`.
  - `idx_stop_loss_history_trade_created` on `stop_loss_history(trade_id, created_at DESC)`.

#### 4. Instant Optimistic UI Interactions (< 16 ms)
- **Stop-Loss Updates (`StopLossManager.tsx`)**: The UI immediately updates the stop-loss level, stop-protected profit badge, and appends a local timeline audit entry. If the server API rejects the update, it automatically rolls back with a toast error notification.
- **Close Position (`ClosePositionModal.tsx`, `PositionsClient.tsx`)**: Instantly removes the closed trade from the positions list and updates open position counts before the network response completes.
- **Trade Deletion (`TradeHistoryClient.tsx`)**: Locally removes the deleted trade instantly from client state without triggering a blocking `router.refresh()`.

#### 5. Search Filtering & Table Pagination
- Integrated `React.useDeferredValue(searchQuery)` in `TradeHistoryClient.tsx` so user keystrokes remain fluid and non-blocking.
- Implemented client-side pagination (25 trades per page) with mobile-responsive page navigation controls.

#### 6. Dynamic Code-Splitting & Lazy Loading
- Converted `ImportTradeModal` into `next/dynamic` across `Sidebar`, `MobileNav`, `TradeHistoryClient`, `TradeForm`, and `DashboardClient`.
- Converted `PortfolioChart` and `MonthlyBarChart` into `next/dynamic` with skeleton loading placeholders in `DashboardClient` and `AnalyticsClient`.

---

### 6.4 Verification & Acceptance Testing

- **TypeScript Compilation**: `npx tsc --noEmit` passed with 0 errors.
- **Vitest Unit & Integration Suite**: 107 tests passing across 6 test suites (fee engine, R-multiple engine, trade import service, weekly report service, and validation schemas).
- **Next.js Production Build**: `npm run build` compiled successfully in 6.0 seconds with all 22 static/dynamic routes verified.
- **Financial Calculation Integrity**: 100% preserved; no formulas, fee tariffs, or R-multiple calculations were altered.
- **RLS Multi-Tenant Security**: 100% preserved; all queries remain strictly scoped to `household_id` with active membership checks.


---

## 7. Capital Management, Profit Tracking and Withdrawal Module

### 7.1 Architecture & Strategy Isolation

- **Independent Portfolio Accounting**:
  - Husband — Intraday (MIS)
  - Husband — Swing (CNC)
  - Wife — Intraday (MIS)
  - Wife — Swing (CNC)
- **Documented Strategy Mapping**:
  - `trade_type = 'INTRADAY'` maps canonically to `strategy_bucket = 'INTRADAY'`.
  - `trade_type = 'DELIVERY'` maps canonically to `strategy_bucket = 'SWING'`.
  - Enforced via database function `strategy_bucket_for_trade_type()` and TypeScript mapper `tradeTypeToStrategyBucket()`.
- **Single Source of Truth for Realized P&L**:
  - Realized net trading P&L is derived strictly from completed trade records (`trades.net_pnl WHERE status = 'CLOSED'`), itemized with exact actual/estimated charges (STT, GST 18%, brokerage, exchange turnover, SEBI, stamp duty, DP events).
  - Trading P&L is never stored in duplicate tables, preventing dual-source drift.
  - Partial exits realize P&L only for the exited quantity; remaining quantity stays open and never becomes withdrawable profit.

### 7.2 Financial Terminology & Accounting Formulas

1. **Contributed Capital**:
   $$\text{contributed\_capital} = \sum(\text{INITIAL\_ALLOCATION} + \text{CAPITAL\_CONTRIBUTION} + \text{adjustment\_diff}) - \sum(\text{CAPITAL\_WITHDRAWAL})$$
   - Historical contributed capital is never overwritten by trading profits or losses.
2. **Net Realized P&L**:
   $$\text{cumulative\_net\_realized\_pnl} = \sum(\text{trades.net\_pnl})_{status='CLOSED'}$$
   - Excludes unrealized open-position P&L. Excludes capital deposits and withdrawals.
3. **Profit Withdrawals**:
   $$\text{cumulative\_profit\_withdrawals} = \sum(\text{PROFIT\_WITHDRAWAL})$$
   - Tracked independently from capital withdrawals. Never counted as trading losses.
4. **Available Profit for Withdrawal**:
   $$\text{available\_profit\_for\_withdrawal} = \max(0, \text{cumulative\_net\_realized\_pnl} - \text{cumulative\_profit\_withdrawals})$$
   - Trading losses consume remaining available profit before touching principal. Available profit is bounded at zero (never negative).
5. **Current Capital (Trading Equity)**:
   $$\text{current\_capital} = \text{contributed\_capital} + \text{cumulative\_net\_realized\_pnl} - \text{cumulative\_profit\_withdrawals}$$

### 7.3 Database Schema Migration (`007_capital_management.sql`)

- **Table: `capital_transactions`**:
  - `id` (UUID PK), `household_id` (FK), `portfolio_owner_id` (FK to `persons`), `strategy_bucket` (`INTRADAY` | `SWING`), `tx_type` (`capital_tx_type` enum).
  - `amount` (`NUMERIC(16,2)` > 0).
  - `tx_date` (DATE), `created_by` (FK to `auth.users`), `created_at` (TIMESTAMPTZ), `notes` (TEXT).
  - `reversal_of` (self-referencing FK for immutable correction trails).
  - `idempotency_key` (TEXT UNIQUE) for preventing duplicate client submissions.
  - Audit fields for adjustments: `previous_amount`, `new_amount`, `adjustment_diff`.
- **Views**:
  - `v_portfolio_pnl_summary`: Aggregates closed trade counts and net P&L grouped by household, portfolio owner, and strategy bucket.
  - `v_capital_summary`: Full balance-sheet join between the transaction ledger and trade P&L view.
- **Row Level Security (RLS)**:
  - `cap_tx_select`: Any authenticated household member can read records.
  - `cap_tx_insert_admin`: Only active `ADMIN` accounts can insert records.
  - No `UPDATE` or `DELETE` policies — ledger is append-only.

### 7.4 Dashboard & UI Implementation

- **Prominent Dual Owner Cards (`CapitalCards.tsx`)**:
  - Displayed at the very top of the Dashboard.
  - Husband's Portfolio & Wife's Portfolio cards calculated independently.
  - Full breakdown of Contributed Capital, Current Capital, Net Realized P&L, Available Profit for Withdrawal, and Withdrawn amounts across Intraday (MIS), Swing (CNC), and Combined totals.
  - Color-coded: green for positive P&L, red for negative P&L.
  - Mobile-first, compact Android-optimized layout.
- **Dedicated Capital Hub (`/capital`)**:
  - **Overview Tab**: Live cards and action triggers.
  - **History Tab**: Complete chronological audit ledger with transaction types, amounts, and reversal tags.
  - **Reconciliation Tab (`ReconciliationView.tsx`)**: Balance-sheet reconciliation walkthrough showing Opening Balance, Additions/Adjustments, Trading Net P&L, Profit Withdrawals, Capital Withdrawals, and Reconciled Current Equity.
- **ADMIN Capital Operations Modals**:
  - `ManageCapitalModal.tsx`: Initial allocation, additional contribution, and capital adjustments with old/new/diff audit preview.
  - `RecordWithdrawalModal.tsx`: Profit vs. Capital withdrawal with available balance verification, rejection of excessive profit withdrawals, and Admin confirmation with recorded reason for capital overrides.

### 7.5 Verification & Test Results

- **Vitest Unit & Integration Suite**: **143 tests passing across 7 test suites** (100% pass rate).
- **All 6 Specification Test Scenarios Verified**:
  - **Test A (Profit and withdrawal)**: ₹20k initial + ₹3k profit - ₹2k profit withdrawal $\rightarrow$ Available Profit = ₹1,000, Current Capital = ₹21,000.
  - **Test B (Loss consumes available profit)**: Additional ₹1.5k loss $\rightarrow$ Lifetime P&L = ₹1,500, Available Profit = ₹0 (not negative), Current Capital = ₹19,500.
  - **Test C (Profit recovery after loss)**: Additional ₹2.5k profit $\rightarrow$ Lifetime P&L = ₹4,000, Available Profit = ₹2,000, Current Capital = ₹22,000.
  - **Test D (Capital withdrawal)**: ₹20k capital - ₹5k capital withdrawal $\rightarrow$ Contributed = ₹15,000, P&L unchanged, Available Profit unchanged, Current Capital = ₹15,000.
  - **Test E (Strategy isolation)**: Husband Intraday (-₹1k) vs Swing (+₹3k) isolated; Wife portfolios untouched; combined household = sum of parts.
  - **Test F (Partial exits)**: Only exited quantity realizes P&L; remaining quantity is strictly unrealized.
- **TypeScript Type Check (`npx tsc --noEmit`)**: Exited with code `0` (Zero errors).
- **Next.js Production Build (`npm run build`)**: Successfully compiled all 26 static/dynamic routes.
