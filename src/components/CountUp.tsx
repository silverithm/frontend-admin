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

/** 값이 바뀔 때 이전 값에서 새 값으로 굴러가는 시간 */
const ROLL_MS = 300;

/**
 * 값이 바뀌면 지금 보이는 값에서 새 값까지 ROLL_MS 동안 감속하며 굴러간다(계산기 결과처럼 입력을 바꿀 때 쓰는 모드).
 * 처음 그릴 때는 굴리지 않고 그 값 그대로 — 서버가 그린 HTML과 같아야 한다.
 * 동작 줄이기이거나 탭이 가려져 있으면 즉시 바뀐다. 굴러가는 도중 값이 또 바뀌면 지금 보이는 값에서 이어서 간다.
 */
export function useRollingValue(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    if (!canAnimate()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const apply = (next: number) => {
      shownRef.current = next;
      setShown(next);
    };
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, Math.max(0, (now - start) / ROLL_MS));
      if (t >= 1) {
        apply(value);
        return;
      }
      apply(Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // 도중에 탭이 가려져 rAF가 멈춰도 값은 제자리에 온다
    const fallback = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      apply(value);
    }, ROLL_MS + 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [value]);

  return shown;
}

/** 보이기만 하고 스크린리더는 읽지 않는 숫자 옆에 두는, 화면에는 안 보이고 읽히기만 하는 글 */
const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * 값이 바뀌면 굴러가는 숫자. format으로 단위·쉼표를 붙인다.
 * 굴러가는 중간값은 aria-hidden으로 숨기고 최종값만 스크린리더 글로 둔다(aria-live가 중간값을 낭독하지 않게).
 */
export function RollingNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const shown = useRollingValue(value);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span style={SR_ONLY}>{format(value)}</span>
    </>
  );
}

/** 대시보드 맨 위 요약 숫자 — 글자 모양은 감싸는 Text가 정하고, 여기서는 숫자만 낸다 */
export function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

export default CountUp;
