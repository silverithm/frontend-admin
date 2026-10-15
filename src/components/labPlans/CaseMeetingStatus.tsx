'use client';

/** 반기 현황 — 이번 반기·지난 반기의 기준①(반기 1회·필수 칸·3인 이상 직종별)과 기준②(30일 안 반영, 그 뒤 30일 안 평가). */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import type { Tone } from '@/components/lab/LabUi';
import { halfYearStatus } from '@/lib/lab/caseMeetingRules';
import type { CaseMeeting, StaffProfile } from '@/lib/lab/labTypes';
import styles from './labPlans10.module.css';

interface Props {
  meetings: CaseMeeting[];
  profiles: StaffProfile[];
  today: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

type Half = { year: number; half: 1 | 2; current: boolean };

function halvesOf(today: string): Half[] {
  const year = Number(today.slice(0, 4));
  const half: 1 | 2 = Number(today.slice(5, 7)) <= 6 ? 1 : 2;
  const last: Half = half === 1 ? { year: year - 1, half: 2, current: false } : { year, half: 1, current: false };
  return [{ year, half, current: true }, last];
}

const halfName = (h: Half) => `${h.year}년 ${h.half === 1 ? '상반기(1~6월)' : '하반기(7~12월)'}`;

const C2_CHIP: Record<'NA' | 'NOT_MET' | 'MET' | 'IN_PROGRESS', { tone: Tone; label: string }> = {
  MET: { tone: 'ok', label: '충족' },
  IN_PROGRESS: { tone: 'warn', label: '진행 중' },
  NOT_MET: { tone: 'danger', label: '미충족' },
  NA: { tone: 'neutral', label: '해당 없음' },
};

export default function CaseMeetingStatus({ meetings, profiles, today, loading, error, onRetry }: Props) {
  const halves = halvesOf(today);
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">반기 현황</Text>
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {loading && meetings.length === 0 && !error ? (
          <Loading size="section" label="반기 현황을 계산하는 중..." />
        ) : (
          !error && (
            <div className={styles.statusGrid}>
              {halves.map((h) => {
                const s = halfYearStatus(meetings, profiles, h.year, h.half, today);
                const c1: { tone: Tone; label: string } = s.c1 ? { tone: 'ok', label: '충족' } : h.current ? { tone: 'warn', label: '진행 중' } : { tone: 'danger', label: '미충족' };
                const c2 = C2_CHIP[s.c2];
                return (
                  <div key={`${h.year}-${h.half}`} className={styles.statusBox}>
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <Text type="label">{h.current ? '이번 반기' : '지난 반기'}</Text>
                      <Text type="supporting" color="secondary">{halfName(h)}</Text>
                    </HStack>
                    <div className={styles.criteriaRow}>
                      <Chip tone={c1.tone} label={`기준① ${c1.label}`} />
                      <Text type="supporting" color="secondary">반기 1회 · 필수 칸 · 3인 이상 직종별</Text>
                    </div>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      회의 {s.count}회 중 필수 칸·참석 직종을 갖춘 회의 {s.okCount}회
                    </Text>
                    <div className={styles.criteriaRow}>
                      <Chip tone={c2.tone} label={`기준② ${c2.label}`} />
                      <Text type="supporting" color="secondary">다음날부터 30일 안 반영 · 그 뒤 30일 안 평가</Text>
                    </div>
                    {s.c2 === 'NA' && <SupportText>갖춘 회의의 대상이 없어 판정하지 않습니다.</SupportText>}
                  </div>
                );
              })}
            </div>
          )
        )}
        <SupportText>수급자별이 아니라 기관 단위로 반기마다 1회 이상으로 읽었습니다. 판정 단위와 반영 기한 산정 시작일은 대조 필요입니다.</SupportText>
      </VStack>
    </Card>
  );
}
