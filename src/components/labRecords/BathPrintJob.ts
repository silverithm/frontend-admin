'use client';

/** 목욕 일지용: 인쇄할 대상을 정하면 화면에 인쇄본을 그린 다음 인쇄 창을 연다. 인쇄가 끝나면(또는 취소하면) 대상을 비운다. */
import { useCallback, useEffect, useState } from 'react';

export function useBathPrintJob<T>(): [T | null, (target: T) => void] {
  const [target, setTarget] = useState<T | null>(null);
  useEffect(() => {
    if (target === null) return;
    const clear = () => setTarget(null);
    window.addEventListener('afterprint', clear);
    // 인쇄본이 그려진 뒤에 창을 연다
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', clear);
    };
  }, [target]);
  const start = useCallback((next: T) => setTarget(next), []);
  return [target, start];
}
