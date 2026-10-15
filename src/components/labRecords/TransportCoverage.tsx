'use client';

/**
 * 달 운행 현황 — 출석한 날 대비 운행일지를 쓴 날(transportLogCoverage). 일지가 없는 날은 눌러서 바로 쓰러 갈 수 있다.
 * 등원·하원 중 한 건이라도 있으면 쓴 날로 세고, 일지에 운전원과 탑승자가 있어야 '갖춘 날'이다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { getElderAttendanceRange } from '@/lib/apiService';
import { listTransportLogs } from '@/lib/lab/labApi';
import { transportLogCoverage } from '@/lib/lab/transportRules';
import { ErrorBanner, MonthStepper, SupportText } from '@/components/lab/LabUi';
import { dateLabel, errorText, monthRange, todayString } from '@/components/lab/labFormat';
import { presentDatesOf } from './useElderAttendance';
import { useRecordsLoader } from './useRecordsLoader';
import styles from './labRecords.module.css';
import own from './Transport.module.css';

interface Props {
  initialMonth: string;
  /** 일지를 저장·삭제하면 바뀌는 값 — 다시 센다 */
  reloadKey: number;
  onPickDate: (date: string) => void;
}

export default function TransportCoverage({ initialMonth, reloadKey, onPickDate }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const loadLogs = useCallback(async () => {
    void reloadKey; // 저장·삭제 뒤 다시 읽도록 묶어 둔 값
    return listTransportLogs({ month });
  }, [month, reloadKey]);
  const logs = useRecordsLoader(loadLogs, '이 달 운행일지를 불러오지 못했습니다', []);

  const [dates, setDates] = useState<string[] | null>(null);
  const [datesLoading, setDatesLoading] = useState(true);
  const [datesError, setDatesError] = useState<string | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    setDatesLoading(true);
    setDatesError(null);
    const { start, end } = monthRange(month);
    getElderAttendanceRange(start, end)
      .then((data) => {
        if (n !== seq.current) return;
        const all = new Set<string>();
        for (const list of Object.values(presentDatesOf(data))) for (const d of list) all.add(d);
        setDates([...all].sort());
      })
      .catch((e: unknown) => {
        if (n !== seq.current) return;
        setDates(null);
        setDatesError(errorText(e, '이 달 출석 정보를 불러오지 못했습니다'));
      })
      .finally(() => {
        if (n === seq.current) setDatesLoading(false);
      });
    return () => {
      seq.current += 1;
    };
  }, [month, reloadKey]);

  const today = todayString();
  const result = useMemo(() => (dates ? transportLogCoverage(logs.data, dates, month) : null), [logs.data, dates, month]);
  const missing = useMemo(() => {
    if (!dates) return [];
    const logged = new Set(logs.data.map((l) => l.runDate.slice(0, 10)));
    return dates.filter((d) => d <= today && !logged.has(d));
  }, [dates, logs.data, today]);
  const loading = logs.isLoading || datesLoading;

  return (
    <Card padding={4}>
      <div className={styles.stack}>
        <div className={styles.toolbar}>
          <div>
            <Text type="large" weight="semibold">
              달 운행 현황
            </Text>
            <Text type="supporting" color="secondary">
              출석한 날마다 운행일지를 썼는지 봅니다
            </Text>
          </div>
          <div className={styles.spacer}>
            <MonthStepper value={month} onChange={setMonth} isDisabled={loading} />
          </div>
        </div>
        {logs.error && <ErrorBanner message={logs.error} onRetry={() => void logs.reload()} />}
        {datesError && <ErrorBanner message={`${datesError}. 출석한 날을 알 수 없어 작성률을 세지 못했습니다`} />}
        {loading && <Loading size="inline" label="운행 현황을 세는 중..." />}
        {!loading && !logs.error && result && (
          <>
            <div className={own.summaryBox}>
              <div className={own.summaryItem}>
                <Text type="supporting" color="secondary">
                  일지 작성률
                </Text>
                <Text type="large" weight="semibold" hasTabularNumbers>
                  {result.rate === null ? '-' : `${result.rate}%`}
                </Text>
              </div>
              <div className={own.summaryItem}>
                <Text type="supporting" color="secondary">
                  출석한 날
                </Text>
                <Text type="label" hasTabularNumbers>
                  {result.days}일
                </Text>
              </div>
              <div className={own.summaryItem}>
                <Text type="supporting" color="secondary">
                  일지를 쓴 날
                </Text>
                <Text type="label" hasTabularNumbers>
                  {result.logged}일
                </Text>
              </div>
              <div className={own.summaryItem}>
                <Text type="supporting" color="secondary">
                  운전원·탑승자까지 갖춘 날
                </Text>
                <Text type="label" hasTabularNumbers>
                  {result.complete}일
                </Text>
              </div>
            </div>
            {result.days === 0 ? (
              <SupportText>이 달에는 출석 기록이 없습니다.</SupportText>
            ) : missing.length === 0 ? (
              <SupportText>출석한 날의 운행일지를 모두 썼습니다.</SupportText>
            ) : (
              <div>
                <Text type="label">일지가 없는 날 ({missing.length}일) — 눌러서 쓰기</Text>
                <div className={own.chipRow}>
                  {missing.map((d) => (
                    <button key={d} type="button" className={own.dateChip} onClick={() => onPickDate(d)}>
                      {dateLabel(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
