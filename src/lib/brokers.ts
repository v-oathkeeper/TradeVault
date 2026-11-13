import type { BrokerCode } from '@/types/app';

export interface BrokerInfo {
  id: string;
  code: BrokerCode;
  name: string;
}

export const KNOWN_BROKERS: Record<string, BrokerInfo> = {
  'a1000000-0000-0000-0000-000000000001': {
    id: 'a1000000-0000-0000-0000-000000000001',
    code: 'KITE',
    name: 'Zerodha Kite',
  },
  'a2000000-0000-0000-0000-000000000002': {
    id: 'a2000000-0000-0000-0000-000000000002',
    code: 'SHOONYA',
    name: 'Shoonya by Finvasia',
  },
};

let dynamicBrokerCache: Record<string, BrokerInfo> = { ...KNOWN_BROKERS };
let lastFetchTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getBrokerById(id: string): BrokerInfo | undefined {
  return dynamicBrokerCache[id] ?? KNOWN_BROKERS[id];
}

export function registerBrokers(brokers: Array<{ id: string; code: string; name: string }>) {
  for (const b of brokers) {
    dynamicBrokerCache[b.id] = {
      id: b.id,
      code: b.code as BrokerCode,
      name: b.name,
    };
  }
}
