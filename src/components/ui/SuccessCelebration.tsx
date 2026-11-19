'use client';

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

const LazyLottieAnimation = lazy(() =>
  import('@/components/ui/LottieAnimation').then((module) => ({
    default: module.LottieAnimation,
  }))
);

interface SuccessCelebrationProps {
  open: boolean;
  onComplete: () => void;
}

export function SuccessCelebration({ open, onComplete }: SuccessCelebrationProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!open) {
      setAnimationData(null);
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPrefersReducedMotion(reducedMotion);
    if (reducedMotion) return;

    let active = true;
    import('@/lib/animations/lottie-data')
      .then(({ successCheckAnimation }) => {
        if (active) setAnimationData(successCheckAnimation);
      })
      .catch(() => {
        // The static success icon remains available if the animation chunk fails.
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => onCompleteRef.current(), 1400);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 right-4 z-[60] flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] shadow-xl animate-slide-up lg:bottom-6"
    >
      {animationData && !prefersReducedMotion ? (
        <Suspense fallback={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}>
          <LazyLottieAnimation
            animationData={animationData}
            loop={false}
            className="h-8 w-8 shrink-0"
          />
        </Suspense>
      ) : (
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
      )}
      <span>Changes saved</span>
    </div>
  );
}
