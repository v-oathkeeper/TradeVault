# TradeVault — Supabase Project Creation & Configuration Guide

This guide walks you step-by-step through setting up your free Supabase PostgreSQL cloud database, executing database migrations, configuring Row Level Security (RLS), and provisioning the Husband (Admin) and Wife (Viewer) user accounts.

---

## 1. Create a New Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and click **Sign Up** or **Sign In** (using your GitHub or Google account).
2. Once on your Supabase dashboard, click **New Project**.
3. Select an organization (or create one, e.g., "TradeVault Family").
4. Fill in the project details:
   - **Name**: `tradevault`
   - **Database Password**: Choose a strong password and save it securely in a password manager.
   - **Region**: Choose **Mumbai (ap-south-1)** or **Singapore (ap-southeast-1)** for lowest latency in India.
   - **Pricing Plan**: **Free tier** (includes 500MB database, 50,000 monthly active users, automated backups).
5. Click **Create new project**. Supabase will take 1–2 minutes to provision your database.

---

## 2. Obtain API Keys & Connection Credentials

1. In your project dashboard, navigate to **Project Settings** (gear icon at the bottom of the left sidebar).
2. Go to **API**:
   - Copy the **Project URL** (e.g., `https://abcdefghijklm.supabase.co`).
   - Under **Project API keys**, copy the **`anon` `public`** key.
   - Under **Project API keys**, reveal and copy the **`service_role` `secret`** key.
3. Open `c:\New folder\oathkeeper\TradeVault\.env.local` (or copy `.env.local.example`) and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Execute Database Migrations

You will run the 3 SQL migration scripts located in the `supabase/migrations/` directory using the Supabase **SQL Editor**.

1. In the Supabase left sidebar, click **SQL Editor**.
2. Click **New Query**.

### Migration Step 1: Core Schema & Enums
- Copy the entire contents of `supabase/migrations/001_initial_schema.sql`.
- Paste into the SQL editor and click **Run** (or `Ctrl+Enter`).
- Ensure it displays `Success. No rows returned`.
- *This creates:* `households`, `profiles`, `household_members`, `persons`, `brokers`, `broker_fee_rates`, `trades`, `trade_executions`, `trade_charge_breakdowns`, `demat_charge_events`, `actual_charge_reconciliations`, `cash_movements`, `app_settings`, triggers, and enums.

### Migration Step 2: Row Level Security (RLS) & Helper Functions
- In the SQL Editor, click **New Query**.
- Copy the entire contents of `supabase/migrations/002_rls_policies.sql`.
- Paste into the SQL editor and click **Run**.
- Ensure it displays `Success. No rows returned`.
- *This creates:* Security definer functions (`is_admin()`, `get_my_household_id()`, `get_my_portfolio_owner_id()`) and RLS policies enforcing full access for ADMIN and read-only access for VIEWER.

### Migration Step 3: Seed Data (Tariffs, Household, Persons, Brokers)
- In the SQL Editor, click **New Query**.
- Copy the entire contents of `supabase/migrations/003_seed_data.sql`.
- Paste into the SQL editor and click **Run**.
- Ensure it displays `Success. No rows returned`.
- *This provisions:*
  - Household: "Family Trading Vault" (`id: 00000000-0000-0000-0000-000000000001`)
  - Persons: Husband (`00000000-0000-0000-0000-000000000011`) & Wife (`00000000-0000-0000-0000-000000000012`)
  - Brokers: Zerodha Kite (`00000000-0000-0000-0000-000000000021`) & Shoonya (`00000000-0000-0000-0000-000000000022`)
  - Complete statutory tariffs: Brokerage caps, STT, Exchange transaction charges, GST, SEBI charges, Stamp duty, DP charges, IPFT.

