'use client';

import { useEffect, useRef, useState } from 'react';

/** 처음 보일 때 0에서 값까지 세는 시간(DESIGN.md "Motion") */
const COUNT_MS = 400;

/** 값이 아직 없는 상태(0 이하·숫자가 아님) — 불러오는 중에는 요약 숫자가 0으로 먼저 그려진다 */
function isEmpty(value: number): boolean {
  return !Number.isFinite(value) || value <= 0;
}

/**
 * 움직여도 되는 상황인지 — 동작 줄이기이거나 탭이 가려져 있으면 세지 않고 바로 값을 보인다.
 * 가려진 탭에서는 requestAnimationFrame이 멈춰 숫자가 0에 머문다(캡처·백그라운드 탭).
 */
function canAnimate(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 처음 값이 들어올 때만 0 → value를 COUNT_MS 동안 감속하며 센다.
 * 불러오는 동안의 0은 '처음'으로 치지 않는다 — 첫 양수 값에서 센다.
 * 그 뒤 갱신으로 값이 바뀌면 세지 않고 바로 바꾼다.
 */
export function useCountUp(value: number): number {
  const settledRef = useRef(false);
  const [shown, setShown] = useState(() => (isEmpty(value) || !canAnimate() ? value : 0));

  useEffect(() => {
    if (settledRef.current) {
      setShown(value);
      return;
    }
    if (isEmpty(value)) {
      // 아직 값이 없다 — 그대로 보이고, 첫 양수 값을 기다린다
      setShown(value);
      return;
    }
    if (!canAnimate()) {
      settledRef.current = true;
      setShown(value);
      return;
    }
    setShown(0);

    let frame = 0;
    // 시작 시각은 첫 프레임의 시각으로 잡는다 — rAF가 넘겨주는 시각은 그 프레임이 시작된 때라
    // effect 안에서 잰 performance.now()보다 이를 수 있고, 그러면 진행률이 음수가 되어 한 프레임 동안 음수가 보인다
    let start: number | null = null;
    const finish = () => {
      settledRef.current = true;
      setShown(value);
    };
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
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
