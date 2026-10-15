'use client';

/**
 * 감염병 대응 — 유행·발생·국가 위기 경보를 기록하고 보호자 안내·보건소 신고·지자체·공단 보고를 챙기는 화면(2026 감염관리 기준③).
 * 위쪽은 대응계획 문서 상태(규정·지침 대장)와 올해 감염 교육 건수, 아래는 연도별 기록 목록과 쓰기, 한 건 A4 인쇄.
 */
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listOutbreaks, listPolicyDocs, listStaffTrainings } from '@/lib/lab/labApi';
import type { Outbreak, OutbreakKind, PolicyDoc, StaffTraining } from '@/lib/lab/labTypes';
import { outbreakSummary } from '@/lib/lab/outbreakRules';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import OutbreakEditor from './OutbreakEditor';
import OutbreakList from './OutbreakList';
import OutbreakPlanStatus from './OutbreakPlanStatus';
import OutbreakSheet from './OutbreakSheet';
import { YearStepper } from './RecordsUi';
import { yearOf } from './recordsFormat';
import { useRecordsLoader } from './useRecordsLoader';
import styles from './labRecords.module.css';
import own from './Outbreak.module.css';

type Mode = { type: 'list' } | { type: 'edit'; outbreak: Outbreak | null } | { type: 'print'; outbreak: Outbreak };
type Filter = 'ALL' | OutbreakKind;

const NO_OUTBREAKS: Outbreak[] = [];
const NO_DOCS: PolicyDoc[] = [];
const NO_TRAININGS: StaffTraining[] = [];

export default function OutbreakLab() {
  const thisYear = yearOf(todayString());
  const [year, setYear] = useState(thisYear);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [filter, setFilter] = useState<Filter>('ALL');

  const loadOutbreaks = useCallback(() => listOutbreaks(year), [year]);
  const loadTrainings = useCallback(() => listStaffTrainings(thisYear), [thisYear]);
  const outbreaks = useRecordsLoader(loadOutbreaks, '감염병 유행·발생 기록을 불러오지 못했습니다', NO_OUTBREAKS);
  const docs = useRecordsLoader(listPolicyDocs, '규정·지침 대장을 불러오지 못했습니다', NO_DOCS);
  const trainings = useRecordsLoader(loadTrainings, '직원 교육 기록을 불러오지 못했습니다', NO_TRAININGS);

  const summary = useMemo(() => outbreakSummary(outbreaks.data, `${year}-01-01`, `${year}-12-31`, todayString()), [outbreaks.data, year]);
  const shown = useMemo(() => outbreaks.data.filter((o) => filter === 'ALL' || o.kind === filter), [outbreaks.data, filter]);

  if (mode.type === 'print') return <OutbreakSheet outbreak={mode.outbreak} onDone={() => setMode({ type: 'list' })} />;

  if (mode.type === 'edit') {
    return (
      <div className={styles.stack}>
        <OutbreakEditor
          key={mode.outbreak?.id ?? 'new'}
          outbreak={mode.outbreak}
          onSaved={(_isNew, startedOn) => {
            // 다른 연도 날짜로 저장했다면 그 연도로 따라간다
            if (yearOf(startedOn) !== year) setYear(yearOf(startedOn));
            else void outbreaks.reload();
            setMode({ type: 'list' });
          }}
          onClose={() => setMode({ type: 'list' })}
          onPrint={(o) => setMode({ type: 'print', outbreak: o })}
        />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <OutbreakPlanStatus docs={docs} trainings={trainings} year={thisYear} />

      <details className={own.guide}>
        <summary>기록 기준 안내 (2023 공단 안전·감염관리 매뉴얼)</summary>
        <p>유행은 같은 증상 환자가 2명 이상이거나 심각한 감염병이 1건 나온 경우입니다.</p>
        <p>확진·의심 환자가 나오면 즉시 보건소에 통보하고, 지자체와 공단에 보고합니다. 보호자에게도 알립니다.</p>
        <p>최후 접촉자를 최대 잠복기간까지 추적해 새 발병이 없으면 종료합니다.</p>
        <p>평가에서는 면담과 함께 조치 자료를 봅니다. 신고 기한(며칠 안)은 확인하지 못해 날짜가 비어 있는지만 점검합니다.</p>
      </details>

      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={setYear} isDisabled={outbreaks.isLoading} max={thisYear} />
        <Text type="supporting" color="secondary">
          {outbreaks.isLoading && outbreaks.data.length === 0 ? '불러오는 중...' : `${year}년 유행·발생 ${summary.total}건`}
        </Text>
        <div className={styles.spacer}>
          <Button label="유행·발생 기록 쓰기" variant="primary" onClick={() => setMode({ type: 'edit', outbreak: null })} />
        </div>
      </div>

      {summary.total > 0 && (
        <HStack gap={2} wrap="wrap">
          <Chip tone={summary.open > 0 ? 'danger' : 'neutral'} label={`진행 중 ${summary.open}건`} />
          <Chip tone={summary.complete === summary.total ? 'ok' : 'warn'} label={`신고·보고 갖춤 ${summary.complete}/${summary.total}건`} />
          <Chip tone={summary.withActions === summary.total ? 'ok' : 'warn'} label={`조치 기록 ${summary.withActions}/${summary.total}건`} />
        </HStack>
      )}

      <SegmentedControl label="종류 거르기" value={filter} onChange={(v) => setFilter(v as Filter)}>
        <SegmentedControlItem value="ALL" label="전체" />
        <SegmentedControlItem value="OUTBREAK" label="기관 내 유행" />
        <SegmentedControlItem value="CASE" label="확진·의심 발생" />
        <SegmentedControlItem value="NATIONAL" label="국가 위기 경보" />
      </SegmentedControl>

      {outbreaks.error && <ErrorBanner message={outbreaks.error} onRetry={() => void outbreaks.reload()} />}

      {outbreaks.isLoading && outbreaks.data.length === 0 ? (
        <Loading size="inline" label="불러오는 중..." />
      ) : (
        !outbreaks.error && (
          <OutbreakList year={year} outbreaks={shown} isFiltered={filter !== 'ALL'} onOpen={(o) => setMode({ type: 'edit', outbreak: o })} onPrint={(o) => setMode({ type: 'print', outbreak: o })} onCreate={() => setMode({ type: 'edit', outbreak: null })} />
        )
      )}
    </div>
  );
}
