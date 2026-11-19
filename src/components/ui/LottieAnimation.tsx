'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const Lottie = dynamic<any>(
  () =>
    import('lottie-react').then((m) => {
      const mod = m as any;
      return (mod.default || mod.Lottie || mod) as React.ComponentType<any>;
    }),
  {
    ssr: false,
    loading: () => <div className="w-full h-full animate-pulse bg-rose-500/5 rounded-2xl" />,
  }
);

interface LottieAnimationProps {
  animationData: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function LottieAnimation({
  animationData,
  loop = true,
  autoplay = true,
  className = 'w-24 h-24 mx-auto',
  style,
}: LottieAnimationProps) {
  return (
    <div className={className} style={style}>
      <Lottie animationData={animationData} loop={loop} autoPlay={autoplay} />
    </div>
  );
}
