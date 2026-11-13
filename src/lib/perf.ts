/**
 * TradeVault — Performance Instrumentation & Diagnostic Logging
 *
 * Provides non-intrusive execution timers and Server-Timing headers for
 * development diagnosis. Strictly excludes all financial figures, credentials,
 * tokens, and personally identifiable information from logs.
 */

const isDev = process.env.NODE_ENV === 'development';

export interface PerfMetric {
  name: string;
  durationMs: number;
  details?: string;
}

/**
 * Measures the execution time of an asynchronous function.
 * Logs execution timing to server console in development mode.
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  details?: string
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    if (isDev) {
      const detailsSuffix = details ? ` (${details})` : '';
      console.log(`[PERF] ${label}: ${duration.toFixed(1)}ms${detailsSuffix}`);
    }
  }
}

/**
 * Creates a scoped timer instance for measuring multi-step server procedures.
 */
export function createPerfTracker(routeLabel: string) {
  const start = performance.now();
  const metrics: PerfMetric[] = [];
  let dbQueries = 0;

  return {
    async track<T>(stepName: string, fn: () => Promise<T>, details?: string): Promise<T> {
      const stepStart = performance.now();
      try {
        const result = await fn();
        if (details?.includes('db') || stepName.toLowerCase().includes('query') || stepName.toLowerCase().includes('supabase')) {
          dbQueries += 1;
        }
        return result;
      } finally {
        const dur = performance.now() - stepStart;
        metrics.push({ name: stepName, durationMs: dur, details });
        if (isDev) {
          const det = details ? ` [${details}]` : '';
          console.log(`[PERF:${routeLabel}] ${stepName}: ${dur.toFixed(1)}ms${det}`);
        }
      }
    },

    recordDbQuery(name: string, durationMs: number) {
      dbQueries += 1;
      metrics.push({ name, durationMs, details: 'db' });
      if (isDev) {
        console.log(`[PERF:${routeLabel}:DB] ${name}: ${durationMs.toFixed(1)}ms`);
      }
    },

    finish(extraDetails?: string) {
      const total = performance.now() - start;
      if (isDev) {
        const extra = extraDetails ? ` | ${extraDetails}` : '';
        console.log(
          `[PERF:${routeLabel}:TOTAL] Total: ${total.toFixed(1)}ms (${dbQueries} DB queries)${extra}`
        );
      }
      return {
        totalMs: total,
        dbQueries,
        metrics,
        serverTimingHeader: metrics
          .map((m) => `${m.name.replace(/[^a-zA-Z0-9_-]/g, '_')};dur=${m.durationMs.toFixed(1)}`)
          .join(', '),
      };
    },
  };
}