### Migration Step 4: R-Multiple Tracking & Dynamic Stop-Loss Schema
- In the SQL Editor, click **New Query**.
- Copy the entire contents of `supabase/migrations/004_r_multiple_schema.sql`.
- Paste into the SQL editor and click **Run**.
- Ensure it displays `Success. No rows returned`.
- *This adds:*
  - Risk definition columns to `trades` (`initial_stop_loss`, `initial_risk_per_share`, `initial_risk_rupees`, `initial_risk_pct`, `planned_target`, `planned_rr`, `r1_price`, `r2_price`, `r3_price`, `strategy_name`, `current_stop_loss`, `max_adverse_excursion`, `max_favorable_excursion`, `realized_r_multiple`, `gross_r_multiple`).
  - Directional check constraints enforcing stop-loss placement rules.
  - Audit table `stop_loss_history` tracking complete trailing stop timeline and notes with RLS policies.

---

## 4. Provision Husband and Wife Authentication Accounts

1. In the Supabase left sidebar, click **Authentication** -> **Users**.
2. Click **Add user** -> **Create user**:

### Account 1 — Husband (Admin):
- **Email**: `husband@example.com` *(replace with your admin email)*
- **Password**: Create a secure password
- **Auto-confirm user?**: Check **YES** (Auto Confirm)
- Click **Create user**.

### Account 2 — Wife (Viewer):
- **Email**: `wife@example.com` *(replace with your viewer email)*
- **Password**: Create a secure password
- **Auto-confirm user?**: Check **YES** (Auto Confirm)
- Click **Create user**.

---

## 5. Link Authentication Accounts to Household Roles

Run this self-contained SQL script in the **SQL Editor** to ensure the family household, portfolio persons, and user roles are established and linked (replace `husband@example.com` and `wife@example.com` with your actual auth emails):

```sql
-- Step 5a: Ensure Household exists
INSERT INTO households (id, name)
VALUES ('b1000000-0000-0000-0000-000000000001', 'Family Trading Portfolio')
ON CONFLICT (id) DO NOTHING;

-- Step 5b: Ensure Household Settings exist
INSERT INTO app_settings (household_id, default_theme, currency, timezone)
VALUES ('b1000000-0000-0000-0000-000000000001', 'SYSTEM', 'INR', 'Asia/Kolkata')
ON CONFLICT (household_id) DO NOTHING;

-- Step 5c: Ensure Portfolio Owner records exist
INSERT INTO persons (id, household_id, display_name, relationship_label, is_active)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Husband', 'Husband', TRUE),
  ('c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Wife', 'Wife', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Step 5d: Link Husband as ADMIN
INSERT INTO household_members (household_id, user_id, role, is_active)
SELECT 
  'b1000000-0000-0000-0000-000000000001'::uuid,
  id,
  'ADMIN'::user_role,
  true
FROM auth.users
WHERE email = 'husband@example.com'
ON CONFLICT (household_id, user_id) DO UPDATE SET role = 'ADMIN';

-- Set Husband Profile Name
UPDATE profiles 
SET full_name = 'Husband' 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'husband@example.com');

-- Step 5e: Link Wife as VIEWER
INSERT INTO household_members (household_id, user_id, role, is_active)
SELECT 
  'b1000000-0000-0000-0000-000000000001'::uuid,
  id,
  'VIEWER'::user_role,
  true
FROM auth.users
WHERE email = 'wife@example.com'
ON CONFLICT (household_id, user_id) DO UPDATE SET role = 'VIEWER';

-- Set Wife Profile Name
UPDATE profiles 
SET full_name = 'Wife' 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'wife@example.com');
```

---

## 6. Verification Checklist

1. Sign in as Husband (Admin):
   - Verify you see **"You"** and **"Wife"** portfolio tabs.
   - Verify **"Record Trade"** button is present.
   - Verify you can add, edit, and delete trades.
   - Verify **Export Center** is accessible.
2. Sign in as Wife (Viewer):
   - Verify you see **"You"** and **"Husband"** portfolio tabs (dynamic context inversion).
   - Verify all write buttons (Record Trade, Edit, Delete, Close Position) are absent.
   - Verify that attempts to mutate data via API return `403 Forbidden`.
