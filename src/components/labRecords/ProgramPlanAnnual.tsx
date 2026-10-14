'use client';

/**
 * 프로그램 연간계획 — 신체기능·인지기능·사회적응 세 분야 카드. 각 카드에 작성 상태(없음·작성일 문제·완료)와 평가 기준 문구를 보여 주고,
 * 카드에서 바로 작성·수정한다. 세 계획은 한 번에 A4로 인쇄한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listProgramPlans } from '@/lib/lab/labApi';
import type { PlanCategory, ProgramPlan } from '@/lib/lab/labTypes';
import { REQUIRED_FREQUENCY, annualPlanStatus, planCategoryLabel } from '@/lib/lab/programPlanRules';
import { Chip, ErrorBanner, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import ProgramPlanAnnualEditor from './ProgramPlanAnnualEditor';
import ProgramPlanAnnualSheet from './ProgramPlanAnnualSheet';
import type { AnnualSheetData } from './ProgramPlanAnnualSheet';
import { useProgramPlanPrint } from './ProgramPlanPrintJob';
import { YearStepper } from './RecordsUi';
import styles from './labRecords.module.css';
import own from './ProgramPlan.module.css';

/** 분야별 평가 번호 — 2026 주야간보호 평가 24 신체기능·25 인지기능·26 사회적응 */
const EVAL_NO: Record<PlanCategory, number> = { PHYSICAL: 24, COGNITIVE: 25, SOCIAL: 26 };

export default function ProgramPlanAnnual() {
  const notify = useNotify();
  const thisYear = Number(todayString().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [plans, setPlans] = useState<ProgramPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanCategory | null>(null);
  const [printing, print] = useProgramPlanPrint<AnnualSheetData>();
  const seq = useRef(0);

  const load = useCallback(async (target: number) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listProgramPlans(target);
      if (n !== seq.current) return;
      setPlans(list);
    } catch (e) {
      if (n !== seq.current) return;
      setPlans([]);
      setError(errorText(e, '프로그램 연간계획을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(year);
    return () => {
      seq.current += 1;
    };
  }, [year, load]);

  const status = useMemo(() => annualPlanStatus(plans, year), [plans, year]);
  const okCount = status.filter((s) => s.ok).length;
  const editingPlan = editing ? status.find((s) => s.category === editing)?.plan ?? null : null;

  const changeYear = (next: number) => {
    setEditing(null);
    setYear(next);
  };

  const chipOf = (issue: 'MISSING' | 'WRITTEN_OUTSIDE_YEAR' | null) =>
    issue === 'MISSING' ? <Chip tone="danger" label="작성 전" /> : issue === 'WRITTEN_OUTSIDE_YEAR' ? <Chip tone="warn" label="작성일 확인" /> : <Chip tone="ok" label="완료" />;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={changeYear} isDisabled={loading} max={thisYear + 1} />
        <Text type="supporting" color="secondary">
          {loading ? '불러오는 중...' : `세 분야 중 ${okCount}개 완료`}
        </Text>
        <div className={styles.spacer}>
          <Button label="연간계획 인쇄" variant="secondary" isDisabled={loading || plans.length === 0} onClick={() => print({ year, plans })} />
        </div>
      </div>

      <SupportText>평가 24·25·26 기준①은 분야마다 연간 프로그램 계획을 세우는 것입니다. 작성일은 그 해 안이거나 직전 해 12월이어야 인정됩니다.</SupportText>

      {error && <ErrorBanner message={error} onRetry={() => void load(year)} />}

      {loading && plans.length === 0 && !error ? (
        <Loading size="inline" label="연간계획을 불러오는 중..." />
      ) : (
        <div className={own.planCards}>
          {status.map((s) => {
            const label = planCategoryLabel(s.category);
            return (
              <Card key={s.category} padding={4}>
                <div className={own.planCard}>
                  <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                    <Text type="large" weight="semibold">
                      {label}
                    </Text>
                    {chipOf(s.issue)}
                  </HStack>
                  <SupportText>
                    평가 {EVAL_NO[s.category]} · 필요 횟수 {REQUIRED_FREQUENCY[s.category]}
                  </SupportText>
                  {s.plan ? (
                    <VStack gap={2}>
                      <dl className={own.facts}>
                        <dt>목표</dt>
                        <dd className={own.planCardBody}>{s.plan.goal}</dd>
                        <dt>횟수</dt>
                        <dd>{s.plan.frequency}</dd>
                        {s.plan.target && (
                          <>
                            <dt>대상</dt>
                            <dd>{s.plan.target}</dd>
                          </>
                        )}
                        {s.plan.budget !== null && (
                          <>
                            <dt>예산</dt>
                            <dd>{s.plan.budget.toLocaleString('ko-KR')}원</dd>
                          </>
                        )}
                        <dt>작성</dt>
                        <dd>
                          {dotDate(s.plan.writtenOn)} · {s.plan.writerName}
                        </dd>
                      </dl>
                      {s.issue === 'WRITTEN_OUTSIDE_YEAR' && <SupportText tone="warn">작성일이 {year}년(또는 {year - 1}년 12월)이 아니어서 평가에서 인정되지 않을 수 있습니다. 작성일을 확인해 주세요.</SupportText>}
                    </VStack>
                  ) : (
                    <SupportText>{year}년 {label} 연간계획이 아직 없습니다. 목표와 세부 내용, 실시 횟수를 적어 두세요.</SupportText>
                  )}
                  <div className={styles.spacer} style={{ marginInlineStart: 0, marginTop: 'auto' }}>
                    <Button label={s.plan ? `${label} 고치기` : `${label} 작성하기`} variant={s.plan ? 'secondary' : 'primary'} onClick={() => setEditing(s.category)} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <ProgramPlanAnnualEditor
          key={`${year}-${editing}-${editingPlan?.id ?? 'new'}`}
          year={year}
          category={editing}
          plan={editingPlan}
          onSaved={(saved) => {
            setPlans((list) => [...list.filter((p) => !(p.planYear === saved.planYear && p.category === saved.category)), saved]);
            setEditing(null);
            notify(`${planCategoryLabel(saved.category)} 연간계획을 저장했습니다`, 'success');
          }}
          onDeleted={(id) => {
            setPlans((list) => list.filter((p) => p.id !== id));
            setEditing(null);
            notify('연간계획을 삭제했습니다', 'success');
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {printing && <ProgramPlanAnnualSheet data={printing} />}
    </div>
  );
}
