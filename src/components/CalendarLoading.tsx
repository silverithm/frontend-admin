import React from 'react';
import { Skeleton } from '@astryxdesign/core/Skeleton';

/*
 * 달력 로딩 뼈대 조각 (2026-11-20).
 *
 * 달력은 날짜 칸·요일 줄이 데이터 없이도 정해져 있다. 그래서 틀은 그대로 두고
 * 칸 안의 일정 막대 자리만 뼈대로 채운다 — 스피너로 통째로 갈아끼우거나 빈 칸으로 두면
 * 데이터가 들어올 때 갑자기 튀어나온다.
 */

/** 날짜(숫자) 하나에서 늘 같은 0~1 값을 낸다 — 새로고침해도 뼈대 모양이 같아야 어색하지 않다 */
export function skelRand(seed: number, salt = 0): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** 그날 칸에 그릴 뼈대 막대의 폭(%) 목록. 0~2개, 날짜마다 다르다 */
export function skelBarWidths(seed: number): number[] {
  const r = skelRand(seed);
  const count = r < 0.28 ? 0 : r < 0.72 ? 1 : 2;
  return Array.from({ length: count }, (_, i) => 48 + Math.round(skelRand(seed, i + 1) * 44));
}

interface CellBarsProps {
  /** 날짜의 일(1~31) 또는 칸 순번 — 모양을 정하는 씨앗 */
  seed: number;
  barHeight: number;
  gap: number;
  /** 칸 안에서 막대 영역이 시작하는 위쪽 오프셋(날짜 숫자 아래) */
  top: number;
  /** 좌우 여백 */
  inset: number;
  /** 줄마다 살짝 늦게 깜빡이게 하는 순번 */
  index?: number;
}

/** 달력 칸 안 일정 막대 뼈대 — 칸(position: relative) 안에 절대배치로 얹는다 */
export function CalendarCellBars({ seed, barHeight, gap, top, inset, index = 0 }: CellBarsProps) {
  const widths = skelBarWidths(seed);
  if (widths.length === 0) return null;
  return (
    <div
      className="carev-skel-rows"
      aria-hidden="true"
      style={{ position: 'absolute', top, left: inset, right: inset, display: 'flex', flexDirection: 'column', gap, pointerEvents: 'none' }}
    >
      {widths.map((w, i) => (
        <Skeleton key={i} width={`${w}%`} height={barHeight} radius={2} index={index + i} />
      ))}
    </div>
  );
}

/** 옆 목록·패널이 로딩 중일 때 빈 상태 글 대신 보이는 줄 뼈대 */
export function ListSkeletonRows({ rows = 3, rowHeight = 56, gap = 8 }: { rows?: number; rowHeight?: number; gap?: number }) {
  return (
    <div className="carev-skel-rows" role="status" aria-label="불러오는 중" style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} width="100%" height={rowHeight} radius={2} index={i} />
      ))}
    </div>
  );
}
