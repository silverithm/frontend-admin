'use client';

/**
 * 계획 변경 — 위에는 올해 계획 반영이 필요한 상태변화(눈에 띄는 것부터), 아래는 어르신을 골라 보는 변경 이력과 쓰기 화면.
 * 상태변화 줄의 '계획 변경 쓰기'를 누르면 그 어르신·그 상태변화가 미리 채워진 쓰기 화면이 열린다.
 */
import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Selector } from '@astryxdesign/core/Selector';
import { Loading } from '@/components/Loading';
import { listCareEvents, listCarePlanChanges } from '@/lib/lab/labApi';
import type { CareEvent, CarePlanChange } from '@/lib/lab/labTypes';
import { ErrorBanner } from '@/components/lab/LabUi';
import { currentMonth, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import ConsultationCarePlanChangeElder from './ConsultationCarePlanChangeElder';
import type { ChangeMode } from './ConsultationCarePlanChangeElder';
import ConsultationCarePlanChangeReflection from './ConsultationCarePlanChangeReflection';
import { useRecordsLoader } from './useRecordsLoader';
import { yearOf } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  eldersLoading: boolean;
}

const NONE_EVENTS: CareEvent[] = [];
const NONE_CHANGES: CarePlanChange[] = [];

/** 올해 1월부터 이번 달까지의 상태변화·사고 기록(달별로 읽어 합친다) */
async function loadYearEvents(year: number): Promise<CareEvent[]> {
  const last = Number(currentMonth().slice(5, 7));
  const months = Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const lists = await Promise.all(months.map((m) => listCareEvents({ month: m })));
  const byId = new Map<number, CareEvent>();
  for (const e of lists.flat()) byId.set(e.id, e);
  return [...byId.values()];
}

export default function ConsultationCarePlanChangeView({ elders, eldersLoading }: Props) {
  const year = yearOf(todayString());
  const [elderId, setElderId] = useState<number | null>(null);
  const [mode, setMode] = useState<ChangeMode>({ type: 'list' });

  const loadEvents = useCallback(() => loadYearEvents(year), [year]);
  const loadChanges = useCallback(() => listCarePlanChanges({ year }), [year]);
  const yearEvents = useRecordsLoader(loadEvents, '올해 상태변화·사고 기록을 불러오지 못했습니다', NONE_EVENTS);
  const yearChanges = useRecordsLoader(loadChanges, '올해 계획 변경 이력을 불러오지 못했습니다', NONE_CHANGES);

  const elder = elders.find((e) => e.id === elderId) ?? null;
  const options = useMemo(() => elders.map((e) => ({ value: String(e.id), label: e.name })), [elders]);

  const reloadYear = () => {
    void yearChanges.reload();
    void yearEvents.reload();
  };

  // 쓰기·인쇄 중에는 어르신 고르기와 상태변화 목록을 숨겨 한 가지에 집중하게 한다
  const focus = elder !== null && mode.type !== 'list';
  const yearLoading = (yearEvents.isLoading || yearChanges.isLoading) && yearEvents.data.length === 0 && yearChanges.data.length === 0;

  return (
    <div className={styles.stack}>
      {!focus && yearEvents.error && <ErrorBanner message={yearEvents.error} onRetry={() => void yearEvents.reload()} />}
      {!focus && yearChanges.error && <ErrorBanner message={yearChanges.error} onRetry={() => void yearChanges.reload()} />}

      {!focus &&
        (yearLoading ? (
          <Loading size="inline" label="상태변화 기록을 불러오는 중..." />
        ) : (
          !yearEvents.error &&
          !yearChanges.error && (
            <ConsultationCarePlanChangeReflection
              year={year}
              events={yearEvents.data}
              changes={yearChanges.data}
              onWrite={(elderlyId, eventId) => {
                if (!elders.some((e) => e.id === elderlyId)) return;
                setElderId(elderlyId);
                setMode({ type: 'edit', change: null, preset: { date: todayString(), eventId, reason: 'FUNCTION_CHANGE' } });
              }}
            />
          )
        ))}

      {eldersLoading ? (
        <Loading size="inline" label="어르신 목록을 불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : (
        <>
          {!focus && (
            <Selector
              label="어르신별 변경 이력"
              placeholder="어르신 고르기"
              hasSearch
              searchPlaceholder="찾기"
              options={options}
              value={elderId === null ? '' : String(elderId)}
              onChange={(v) => v && setElderId(Number(v))}
            />
          )}
          {elder ? (
            <ConsultationCarePlanChangeElder key={elder.id} elder={elder} mode={mode} onMode={setMode} onChanged={reloadYear} />
          ) : (
            <EmptyState isCompact title="어르신을 고르면 변경 이력이 보입니다" description="급여내용·시간·횟수를 바꾼 기록과 보호자 확인, 공단 통보 여부를 한눈에 봅니다." />
          )}
        </>
      )}
    </div>
  );
}
