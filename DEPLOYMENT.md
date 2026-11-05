# TradeVault — Vercel & Production Deployment Guide

TradeVault is built with Next.js 16 App Router, TypeScript strict mode, Tailwind CSS, and Supabase SSR. It deploys seamlessly to Vercel with zero microservice overhead.

---

## 1. Prerequisites

- A [Vercel](https://vercel.com) account.
- A [Supabase](https://supabase.com) project created following [SUPABASE_SETUP.md](file:///c:/New%20folder/oathkeeper/TradeVault/SUPABASE_SETUP.md).
- A GitHub repository containing the TradeVault codebase.

---

## 2. Environment Variables Configuration

In your Vercel Project Settings under **Environment Variables**, configure:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Public Anonymous API Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secret Service Role API Key (Server only) | `eyJhbGciOi...` |
| `NEXT_PUBLIC_APP_URL` | Production application URL | `https://tradevault.vercel.app` |

---

## 3. Deployment Steps via Vercel Dashboard

1. Push your repository to GitHub.
2. In Vercel, click **Add New...** -> **Project**.
3. Import your `TradeVault` repository.
4. Select Framework Preset: **Next.js**.
5. Leave Root Directory as `./`.
6. Expand **Environment Variables** and enter the 4 variables above.
7. Click **Deploy**.

Vercel will run `next build`, generate the optimized production bundles, and deploy to their edge network.

---

## 4. Setting up Custom Domain (Optional)

1. In your Vercel project, go to **Settings** -> **Domains**.
2. Add your custom domain (e.g. `trades.yourfamily.com`).
3. Add the suggested CNAME or A records to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.).
4. Update `NEXT_PUBLIC_APP_URL` to match your custom domain.
5. In Supabase under **Authentication** -> **URL Configuration**, add your custom domain to **Site URL** and **Redirect URLs**.

---

## 5. PWA Installation

Once deployed to HTTPS on Vercel:
- **Desktop (Chrome/Edge)**: Click the **Install** icon in the address bar.
- **Android (Chrome)**: Tap the banner **"Add TradeVault to Home screen"**.
- **iOS (Safari)**: Tap the Share button -> **"Add to Home Screen"**.
