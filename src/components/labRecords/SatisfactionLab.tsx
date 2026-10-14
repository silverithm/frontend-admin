'use client';

/**
 * 급여 만족도 — 종류(식사·프로그램·이동서비스·전반)를 고르고 응답을 받고, 기간 요약·식사 반기 현황·의견 주제 묶기·결과 인쇄를 한다.
 * 2026 평가 36(면담으로 식사·프로그램·이동서비스 만족 확인), 33 식사 기준②(반기별 식사 만족도).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Loading } from '@/components/Loading';
import { listSatisfaction } from '@/lib/lab/labApi';
import type { SatisfactionKind, SatisfactionResponse, SurveySummaryAiResult } from '@/lib/lab/labTypes';
import { SATISFACTION_KINDS, mealSurveyCoverage, mealSurveyHalfStatus, surveySummary } from '@/lib/lab/satisfactionRules';
import { ErrorBanner, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import SatisfactionAiThemes from './SatisfactionAiThemes';
import { validatePeriod } from './SatisfactionDraft';
import SatisfactionForm from './SatisfactionForm';
import SatisfactionMealStatus from './SatisfactionMealStatus';
import { useSatisfactionPrint } from './SatisfactionPrintJob';
import SatisfactionResponses from './SatisfactionResponses';
import SatisfactionSheet from './SatisfactionSheet';
import type { SatisfactionSheetData } from './SatisfactionSheet';
import SatisfactionSummary from './SatisfactionSummary';
import styles from './labRecords.module.css';

export default function SatisfactionLab() {
  const notify = useNotify();
  const today = todayString();
  const year = Number(today.slice(0, 4));
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [kind, setKind] = useState<SatisfactionKind>('MEAL');
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(today);
  const [responses, setResponses] = useState<SatisfactionResponse[]>([]);
  const [yearMeal, setYearMeal] = useState<SatisfactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mealError, setMealError] = useState<string | null>(null);
  const [themes, setThemes] = useState<SurveySummaryAiResult | null>(null);
  const [printing, print] = useSatisfactionPrint<SatisfactionSheetData>();
  const seq = useRef(0);
  const mealSeq = useRef(0);

  const periodProblem = validatePeriod(from, to);

  const load = useCallback(async (f: string, t: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listSatisfaction({ from: f, to: t });
      if (n !== seq.current) return;
      setResponses(list);
    } catch (e) {
      if (n !== seq.current) return;
      setResponses([]);
      setError(errorText(e, '만족도 응답을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  // 식사 반기 현황은 보고 있는 기간과 상관없이 올해 전체 식사 응답으로 센다
  const loadMeal = useCallback(async () => {
    const n = ++mealSeq.current;
    setMealError(null);
    try {
      const list = await listSatisfaction({ kind: 'MEAL', from: `${year}-01-01`, to: todayString() });
      if (n !== mealSeq.current) return;
      setYearMeal(list);
    } catch (e) {
      if (n !== mealSeq.current) return;
      setMealError(errorText(e, '식사 만족도 반기 현황을 불러오지 못했습니다'));
    }
  }, [year]);

  useEffect(() => {
    if (periodProblem) {
      seq.current += 1;
      setLoading(false);
      return;
    }
    void load(from, to);
    return () => {
      seq.current += 1;
    };
  }, [from, to, periodProblem, load]);

  useEffect(() => {
    void loadMeal();
    return () => {
      mealSeq.current += 1;
    };
  }, [loadMeal]);

  const kindResponses = useMemo(() => responses.filter((r) => r.kind === kind), [responses, kind]);
  const summary = useMemo(() => surveySummary(responses, kind), [responses, kind]);
  const comments = useMemo(() => kindResponses.map((r) => (r.comment ?? '').trim()).filter((c) => c !== ''), [kindResponses]);
  const mealStatus = useMemo(() => mealSurveyHalfStatus(yearMeal, year), [yearMeal, year]);
  const coverage = useMemo(() => (eldersError || elders.length === 0 ? null : mealSurveyCoverage(yearMeal, year, elders.map((e) => e.id))), [yearMeal, year, elders, eldersError]);
  const names = useMemo(() => new Map(elders.map((e) => [e.id, e.name])), [elders]);

  const changeKind = (next: SatisfactionKind) => {
    setKind(next);
    setThemes(null);
  };

  const afterChange = () => {
    setThemes(null);
    if (!periodProblem) void load(from, to);
    void loadMeal();
  };

  return (
    <div className={styles.stack}>
      <div>
        <SegmentedControl label="종류" value={kind} onChange={(v) => v && changeKind(v as SatisfactionKind)}>
          {SATISFACTION_KINDS.map((k) => (
            <SegmentedControlItem key={k.value} value={k.value} label={k.label} />
          ))}
        </SegmentedControl>
      </div>

      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}

      <SatisfactionForm
        kind={kind}
        elders={elders}
        eldersLoading={eldersLoading}
        onSaved={() => {
          notify('만족도 응답을 저장했습니다', 'success');
          afterChange();
        }}
      />

      <div className={styles.toolbar}>
        <LabDateInput label="요약 시작일" value={from} onChange={setFrom} max={today} />
        <LabDateInput label="요약 끝나는 날" value={to} onChange={setTo} max={today} />
        <Button label="올해로 되돌리기" variant="ghost" onClick={() => { setFrom(`${year}-01-01`); setTo(today); }} />
        <div className={styles.spacer}>
          <Button
            label="결과 인쇄"
            variant="secondary"
            isDisabled={loading || !!error || !!periodProblem || summary.count === 0}
            onClick={() => print({ kind, from, to, summary, comments, meal: { year, status: mealStatus }, themes })}
          />
        </div>
      </div>
      {periodProblem && <ErrorBanner message={periodProblem} />}
      {error && <ErrorBanner message={error} onRetry={() => void load(from, to)} />}

      {loading ? (
        <Loading size="inline" label="만족도 응답을 불러오는 중..." />
      ) : (
        !periodProblem &&
        !error && (
          <>
            <SatisfactionSummary kind={kind} summary={summary} />
            <SatisfactionResponses kind={kind} responses={kindResponses} onDeleted={() => { notify('만족도 응답을 삭제했습니다', 'success'); afterChange(); }} />
            <SatisfactionAiThemes kind={kind} comments={comments} result={themes} onResult={setThemes} />
          </>
        )
      )}

      {mealError ? <ErrorBanner message={mealError} onRetry={() => void loadMeal()} /> : <SatisfactionMealStatus year={year} status={mealStatus} coverage={coverage} names={names} />}
      <SupportText>문항은 공단이 제시한 것이 아니라 기관이 만든 것입니다. 면담 때 어르신께 읽어 드리거나 보호자께 묻고, 들은 점수를 그대로 눌러 주세요.</SupportText>

      {printing && <SatisfactionSheet data={printing} />}
    </div>
  );
}
