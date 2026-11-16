/**
 * 스프링 움직임 값(2026-11-16, designbookmark.com/motion 의 'Motion Studies' 토큰을 옮김).
 *
 * 시간으로 정한 전환(duration)은 중간에 다른 곳을 누르면 처음부터 다시 달리지만, 스프링은 지금 속도를
 * 이어받아 방향만 바꾼다 — 탭을 연달아 눌러도 끊기지 않는다. 값은 framer-motion의 stiffness·damping
 * (질량 1)이고, 원본 사이트의 "stiffness damping" 쌍과 같은 뜻이다.
 *
 * - lead/trail: 선택 표시가 옮겨 갈 때 가는 쪽 가장자리는 빨리(lead), 반대쪽은 늦게(trail) 따라와
 *   잠깐 늘어났다 줄어든다 — 어디서 어디로 옮겼는지가 보인다.
 * - settle: 손을 떼고 자리 잡을 때(작은 넘침 한 번)
 * - nav: 왼쪽 메뉴처럼 자주 오가는 세로 이동 — 넘침 없이 빨리 선다
 * - pop: 서명 도장·체크 표시처럼 '됐다'를 알리는 짧은 튐
 * - fade: 투명도·작은 미끄러짐
 */
export const spring = {
  lead: { type: 'spring', stiffness: 620, damping: 36 },
  trail: { type: 'spring', stiffness: 190, damping: 19 },
  settle: { type: 'spring', stiffness: 280, damping: 22 },
  nav: { type: 'spring', stiffness: 520, damping: 42 },
  pop: { type: 'spring', stiffness: 520, damping: 16 },
  stamp: { type: 'spring', stiffness: 640, damping: 24 },
  fade: { type: 'spring', stiffness: 420, damping: 32 },
} as const;
