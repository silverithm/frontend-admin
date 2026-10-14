'use client';

/** 급여 만족도 인쇄용: 인쇄할 대상을 정하면 인쇄본을 그린 다음 인쇄 창을 열고, 끝나면 비운다. */
import { useCallback, useEffect, useState } from 'react';

export function useSatisfactionPrint<T>(): [T | null, (target: T) => void] {
  const [target, setTarget] = useState<T | null>(null);
  useEffect(() => {
    if (target === null) return;
    const clear = () => setTarget(null);
    window.addEventListener('afterprint', clear);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', clear);
    };
  }, [target]);
  const start = useCallback((next: T) => setTarget(next), []);
  return [target, start];
}
