'use client';

import { useEffect, useRef, useState } from 'react';

/** 처음 보일 때 0에서 값까지 세는 시간(DESIGN.md "Motion") */
const COUNT_MS = 400;

/**
 * 셀 수 있는 상황인지 — 값이 0 이하이거나, 동작 줄이기이거나, 탭이 가려져 있으면 세지 않고 바로 값을 보인다.
 * 가려진 탭에서는 requestAnimationFrame이 멈춰 숫자가 0에 머문다(캡처·백그라운드 탭).
 */
function canCount(value: number): boolean {
  if (typeof window === 'undefined') return false;
  if (!Number.isFinite(value) || value <= 0) return false;
  if (document.visibilityState !== 'visible') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 처음 보일 때만 0 → value를 COUNT_MS 동안 감속하며 센다.
 * 그 뒤 갱신으로 값이 바뀌면 세지 않고 바로 바꾼다.
 */
export function useCountUp(value: number): number {
  const settledRef = useRef(false);
  const [shown, setShown] = useState(() => (canCount(value) ? 0 : value));

  useEffect(() => {
    if (settledRef.current || !canCount(value)) {
      settledRef.current = true;
      setShown(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const finish = () => {
      settledRef.current = true;
      setShown(value);
    };
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      if (t >= 1) {
        finish();
        return;
      }
      // 감속(ease-out) — 끝에서 천천히 멈춘다. 되튀지 않는다
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // 세는 도중 탭이 가려지면 rAF가 멈춘다 — 그래도 값은 제자리에 오게 한다
    const fallback = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      finish();
    }, COUNT_MS + 100);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [value]);

  return shown;
}

/** 대시보드 맨 위 요약 숫자 — 글자 모양은 감싸는 Text가 정하고, 여기서는 숫자만 낸다 */
export function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

export default CountUp;
