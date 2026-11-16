'use client';

// Astryx Grid의 columns={{ minWidth, repeat: 'fit', max }} 보정판.
// 원인: Astryx는 max를 줄 때 각 칸의 최대 폭을 (100% - (max-1)·간격) / max 로 막는다.
// 그래서 칸이 한 줄에 하나만 들어가는 좁은 폭(휴대폰)에서도 그 한 칸이 카드 폭의 절반 남짓에서 멈춰 가운데가 비는 채로 남는다.
// 고침: 칸의 '최소'를 max(minWidth, 같은 계산값)으로 올려 열 수는 그대로 max로 막고, 최대는 1fr로 풀어
// 한 칸일 때 꽉 차게 한다. 넓은 폭의 열 수·폭은 그대로다. 실제 식은 globals.css의 .carev-fit-grid.

import type { CSSProperties, ComponentProps } from 'react';
import { Grid } from '@astryxdesign/core/Grid';

type FitColumns = { minWidth: number; repeat?: 'fit' | 'fill'; max?: number };
type FitGridProps = Omit<ComponentProps<typeof Grid>, 'columns'> & { columns: FitColumns };

export function FitGrid({ columns, gap, columnGap, className, style, ...props }: FitGridProps) {
  const gapToken = columnGap ?? gap ?? 0;
  const vars = {
    '--fit-min': `${columns.minWidth}px`,
    '--fit-max': columns.max ?? 1,
    '--fit-gap': `var(--spacing-${String(gapToken).replace('.', '-')})`,
  } as CSSProperties;
  return (
    <Grid
      columns={columns}
      gap={gap}
      columnGap={columnGap}
      className={['carev-fit-grid', className].filter(Boolean).join(' ')}
      style={{ ...vars, ...style }}
      {...props}
    />
  );
}

export default FitGrid;
