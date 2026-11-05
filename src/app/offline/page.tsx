import Link from 'next/link';
import { WifiOff, RotateCcw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
          <WifiOff className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            You are offline
          </h1>
          <p className="text-sm text-[var(--muted)]">
            TradeVault requires an active internet connection to securely access and calculate your trading data.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <RotateCcw className="w-4 h-4" />
            Try Reconnecting
          </Link>
        </div>
      </div>
    </div>
  );
}
