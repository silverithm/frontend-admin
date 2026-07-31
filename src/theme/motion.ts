/**
 * Astryx 모션 토큰의 JS 대응값.
 *
 * framer-motion은 CSS 변수(`var(--duration-fast)`)를 읽지 못하므로,
 * `npx astryx docs motion`의 토큰 값을 그대로 옮겨 단일 소스로 쓴다.
 * CSS에서는 계속 `var(--duration-*)` / `var(--ease-standard)`를 사용한다.
 *
 * 밴드 기준:
 * - fast: 마이크로 인터랙션(호버, 토글, 선택)
 * - medium: 등장/퇴장, 레이아웃이 재배치되는 전환
 * - slow: 연속·반복 애니메이션
 */

/** 초 단위 (framer-motion transition.duration용) */
export const duration = {
  fastMin: 0.13,
  fast: 0.175,
  fastMax: 0.23,
  mediumMin: 0.31,
  medium: 0.41,
  mediumMax: 0.55,
  slowMin: 0.73,
  slow: 0.975,
  slowMax: 1.3,
} as const;

/** ms 문자열 (인라인 CSS transition용 — 가능하면 var(--duration-*) 우선) */
export const durationMs = {
  fastMin: '130ms',
  fast: '175ms',
  fastMax: '230ms',
  mediumMin: '310ms',
  medium: '410ms',
  mediumMax: '550ms',
  slowMin: '730ms',
  slow: '975ms',
  slowMax: '1300ms',
} as const;

/** --ease-standard: cubic-bezier(0.24, 1, 0.4, 1) */
export const easeStandard = [0.24, 1, 0.4, 1] as const;
export const easeStandardCss = 'cubic-bezier(0.24, 1, 0.4, 1)';
