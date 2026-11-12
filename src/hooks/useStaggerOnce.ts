'use client';

import { useEffect, useState } from 'react';

/** 8번째 줄(지연 210ms)이 200ms 등장을 마칠 때까지 + 여유. globals.css의 .carev-stagger 값과 맞춘다 */
export const STAGGER_ONCE_MS = 210 + 200 + 50;

/**
 * 목록 첫 등장(.carev-stagger, DESIGN.md "Motion")을 처음 불러온 직후 한 번만 붙인다.
 *
 * `ready`가 처음 true가 된 렌더부터 STAGGER_ONCE_MS 동안만 클래스 이름을 돌려주고, 그 뒤로는 돌려주지 않는다.
 * 클래스를 계속 달아 두면 줄이 지워지거나 걸러질 때 아래 줄이 위 8칸 안으로 올라오면서 다시 떠오른다
 * — 갱신 때마다 목록이 흔들리지 않게 첫 등장이 끝나면 뗀다(끝난 애니메이션을 떼는 것은 화면에 아무 변화가 없다).
 *
 * 주기적으로 다시 받아 오는 화면(채팅·알림·대시보드 자동 갱신)에는 쓰지 않는다.
 */
export function useStaggerOnce(ready: boolean): string | undefined {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!ready || done) return;
    const timer = window.setTimeout(() => setDone(true), STAGGER_ONCE_MS);
    return () => window.clearTimeout(timer);
  }, [ready, done]);

  return ready && !done ? 'carev-stagger' : undefined;
}
