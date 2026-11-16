'use client';

import type { ComponentProps } from 'react';
import { Button } from '@astryxdesign/core/Button';
import '@/styles/work.css';

type OutlineDangerButtonProps = Omit<ComponentProps<typeof Button>, 'variant'>;

/**
 * 반려·거절처럼 승인 옆에 놓이는 위험 단추(2026-11-16).
 * Astryx에는 테두리만 있는 위험 변형이 없어(primary·secondary·ghost·destructive뿐) secondary를 바탕으로
 * 글자·테두리만 위험색으로 바꾼다 — 채움(destructive)이 승인과 같은 무게로 보이던 것을 낮춘다.
 */
export function OutlineDangerButton(props: OutlineDangerButtonProps) {
  return (
    <span className="carev-btn-danger-outline">
      <Button {...props} variant="secondary" />
    </span>
  );
}
