'use client';

/** 오늘 기준 식사 형태별 인원 — 다진식·죽식은 따로 준비해야 하므로 식단표 맨 위에 보여 준다. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { getCompanyElders } from '@/lib/apiService';
import { softDietCount, softDietTotal } from '@/lib/lab/mealRules';
import type { SoftDietCount } from '@/lib/lab/mealRules';
import { ErrorBanner } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { useElderAttendance } from './useElderAttendance';
import styles from './labRecords.module.css';

interface MealElder {
  id: number;
  mealType: string | null;
}

/** 어르신 식사 형태(careProfile.mealType)만 읽는다. 이름은 들고 있지 않는다. */
export function useMealElders() {
  const [state, setState] = useState<{ elders: MealElder[]; isLoading: boolean; error: string | null }>({ elders: [], isLoading: true, error: null });
  const seq = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    getCompanyElders()
      .then((data: unknown) => {
        if (n !== seq.current) return;
        const box = data as { elders?: unknown; content?: unknown; data?: unknown } | null;
        const raw = Array.isArray(data) ? data : box?.elders ?? box?.content ?? box?.data ?? [];
        const list = (Array.isArray(raw) ? raw : []) as Array<{ id?: unknown; careProfile?: { mealType?: unknown } | null }>;
        const elders = list.map((e) => ({ id: Number(e.id), mealType: typeof e.careProfile?.mealType === 'string' ? e.careProfile.mealType : null }));
        setState({ elders, isLoading: false, error: null });
      })
      .catch((e) => {
        if (n === seq.current) setState({ elders: [], isLoading: false, error: errorText(e, '어르신 식사 형태를 불러오지 못했습니다') });
      });
    return () => {
      seq.current += 1;
    };
  }, [tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

interface DietProps {
  elders: MealElder[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /** AI에 넘길 다진식·죽식 인원을 위로 알린다 */
  onCount: (n: number | undefined) => void;
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={styles.statBox}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <Text type="large" weight={strong ? 'semibold' : undefined} hasTabularNumbers>
        {value}명
      </Text>
    </div>
  );
}

export default function MealPlanDiet({ elders, isLoading, error, onRetry, onCount }: DietProps) {
  const attendance = useElderAttendance(todayString());
  // 오늘 출석 기록이 있으면 출석한 분만, 없으면 등록된 어르신 전체
  const useAttendance = attendance.hasData && !attendance.isLoading;
  const target = useMemo(() => (useAttendance ? elders.filter((e) => attendance.present.has(e.id)) : elders), [elders, useAttendance, attendance.present]);
  const count: SoftDietCount = useMemo(() => softDietCount(target), [target]);
  const soft = softDietTotal(count);
  const ready = !isLoading && !error && !attendance.isLoading;

  useEffect(() => {
    onCount(ready ? soft : undefined);
  }, [ready, soft, onCount]);

  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  return (
    <Card padding={4}>
      <HStack gap={4} vAlign="center" wrap="wrap">
        <div>
          <Text type="label">오늘 식사 형태</Text>
          <br />
          <Text type="supporting" color="secondary">
            {isLoading || attendance.isLoading ? '불러오는 중...' : useAttendance ? `오늘 출석한 ${target.length}명 기준` : `출결 기록이 없어 등록된 ${target.length}명 기준`}
          </Text>
        </div>
        <Stat label="다진식·죽식 준비" value={soft} strong />
        <Stat label="다진식" value={count.chopped} />
        <Stat label="죽식" value={count.porridge} />
        <Stat label="혼합식" value={count.mixed} />
        <Stat label="일반식" value={count.regular} />
      </HStack>
    </Card>
  );
}
