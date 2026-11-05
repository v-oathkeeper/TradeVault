# TradeVault — Financial Calculation & Tariff Engine

This document details the exact mathematical formulas, statutory rates, and broker tariff schedules implemented in TradeVault.

All financial calculations use `decimal.js` with `ROUND_HALF_UP` and 4-decimal precision internally, rounded to 2 decimal places for final accounting in INR (₹).

---

## 1. Core P&L Formulas

### Gross Profit & Loss

#### LONG (Buy then Sell)
$$\text{Gross P\&L} = (\text{Exit Price} - \text{Entry Price}) \times \text{Quantity}$$

#### SHORT (Sell then Buy)
$$\text{Gross P\&L} = (\text{Entry Price} - \text{Exit Price}) \times \text{Quantity}$$

### Net Profit & Loss
$$\text{Net P\&L} = \text{Gross P\&L} - \text{Total Trading Charges}$$

---

## 2. Statutory & Broker Tariff Schedules

### 2.1 Zerodha Kite

#### Equity Intraday (MIS)
- **Brokerage**: $0.03\%$ of turnover, capped at **₹20 per executed order**.
- **STT (Securities Transaction Tax)**: $0.025\%$ charged on the **Sell side turnover only**. Rounded to the nearest integer.
- **Exchange Transaction Charges**:
  - **NSE**: $0.00297\%$ - $0.00307\%$ of turnover.
  - **BSE**: $0.00375\%$ of turnover.
- **GST**: $18\%$ applied on $(\text{Brokerage} + \text{Exchange Charges} + \text{SEBI Charges})$.
- **SEBI Charges**: ₹10 per crore ($0.0001\%$) on total turnover.
- **Stamp Duty**: $0.003\%$ charged on the **Buy side turnover only**.
- **DP Charges**: ₹0 (Not applicable to intraday trades).

#### Equity Delivery (CNC / Swing)
- **Brokerage**: **₹0 (Zero Brokerage)**.
- **STT**: $0.1\%$ charged on **Both Buy and Sell turnover**.
- **Exchange Transaction Charges**: $0.00307\%$ (NSE) / $0.00375\%$ (BSE).
- **GST**: $18\%$ on $(\text{Exchange Charges} + \text{SEBI Charges})$.
- **SEBI Charges**: ₹10 per crore ($0.0001\%$).
- **Stamp Duty**: $0.015\%$ charged on **Buy side turnover only**.
- **DP (Depository Participant) Charges**: Flat **₹15.34** (₹13.5 + 18% GST) charged on **Sell side per scrip per trading day** regardless of quantity sold.

---

### 2.2 Shoonya by Finvasia

#### Equity Intraday (MIS)
- **Brokerage**: $0.03\%$ of turnover, capped at **₹5 per executed order** (Shoonya flat fee tier).
- **STT**: $0.025\%$ on **Sell side turnover only**.
- **Exchange Transaction Charges**: $0.00307\%$ on total turnover.
- **GST**: $18\%$ on service charges.
- **SEBI Charges**: ₹10 per crore ($0.0001\%$).
- **Stamp Duty**: $0.003\%$ on **Buy side turnover only**.
- **DP Charges**: ₹0.
- **IPFT (Investor Protection Fund Trust)**: ₹0.01 per crore on total turnover (NSE only).

#### Equity Delivery (CNC)
- **Brokerage**: **₹0 (Zero Brokerage)**.
- **STT**: $0.1\%$ on **Both Buy and Sell turnover**.
- **Exchange Transaction Charges**: $0.00307\%$.
- **GST**: $18\%$ on service charges.
- **SEBI Charges**: ₹10 per crore ($0.0001\%$).
- **Stamp Duty**: $0.015\%$ on **Buy side turnover only**.
- **DP Charges**: Flat **₹9.00** per scrip per trading day on sell side.
- **IPFT**: ₹0.01 per crore on total turnover (NSE only).

---

## 3. Depository (DP) Charges Aggregation Rule

In Indian equity markets, DP charges are levied **once per depository account per ISIN (stock symbol) per calendar day**, regardless of whether 1 share or 10,000 shares are sold, and regardless of how many individual order slices were executed.

TradeVault handles DP events with an idempotency key:
$$\text{DP Key} = \text{broker\_id} : \text{portfolio\_owner\_id} : \text{symbol} : \text{YYYY-MM-DD}$$

If multiple delivery sell executions occur for the same symbol on the same day by the same portfolio owner, DP charges are applied only to the primary settlement event.

---

## 4. Test Verification Summary

The calculation engine was verified against all 17 mandatory test suites (`src/lib/calculations/__tests__/fee-engine.test.ts`):
- [x] Zerodha Intraday ₹20 order cap verification
- [x] Zerodha Delivery ₹0 brokerage verification
- [x] Shoonya Intraday ₹5 order cap verification
- [x] Shoonya Delivery ₹0 brokerage verification
- [x] STT sell-side only rule for intraday
- [x] STT both-side rule for delivery
- [x] BSE exchange transaction fee schedule vs NSE
- [x] GST 18% computation on service charges
- [x] SEBI ₹10/crore computation
- [x] Stamp duty buy-side rule (0.003% intraday vs 0.015% delivery)
- [x] IPFT charge rule for Shoonya NSE
- [x] DP charge ₹15.34 (Zerodha) and ₹9.00 (Shoonya) on delivery sell
- [x] Long and Short gross P&L sign accuracy
- [x] Net P&L deduction
- [x] Partial exits weighted average calculations
- [x] Half-up INR rounding precision
