'use client';

import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Stack';

import MemberItem from '@/components/MemberItem';
import { MemberFaces, MemberName } from '@/components/MemberAvatar';
import { withAlpha } from '@/types/schedule';
import type { Schedule } from '@/types/schedule';

/**
 * 월간일정 일정 상세의 조각(2026-11-16 "일정·근무 상세 팝업이 너무 대충" — 앱 일정 시트와 같은 방향).
 *
 * 예전 상세는 일정 색이 어디에도 없고, 날짜가 할 일 목록 아래에 묻혔고, 담당자는 첨부 뒤 맨 아래에서
 * '담당자' 제목과 '담당' 알약으로 두 번 말했고, 작성자는 회색 글자 한 줄이었다.
 * 이제 위에서부터: 분류 꼬리표(일정 색) → 날짜·시간·장소 → 사람(담당·등록·참석, 사진과 함께).
 */

/** 분류 꼬리표 — 일정 색을 옅게 깐 바탕 + 같은 색 점 + 진한 글자 */
export function ScheduleCategoryTag({ label, color }: { label: string; color: string }) {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px 3px 8px',
                borderRadius: 'var(--radius-full)',
                background: withAlpha(color, 0.14),
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                lineHeight: 1.4,
            }}
        >
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
        </span>
    );
}

/** 아이콘 + 내용 한 줄(날짜·장소) */
export function DetailLine({ icon, children }: { icon: Parameters<typeof Icon>[0]['icon']; children: ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-3)' }}>
            <span style={{ display: 'inline-flex', paddingTop: 2 }}>
                <Icon icon={icon} size="md" color="tertiary" />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
        </div>
    );
}

/** 날짜 + 시간을 한 줄로 — '2026년 11월 16일 (월) · 09:30–10:00' */
export function scheduleWhenText(schedule: {
    startDate?: string | null;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    isAllDay?: boolean | null;
}): {
    date: string;
    time: string;
} {
    const start = new Date(schedule.startDate ?? '');
    // 'yyyy-MM-dd'와 'yyyy-MM-ddTHH:mm'이 섞여 와서 날짜 부분만 비교한다
    const day = (d?: string | null) => (d ?? '').slice(0, 10);
    const multiDay = !!schedule.endDate && day(schedule.endDate) !== day(schedule.startDate);
    const date = multiDay
        ? `${format(start, 'yyyy년 M월 d일 (EEE)', { locale: ko })} ~ ${format(new Date(schedule.endDate!), 'M월 d일 (EEE)', { locale: ko })}`
        : Number.isNaN(start.getTime())
          ? ''
          : format(start, 'yyyy년 M월 d일 (EEEE)', { locale: ko });
    const trim = (t?: string | null) => (t ? t.slice(0, 5) : '');
    const time = schedule.isAllDay
        ? '종일'
        : schedule.startTime
          ? schedule.endTime && trim(schedule.endTime) !== trim(schedule.startTime)
              ? `${trim(schedule.startTime)}–${trim(schedule.endTime)}`
              : trim(schedule.startTime)
          : '';
    return { date, time };
}

/** 하루 안 순서 — 종일 먼저, 그다음 시작 시각, 시각 없으면 끝(같으면 먼저 만든 것). 앱 Schedule.compareByTime과 같다 */
export function compareScheduleTime(
    a: { isAllDay?: boolean; startTime?: string | null; id?: string | number },
    b: { isAllDay?: boolean; startTime?: string | null; id?: string | number },
): number {
    const rank = (s: typeof a) => (s.isAllDay ? 0 : s.startTime ? 1 : 2);
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    const byTime = (a.startTime ?? '').localeCompare(b.startTime ?? '');
    if (byTime !== 0) return byTime;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, { numeric: true });
}

interface PeopleMember {
    id?: number | string;
    name?: string;
    profileImageUrl?: string | null;
    role?: string | null;
    position?: string | null;
}

/**
 * 사람 칸 — 이름표(담당·등록·참석) + 사진 달린 이름. 참석은 사진 겹침 + 앞 세 명 이름, '명단 보기'로 펼친다.
 * [roleOf]는 참석자 줄 아래 직종을 그린다(회원 목록에서 찾은 사람만).
 */
export function SchedulePeople({
    schedule,
    members,
    roleOf,
}: {
    schedule: Schedule;
    members: PeopleMember[];
    roleOf: (member: PeopleMember) => string | undefined;
}) {
    const [showAll, setShowAll] = useState(false);
    const participants = (schedule.participants ?? []).map((p) => ({
        id: p.userId,
        name: (p as { memberName?: string }).memberName || p.userName || '참석자',
        rowKey: p.id,
    }));
    const manager = schedule.managerName?.trim();
    const author = schedule.authorName?.trim();
    const createdAt = schedule.createdAt ? format(new Date(schedule.createdAt), 'M월 d일', { locale: ko }) : '';

    const rows: { label: string; content: ReactNode }[] = [];
    if (manager) {
        rows.push({
            label: '담당',
            content: <MemberName name={manager} id={schedule.managerId} type={schedule.managerType} size={24} />,
        });
    }
    if (author) {
        rows.push({
            label: '등록',
            content: (
                <MemberName
                    name={author}
                    email={schedule.authorId}
                    size={24}
                    suffix={createdAt ? `· ${createdAt}` : undefined}
                />
            ),
        });
    }
    if (participants.length > 0) {
        const names = participants.slice(0, 3).map((p) => p.name).join(', ');
        const more = participants.length - 3;
        rows.push({
            label: '참석',
            content: (
                <VStack gap={2}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <MemberFaces people={participants} size={24} max={4} />
                        <Text type="body" color="primary">
                            {names}
                            {more > 0 ? ` 외 ${more}명` : ''}
                        </Text>
                        {participants.length > 1 && (
                            <Button
                                label={showAll ? '접기' : `${participants.length}명 모두 보기`}
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAll((v) => !v)}
                            />
                        )}
                    </span>
                    {showAll && (
                        <div style={{ borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)', padding: 'var(--spacing-1)' }}>
                            {participants.map((p) => {
                                const matched = members.find((m) => String(m.id) === String(p.id));
                                return (
                                    <MemberItem
                                        key={p.rowKey}
                                        name={p.name}
                                        role={matched ? roleOf(matched) : undefined}
                                        imageUrl={matched?.profileImageUrl}
                                        density="compact"
                                    />
                                );
                            })}
                        </div>
                    )}
                </VStack>
            ),
        });
    }
    if (rows.length === 0) return null;

    return (
        <dl
            style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr',
                alignItems: 'center',
                rowGap: 'var(--spacing-3)',
                columnGap: 'var(--spacing-3)',
                margin: 0,
            }}
        >
            {rows.map((row) => (
                <div key={row.label} style={{ display: 'contents' }}>
                    <dt style={{ alignSelf: 'start', paddingTop: 3 }}>
                        <Text type="supporting" color="secondary">{row.label}</Text>
                    </dt>
                    <dd style={{ margin: 0, minWidth: 0 }}>{row.content}</dd>
                </div>
            ))}
        </dl>
    );
}
