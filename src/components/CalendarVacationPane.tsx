'use client';

import type { CSSProperties } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { vacationKindBadgeStyle, type VacationPerson } from '@/lib/monthVacations';

interface CalendarVacationPaneProps {
  people: VacationPerson[];
  /** 칸 폭에서 휴무자 영역이 차지하는 비율 (0~1) */
  fraction: number;
  /** 칸 높이에 맞춰 잘라 보여줄 최대 인원 */
  maxVisible: number;
  /** 위쪽 여백 — 날짜 숫자 줄만큼 내려서 일정 바와 첫 줄을 맞춘다 */
  topOffset: number;
  /** 왼쪽 일정 영역과 나누는 세로선 */
  hasDivider?: boolean;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  minWidth: 0,
};

/**
 * 달력 칸 오른쪽에 붙는 그날 휴무자 목록.
 *
 * 칸 안에 절대배치로 얹는다. 일정 바가 칸 위를 덮는 오버레이라서, 휴무자를
 * 일반 흐름에 두면 바와 겹치기 때문이다. 넘치는 인원은 "+N"으로 접는다.
 */
export default function CalendarVacationPane({
  people,
  fraction,
  maxVisible,
  topOffset,
  hasDivider = true,
}: CalendarVacationPaneProps) {
  if (fraction <= 0) return null;

  const visible = people.slice(0, Math.max(maxVisible, 0));
  const hidden = people.length - visible.length;

  return (
    <div
      // 칸을 반으로 가른 상태에서는 좁은 화면에 이름이 들어갈 폭이 안 나온다 → CSS에서 숨긴다.
      // (display를 인라인에 두면 인라인이 항상 이겨서 숨겨지지 않는다 — CSS 클래스가 갖는다)
      className={fraction < 1 ? 'carev-cal-vacpane carev-cal-vacpane--split' : 'carev-cal-vacpane'}
      style={{
        position: 'absolute',
        top: topOffset,
        right: 'var(--spacing-1)',
        bottom: 'var(--spacing-1)',
        width: `calc(${fraction * 100}% - var(--spacing-2))`,
        paddingLeft: hasDivider ? 'var(--spacing-1)' : 0,
        borderLeft: hasDivider ? '1px solid var(--color-border)' : 'none',
        gap: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {people.length === 0 ? null : (
        <>
          {visible.map((person) => (
            <div key={person.id} style={rowStyle} title={`${person.name} · ${person.kindLabel}`}>
              <span style={vacationKindBadgeStyle(person.color)}>{person.short}</span>
              <span style={{ minWidth: 0, overflow: 'hidden' }}>
                <Text type="supporting" color="secondary" maxLines={1}>
                  {person.name}
                </Text>
              </span>
            </div>
          ))}
          {hidden > 0 && (
            <Text type="supporting" color="disabled">
              +{hidden}
            </Text>
          )}
        </>
      )}
    </div>
  );
}
