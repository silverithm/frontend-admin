'use client';

/**
 * 달 보기의 "5등급·인지지원 인지활동형 누락" 목록 — 출석한 날 그 어르신이 60분 이상·인정 제공자의 인지활동형 프로그램에 참여했는지 본다.
 * 출석(PRESENT만)이나 등급·일지를 불러오지 못하면 이 목록만 "불러오지 못함"으로 두고 화면은 멈추지 않는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { getElderAttendanceRange } from '@/lib/apiService';
import { COGNITIVE_STATE_LABEL, monthCognitiveGaps } from '@/lib/lab/cognitiveProgramRules';
import type { Program } from '@/lib/lab/labTypes';
import { Chip } from '@/components/lab/LabUi';
import { dateLabel, monthLabel, monthRange, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { attendanceByDayOf } from './ProgramLogCognitiveData';
import styles from './labRecords.module.css';
import logStyles from './ProgramLog.module.css';

const SHOW_LIMIT = 100;

interface Props {
  month: string;
  programs: Program[];
  /** 일지·어르신 목록을 불러오는 중이거나 불러오지 못했으면 판단하지 않는다(일지가 없는 것처럼 보이면 안 된다) */
  programsLoading: boolean;
  programsFailed: boolean;
  elders: LabElder[];
  eldersLoading: boolean;
  eldersFailed: boolean;
}

type Raw = { month: string; data: unknown } | { month: string; failed: true };

export default function ProgramLogCognitiveGaps({ month, programs, programsLoading, programsFailed, elders, eldersLoading, eldersFailed }: Props) {
  const [raw, setRaw] = useState<Raw | null>(null);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const { start, end } = monthRange(month);
    getElderAttendanceRange(start, end)
      .then((data) => {
        if (n === seq.current) setRaw({ month, data });
      })
      .catch(() => {
        if (n === seq.current) setRaw({ month, failed: true });
      });
    return () => {
      seq.current += 1;
    };
  }, [month, retry]);

  const attendance = raw !== null && raw.month === month ? raw : null;
  const failed = eldersFailed || programsFailed || (attendance !== null && 'failed' in attendance);
  const loading = !failed && (eldersLoading || programsLoading || attendance === null);

  const gaps = useMemo(() => {
    if (failed || loading || attendance === null || 'failed' in attendance) return [];
    const grades = new Map(elders.map((e) => [e.id, e.careGrade] as const));
    return monthCognitiveGaps(attendanceByDayOf(attendance.data, grades), programs.filter((p) => p.programDate.startsWith(month)));
  }, [failed, loading, attendance, elders, programs, month]);

  const nameOf = (id: number) => elders.find((e) => e.id === id)?.name ?? `어르신 ${id}`;
  const today = todayString();
  const shown = open ? gaps.slice(0, SHOW_LIMIT) : [];

  return (
    <Card padding={4}>
      <div className={styles.stackTight}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="label">{monthLabel(month)} 5등급·인지지원 인지활동형 누락</Text>
          {failed ? <Chip tone="neutral" label="불러오지 못함" /> : loading ? <Chip tone="neutral" label="확인하는 중" /> : gaps.length === 0 ? <Chip tone="ok" label="누락 없음" /> : <Chip tone="warn" label={`${gaps.length}건`} />}
        </HStack>
        <Text type="supporting" color="secondary">
          출석한 5등급·인지지원등급 어르신이 그날 인지활동형 프로그램(1회 60분 이상, 프로그램관리자·치매전문요양보호사·외부강사 제공)에 참여했는지 봅니다. 출석 기록이 없는 날은 따지지 않습니다.
        </Text>
        {failed && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">
              출석이나 어르신 등급, 프로그램 일지를 불러오지 못해 누락을 확인하지 못했습니다.
            </Text>
            {attendance !== null && 'failed' in attendance && <Button label="다시 확인" size="sm" variant="ghost" onClick={() => { setRaw(null); setRetry((v) => v + 1); }} />}
          </HStack>
        )}
        {!failed && !loading && gaps.length === 0 && (
          <Text type="supporting" color="secondary">
            출석한 날 중 인지활동형 제공이 빠진 날이 없습니다.
          </Text>
        )}
        {gaps.length > 0 && (
          <div>
            <Button label={open ? '목록 접기' : `누락 ${gaps.length}건 보기`} variant="ghost" onClick={() => setOpen((v) => !v)} />
          </div>
        )}
        {open && gaps.length > 0 && (
          <div className={logStyles.gapList} role="list">
            {shown.map((g) => (
              <div className={logStyles.gapRow} role="listitem" key={`${g.date}-${g.elderlyId}`}>
                <div className={styles.stackTight}>
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Text type="body" weight="medium">
                      {dateLabel(g.date)} · {nameOf(g.elderlyId)}
                    </Text>
                    {g.date === today && <Chip tone="neutral" label="오늘 — 아직 기록 중일 수 있음" />}
                  </HStack>
                  <Text type="supporting" color="secondary">
                    {COGNITIVE_STATE_LABEL[g.state]}
                  </Text>
                  <Text type="supporting" color="secondary">
                    이 날 급여비용을 산정할 수 없습니다(고시 제32조⑩). 예외로 인정할 사정이 있으면 급여제공기록지에 사유를 적어 주세요.
                  </Text>
                </div>
              </div>
            ))}
            {gaps.length > SHOW_LIMIT && (
              <div className={logStyles.gapRow}>
                <Text type="supporting" color="secondary">
                  앞의 {SHOW_LIMIT}건만 보여 드립니다. 나머지 {gaps.length - SHOW_LIMIT}건은 일지를 채우면 줄어듭니다.
                </Text>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
