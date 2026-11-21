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
  /**
   * 이름 → 직무. 주면 이름 옆에 직무를 함께 보여준다.
   * 휴무 API는 직무를 주지 않아 회원 목록에서 이름으로 찾아 넘긴다.
   */
  roleByName?: Map<string, string>;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  minWidth: 0,
  // 칸을 통째로 쓸 때(가운데 정렬)는 세로 flex의 자식이 제 글자 폭만큼 커져
  // 칸보다 넓으면 양옆이 같이 잘렸다("최유진"이 "되유진"처럼, 배지가 반쪽으로).
  // 칸 폭을 넘지 않게 묶어야 이름 말줄임(…)이 걸린다.
  maxWidth: '100%',
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
  roleByName,
}: CalendarVacationPaneProps) {
  if (fraction <= 0) return null;

  // "+N" 도 한 줄을 차지한다. 자리를 미리 비워두지 않으면 칸 높이에 걸려 잘려서
  // 몇 명이 더 있는지 알 수 없게 된다.
  const limit = Math.max(maxVisible, 0);
  const willTruncate = people.length > limit;
  const visible = people.slice(0, willTruncate ? Math.max(limit - 1, 0) : limit);
  const hidden = people.length - visible.length;

  // 칸을 통째로 쓸 때는 가운데로 모은다 (한쪽에 치우쳐 있으면 빈 칸처럼 보인다)
  const isFullWidth = fraction >= 1;
  // 그날 휴무자가 없으면 나눔선도 긋지 않는다 — 일정이 있는 날마다 빈 칸 옆에
  // 세로줄만 남아 달력 전체에 뜻 없는 줄이 늘어서 보였다.
  const showDivider = hasDivider && people.length > 0;

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
        paddingLeft: showDivider ? 'var(--spacing-1)' : 0,
        borderLeft: showDivider ? '1px solid var(--color-border)' : 'none',
        alignItems: isFullWidth ? 'center' : 'stretch',
        gap: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {people.length === 0 ? null : (
        <>
          {visible.map((person) => {
            const role = roleByName?.get(person.name) || '';
            return (
              <div
                key={person.id}
                className="carev-cal-vacrow"
                style={rowStyle}
                title={role
                  ? `${person.name} · ${role} · ${person.kindLabel}`
                  : `${person.name} · ${person.kindLabel}`}
              >
                {/* 배지+이름은 한 덩어리로 줄바꿈되지 않는다 — 자리가 모자라면 직무만 다음(숨은) 줄로 넘어간다.
                    이름은 세 글자까지 지키고, 칸이 그보다 좁으면(일정과 반으로 나눈 칸) 말줄임이 걸린다. */}
                <span className="carev-cal-vacwho">
                  <span style={vacationKindBadgeStyle(person.color)}>{person.short}</span>
                  <span className="carev-cal-vacname">
                    <Text type="supporting" color="secondary" maxLines={1}>
                      {person.name}
                    </Text>
                  </span>
                </span>
                {role && (
                  // 직무는 이름보다 한 단계 옅게 — 'disabled'(#a3a3a3)는 흰 바탕에서
                  // 2.5:1이라 읽기 어렵다. 굵기·크기는 그대로 두고 대비만 4.5:1 위로.
                  <span className="carev-cal-vacrole carev-cal-vacrole-text">
                    <Text type="supporting" color="inherit" maxLines={1}>
                      {role}
                    </Text>
                  </span>
                )}
              </div>
            );
          })}
          {hidden > 0 && (
            <span className="carev-cal-vacrole-text">
              <Text type="supporting" color="inherit">
                +{hidden}
              </Text>
            </span>
          )}
        </>
      )}
    </div>
  );
}
