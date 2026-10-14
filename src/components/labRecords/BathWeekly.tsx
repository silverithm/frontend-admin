'use client';

/** 그 주(월~일)에 아직 목욕을 하지 않은 출석 어르신 — 주야간보호 목욕 가산은 수급자당 주 1회라서 빠뜨리지 않게 보여 준다. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { getElderAttendanceRange } from '@/lib/apiService';
import type { BathLog } from '@/lib/lab/labTypes';
import { weeklyBath } from '@/lib/lab/bathRules';
import { Chip } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { shortDate } from './BathDraft';
import { presentDatesOf } from './useElderAttendance';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

interface Props {
  elders: LabElder[];
  logs: BathLog[];
  monday: string;
  sunday: string;
  isCurrentWeek: boolean;
  onRecord: (elderId: number) => void;
}

export default function BathWeekly({ elders, logs, monday, sunday, isCurrentWeek, onRecord }: Props) {
  const [attended, setAttended] = useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const today = todayString();
  const end = sunday > today ? today : sunday;

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    getElderAttendanceRange(monday, end)
      .then((data) => {
        if (n !== seq.current) return;
        setAttended(new Set(Object.keys(presentDatesOf(data)).map(Number)));
      })
      .catch(() => {
        if (n === seq.current) setAttended(null);
      })
      .finally(() => {
        if (n === seq.current) setLoading(false);
      });
    return () => {
      seq.current += 1;
    };
  }, [monday, end]);

  const targets = useMemo(() => (attended ? elders.filter((e) => attended.has(e.id)) : elders), [elders, attended]);
  const rows = useMemo(() => weeklyBath(logs, targets.map((e) => e.id), monday), [logs, targets, monday]);
  const nameOf = (id: number) => elders.find((e) => e.id === id)?.name ?? '어르신';
  const missing = rows.filter((r) => r.count === 0);
  const label = isCurrentWeek ? '이번 주' : '이 주';

  return (
    <Card padding={4}>
      <div className={styles.stackTight}>
        <div className={styles.rowHead}>
          <Text type="label">
            {label}({shortDate(monday)}~{shortDate(sunday)}) 목욕 아직 안 한 {attended ? '출석 ' : ''}어르신
          </Text>
          {!loading && <Chip tone={missing.length > 0 ? 'warn' : 'ok'} label={`${targets.length}명 중 ${missing.length}명`} />}
        </div>
        {!loading && attended === null && <div className={own.warnBlock}>출석 정보를 불러오지 못해 모든 어르신을 보여 드립니다.</div>}
        {loading ? (
          <Text type="supporting" color="secondary">
            불러오는 중...
          </Text>
        ) : targets.length === 0 ? (
          <Text type="supporting" color="secondary">
            이 주에 출석한 어르신이 없습니다.
          </Text>
        ) : missing.length === 0 ? (
          <Text type="supporting" color="secondary">
            출석한 어르신 모두 이 주에 목욕을 했습니다.
          </Text>
        ) : (
          <div className={own.doseActions}>
            {missing.map((r) => (
              <Button key={r.elderlyId} label={`${nameOf(r.elderlyId)} 기록하기`} variant="secondary" onClick={() => onRecord(r.elderlyId)} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
