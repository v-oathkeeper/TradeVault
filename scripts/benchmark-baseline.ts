import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local manually without dotenv dependency
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runBenchmark() {
  console.log('====================================================');
  console.log('TRADEVAULT PERFORMANCE AUDIT — BASELINE MEASUREMENTS');
  console.log('====================================================');
  console.log(`Supabase URL: ${supabaseUrl}`);

  // Test 1: Measure Individual Sequential Database Queries (Current Layout & Page Pattern)
  console.log('\n--- 1. Current Sequential Layout & Page Fetching Pattern ---');
  const t0 = performance.now();

  const tMem0 = performance.now();
  const { data: members } = await supabase
    .from('household_members')
    .select('household_id, role, user_id')
    .limit(1);
  const tMem = performance.now() - tMem0;
  console.log(`Query 1 (household_members): ${tMem.toFixed(1)} ms`);

  const householdId = members?.[0]?.household_id || 'b1000000-0000-0000-0000-000000000001';
  const userId = members?.[0]?.user_id || '00000000-0000-0000-0000-000000000000';

  const tProf0 = performance.now();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();
  const tProf = performance.now() - tProf0;
  console.log(`Query 2 (profiles): ${tProf.toFixed(1)} ms`);

  const tPers0 = performance.now();
  const { data: persons } = await supabase
    .from('persons')
    .select('id, display_name, relationship_label')
    .eq('household_id', householdId)
    .eq('is_active', true);
  const tPers = performance.now() - tPers0;
  console.log(`Query 3 (persons): ${tPers.toFixed(1)} ms`);

  const tTrades0 = performance.now();
  const { data: allTrades } = await supabase
    .from('trades')
    .select(`
      *,
      portfolio_owner:persons(id, display_name, relationship_label),
      broker:brokers(id, code, name)
    `)
    .eq('household_id', householdId)
    .order('entry_at', { ascending: false });
  const tTrades = performance.now() - tTrades0;
  console.log(`Query 4 (trades SELECT * with deep joins): ${tTrades.toFixed(1)} ms (rows: ${allTrades?.length ?? 0})`);

  const totalSequential = performance.now() - t0;
  console.log(`Total Sequential Latency (Layout + Page): ${totalSequential.toFixed(1)} ms`);

  // Test 2: Measure Parallelized Fetching (Promise.all)
  console.log('\n--- 2. Optimized Parallel Fetching (Promise.all) ---');
  const tPar0 = performance.now();
  await Promise.all([
    supabase.from('household_members').select('household_id, role').limit(1),
    supabase.from('profiles').select('full_name').limit(1),
    supabase.from('persons').select('id, display_name, relationship_label').eq('household_id', householdId),
    supabase.from('trades').select(`
      id, household_id, portfolio_owner_id, broker_id, symbol, exchange,
      trade_type, direction, quantity, entry_price, exit_price, entry_at, exit_at,
      gross_pnl, total_charges, net_pnl, calculation_status, status,
      initial_stop_loss, current_stop_loss, realized_r_multiple,
      portfolio_owner:persons(id, display_name, relationship_label),
      broker:brokers(id, code, name)
    `).eq('household_id', householdId).order('entry_at', { ascending: false }),
  ]);
  const totalParallel = performance.now() - tPar0;
  console.log(`Total Parallelized Latency: ${totalParallel.toFixed(1)} ms (Speedup: ${(totalSequential / totalParallel).toFixed(2)}x)`);

  // Test 3: Selective Columns vs Full SELECT *
  console.log('\n--- 3. SELECT * vs Selective Column Projection ---');
  const tFull0 = performance.now();
  const { data: fullData } = await supabase
    .from('trades')
    .select('*')
    .eq('household_id', householdId);
  const tFull = performance.now() - tFull0;

  const tSel0 = performance.now();
  const { data: selData } = await supabase
    .from('trades')
    .select('id, symbol, trade_type, direction, quantity, entry_price, exit_price, net_pnl, status, entry_at')
    .eq('household_id', householdId);
  const tSel = performance.now() - tSel0;
  console.log(`SELECT * latency: ${tFull.toFixed(1)} ms (Payload size ~${JSON.stringify(fullData || []).length} bytes)`);
  console.log(`Selective Column latency: ${tSel.toFixed(1)} ms (Payload size ~${JSON.stringify(selData || []).length} bytes)`);

  // Test 4: Open Positions Filtering at DB vs In Memory
  console.log('\n--- 4. Open Positions: DB-Level Filter vs Client-Side Filtering ---');
  const tDbOpen0 = performance.now();
  const { data: dbOpenTrades } = await supabase
    .from('trades')
    .select('id, symbol, quantity, entry_price, current_stop_loss, status')
    .eq('household_id', householdId)
    .eq('status', 'OPEN');
  const tDbOpen = performance.now() - tDbOpen0;
  console.log(`DB-Level status='OPEN' query: ${tDbOpen.toFixed(1)} ms (Count: ${dbOpenTrades?.length ?? 0})`);

  // Test 5: In-Memory Financial Engine & KPI Aggregation
  console.log('\n--- 5. In-Memory Calculation Benchmarks (1000 simulated trades) ---');
  const dummyTrades: any[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `trade-${i}`,
    symbol: `NIFTY${i}`,
    status: i % 4 === 0 ? 'OPEN' : 'CLOSED',
    netPnl: (i % 2 === 0 ? 1 : -1) * (100 + (i % 500)),
    grossPnl: (i % 2 === 0 ? 1 : -1) * (120 + (i % 500)),
    totalCharges: 20,
    direction: i % 2 === 0 ? 'LONG' : 'SHORT',
    entryPrice: 100 + (i % 100),
    quantity: 10,
    realizedRMultiple: (i % 2 === 0 ? 1.5 : -1.0),
    initialRiskRupees: 500,
    exitAt: new Date(Date.now() - i * 3600000).toISOString(),
    entryAt: new Date(Date.now() - (i + 5) * 3600000).toISOString(),
    portfolioOwnerId: i % 2 === 0 ? 'owner-1' : 'owner-2',
  }));

  const tCalc0 = performance.now();
  // Simulate Dashboard KPI Calculation
  let totalNet = 0;
  let totalCharges = 0;
  let wins = 0;
  let losses = 0;
  const closed = dummyTrades.filter((t) => t.status === 'CLOSED');
  closed.forEach((t) => {
    totalNet += t.netPnl;
    totalCharges += t.totalCharges;
    if (t.netPnl > 0) wins++;
    else if (t.netPnl < 0) losses++;
  });
  const winRate = wins / (wins + losses);
  const tCalc = performance.now() - tCalc0;
  console.log(`KPI calculation on 1,000 trades: ${tCalc.toFixed(3)} ms`);

  // Test 6: Search & Filter Benchmark (Un-debounced vs Debounced)
  console.log('\n--- 6. Search & Filter Benchmarks (1000 trades) ---');
  const tSearch0 = performance.now();
  for (let k = 0; k < 100; k++) {
    const q = 'NIFTY5';
    dummyTrades.filter((t) => t.symbol.toLowerCase().includes(q.toLowerCase()));
  }
  const tSearch = performance.now() - tSearch0;
  console.log(`100 keystrokes of un-debounced filter (1000 items): ${tSearch.toFixed(2)} ms`);

  console.log('\n====================================================');
  console.log('BASELINE AUDIT COMPLETE');
  console.log('====================================================');
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
});
