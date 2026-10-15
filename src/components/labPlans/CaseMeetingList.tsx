'use client';

/** 연도별 회의 목록 — 대상 어르신·참석 인원·기한 칩. */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { YearStepper } from '@/components/labRecords/RecordsUi';
import type { CaseMeeting } from '@/lib/lab/labTypes';
import { meetingFollowSummary } from './CaseMeetingFollow';
import styles from './labPlans10.module.css';

interface Props {
  year: number;
  maxYear: number;
  today: string;
  meetings: CaseMeeting[];
  loading: boolean;
  error: string | null;
  activeId: number | null;
  isDisabled: boolean;
  onYear: (year: number) => void;
  onRetry: () => void;
  onOpen: (m: CaseMeeting) => void;
}

function elderText(m: CaseMeeting): string {
  const names = m.targets.map((t) => t.elderlyName || '이름 없음');
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명`;
}

export default function CaseMeetingList({ year, maxYear, today, meetings, loading, error, activeId, isDisabled, onYear, onRetry, onOpen }: Props) {
  const sorted = [...meetings].sort((a, b) => (a.heldOn < b.heldOn ? 1 : a.heldOn > b.heldOn ? -1 : b.id - a.id));
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Text type="label">{year}년 회의 목록</Text>
          <YearStepper value={year} onChange={onYear} isDisabled={isDisabled} max={maxYear} />
          {!loading && !error && <Chip tone={sorted.length > 0 ? 'info' : 'neutral'} label={`${sorted.length}회`} />}
        </HStack>
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {loading && meetings.length === 0 && !error ? (
          <Loading size="section" label="회의 기록을 불러오는 중..." />
        ) : sorted.length === 0 && !error ? (
          <Text type="supporting" color="secondary">{year}년에 기록한 사례관리 회의가 없습니다. 아래 양식에서 회의를 기록해 주세요.</Text>
        ) : (
          <div className={styles.listStack}>
            {sorted.map((m) => (
              <button key={m.id} type="button" className={styles.listRow} data-active={m.id === activeId} onClick={() => onOpen(m)}>
                <Text type="label" hasTabularNumbers>{dotDate(m.heldOn)}</Text>
                <Text type="supporting">대상 {elderText(m)}</Text>
                <Text type="supporting" color="secondary" hasTabularNumbers>참석 {m.attendees.length}명</Text>
                <span className={styles.chipLine}>
                  {meetingFollowSummary(m.heldOn, m.targets, today).map((c) => (
                    <Chip key={c.label} tone={c.tone} label={c.label} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}
      </VStack>
    </Card>
  );
}
