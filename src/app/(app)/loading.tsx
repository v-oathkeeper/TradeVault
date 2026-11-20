function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-xl bg-[var(--border)]/70 motion-safe:animate-pulse ${className}`}
    />
  );
}

export default function AppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Loading page</span>
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <SkeletonBlock className="h-5 w-36" />
        <SkeletonBlock className="h-9 w-24 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-6 w-28" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="h-5 w-20" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SkeletonBlock className="h-11" />
              <SkeletonBlock className="h-11" />
              <SkeletonBlock className="h-11" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
