'use client';

/** 올해 회의 현황(횟수·정기/임시·마지막 회의·분기별)과 회의 목록. 개최 주기는 법령에 숫자가 없어 기관 기준(분기 1회)으로 안내만 한다. */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { meetingsByQuarter, meetingsInYear } from '@/lib/lab/committeeRules';
import type { CommitteeMeeting } from '@/lib/lab/labTypes';
import eight from './labPlans8.module.css';

interface Props {
  year: number;
  today: string;
  meetings: CommitteeMeeting[];
  loading: boolean;
  error: string | null;
  activeId: number | null;
  onRetry: () => void;
  onOpen: (m: CommitteeMeeting) => void;
}

export default function CommitteeMeetingList({ year, today, meetings, loading, error, activeId, onRetry, onOpen }: Props) {
  const summary = meetingsInYear(meetings, year);
  const quarters = meetingsByQuarter(meetings, year);
  const thisYear = Number(today.slice(0, 4));
  const currentQuarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  // 올해는 지난 분기와 이번 분기까지, 지난 해는 4개 분기 모두 본다
  const checked = year < thisYear ? 4 : year === thisYear ? currentQuarter + 1 : 0;
  const empty = quarters.map((n, i) => (i < checked && n === 0 ? i + 1 : 0)).filter((q) => q > 0);
  const sorted = [...meetings].sort((a, b) => (a.heldOn < b.heldOn ? 1 : a.heldOn > b.heldOn ? -1 : b.id - a.id));

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{year}년 회의 현황</Text>
          {!loading && !error && <Chip tone={summary.count > 0 ? 'ok' : 'neutral'} label={`${summary.count}회`} />}
        </HStack>
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {!error && !loading && (
          <>
            <HStack gap={4} wrap="wrap">
              <Text type="supporting" color="secondary" hasTabularNumbers>정기 {summary.regular}회 · 임시 {summary.special}회</Text>
              <Text type="supporting" color="secondary" hasTabularNumbers>마지막 회의 {summary.lastHeldOn ? dotDate(summary.lastHeldOn) : '없음'}</Text>
              <Text type="supporting" color="secondary" hasTabularNumbers>분기별 {quarters.join(' · ')}회</Text>
            </HStack>
            {empty.length > 0 && <SupportText tone="warn">{empty.map((q) => `${q}분기`).join('·')}에 연 회의가 없습니다. 기관 기준(예: 분기 1회)이라면 확인해 보세요.</SupportText>}
          </>
        )}
        <SupportText>회의를 얼마나 자주 열어야 하는지는 법령 본문에 숫자가 없습니다. ‘분기 1회’는 기관 기준 예시이고 대조 필요합니다. 기관의 운영규정이나 지자체 지침을 확인해 주세요.</SupportText>
        {loading && meetings.length === 0 ? (
          <Loading size="section" label="회의 기록을 불러오는 중..." />
        ) : sorted.length === 0 && !error ? (
          <Text type="supporting" color="secondary">{year}년에 기록한 회의가 없습니다. 아래 양식에서 회의를 기록해 주세요.</Text>
        ) : (
          <div className={eight.listStack}>
            {sorted.map((m) => (
              <button key={m.id} type="button" className={eight.listRow} data-active={m.id === activeId} onClick={() => onOpen(m)}>
                <Text type="label" hasTabularNumbers>{dotDate(m.heldOn)}</Text>
                <Chip tone={m.kind === 'REGULAR' ? 'info' : 'warn'} label={m.kind === 'REGULAR' ? '정기' : '임시'} />
                <Text type="supporting" color="secondary" hasTabularNumbers>참석 {m.attendeeIds.length}명</Text>
                <Text type="supporting">{m.agenda.split('\n')[0].slice(0, 40)}</Text>
              </button>
            ))}
          </div>
        )}
      </VStack>
    </Card>
  );
}
