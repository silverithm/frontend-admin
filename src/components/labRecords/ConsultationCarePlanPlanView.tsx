'use client';

/**
 * 욕구사정·급여계획 — 연도별로 어르신마다 계획 상태(계획 없음·동의 필요·동의 완료)와 빈 곳을 한눈에 보고,
 * 어르신을 골라 작성·수정하고, 인쇄 보기에서 계획서를 출력한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { StatRow, StatTile } from '@/components/StatTile';
import { listCarePlans, listRiskLatest } from '@/lib/lab/labApi';
import type { CarePlan, RiskLatest } from '@/lib/lab/labTypes';
import { CARE_PLAN_STATUS_LABEL, carePlanCoverage, carePlanGaps } from '@/lib/lab/carePlanRules';
import { needsComplete } from '@/lib/lab/needsRules';
import type { CarePlanStatus } from '@/lib/lab/carePlanRules';
import { Chip, ErrorBanner, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import ConsultationCarePlanPlanEditor from './ConsultationCarePlanPlanEditor';
import { CarePlanPrintPortal, CarePlanSheet } from './ConsultationCarePlanPrint';
import { YearStepper } from './RecordsUi';
import { yearOf } from './recordsFormat';
import styles from './labRecords.module.css';

type Filter = 'ALL' | CarePlanStatus;

const STATUS_TONE: Record<CarePlanStatus, 'danger' | 'warn' | 'ok'> = { MISSING: 'danger', NEEDS_AGREEMENT: 'warn', OK: 'ok' };

interface ViewProps {
  elders: LabElder[];
  eldersLoading: boolean;
}

export default function ConsultationCarePlanPlanView({ elders, eldersLoading }: ViewProps) {
  const notify = useNotify();
  const thisYear = yearOf(todayString());
  const [year, setYear] = useState(thisYear);
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [risks, setRisks] = useState<RiskLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [printing, setPrinting] = useState<CarePlan | null>(null);
  const seq = useRef(0);
  const riskSeq = useRef(0);

  const load = useCallback(async (target: number) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listCarePlans(target);
      if (n !== seq.current) return; // 연도를 빨리 넘길 때 늦게 온 응답은 버린다
      setPlans(list);
    } catch (e) {
      if (n !== seq.current) return;
      setPlans([]);
      setError(errorText(e, '급여제공계획을 불러오지 못했습니다'));
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

  // 위험도 단계는 AI 초안에만 쓰는 부가 정보라 못 읽어도 화면을 막지 않는다
  useEffect(() => {
    const n = ++riskSeq.current;
    listRiskLatest()
      .then((list) => {
        if (n === riskSeq.current) setRisks(list);
      })
      .catch(() => undefined);
    return () => {
      riskSeq.current += 1;
    };
  }, []);

  const planByElder = useMemo(() => new Map(plans.map((p) => [p.elderlyId, p])), [plans]);
  const riskByElder = useMemo(() => new Map(risks.map((r) => [r.elderlyId, r])), [risks]);
  const coverage = useMemo(() => carePlanCoverage(plans, elders.map((e) => e.id), year), [plans, elders, year]);
  const rows = elders.filter((e) => filter === 'ALL' || coverage.perElder[e.id] === filter);
  const editing = elders.find((e) => e.id === editingId) ?? null;

  if (printing) {
    const grade = elders.find((e) => e.id === printing.elderlyId)?.careGrade ?? null;
    return (
      <div className={styles.stack}>
        <div className={styles.printPreviewBar}>
          <Button label="인쇄하기" variant="primary" onClick={() => window.print()} />
          <Button label="돌아가기" variant="ghost" onClick={() => setPrinting(null)} />
          <Text type="supporting" color="secondary">
            인쇄 창에서 ‘머리글·바닥글’을 끄면 더 깔끔하게 나옵니다. 지금 보이는 계획서만 출력됩니다.
          </Text>
        </div>
        <Card padding={6}>
          <div className={styles.sheetBox}>
            <CarePlanSheet plan={printing} grade={grade} companyName="" />
          </div>
        </Card>
        <CarePlanPrintPortal plan={printing} grade={grade} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className={styles.stack}>
        <ConsultationCarePlanPlanEditor
          key={`${editing.id}-${year}`}
          elder={editing}
          year={year}
          plan={planByElder.get(editing.id) ?? null}
          risk={riskByElder.get(editing.id)}
          onSaved={(saved, isNew) => {
            setPlans((prev) => [...prev.filter((p) => p.elderlyId !== saved.elderlyId), saved]);
            notify(isNew ? '급여제공계획을 저장했습니다' : '급여제공계획을 수정했습니다', 'success');
          }}
          onDeleted={(id) => {
            setPlans((prev) => prev.filter((p) => p.id !== id));
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
          onPrint={setPrinting}
        />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={setYear} isDisabled={loading} max={thisYear + 1} />
        <Text type="supporting" color="secondary">
          {year}년 계획 · 동의 완료 {coverage.ok}/{coverage.total}명
        </Text>
      </div>

      <StatRow>
        <StatTile value={`${coverage.ok}/${coverage.total}명`} label={`동의 완료 (${coverage.percent}%)`} tone={coverage.total > 0 && coverage.ok === coverage.total ? 'success' : 'neutral'} />
        <StatTile value={`${coverage.needsAgreement}명`} label="동의 필요" tone={coverage.needsAgreement > 0 ? 'warning' : 'neutral'} />
        <StatTile value={`${coverage.missing}명`} label="계획 없음" tone={coverage.missing > 0 ? 'danger' : 'neutral'} />
      </StatRow>

      <SegmentedControl label="계획 상태 거르기" value={filter} onChange={(v) => setFilter(v as Filter)}>
        <SegmentedControlItem value="ALL" label="전체" />
        <SegmentedControlItem value="MISSING" label="계획 없음" />
        <SegmentedControlItem value="NEEDS_AGREEMENT" label="동의 필요" />
        <SegmentedControlItem value="OK" label="동의 완료" />
      </SegmentedControl>

      {error && <ErrorBanner message={error} onRetry={() => void load(year)} />}

      {eldersLoading || (loading && plans.length === 0) ? (
        <Loading size="inline" label="불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : rows.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState isCompact title="이 상태의 어르신이 없습니다" description="다른 상태를 골라 보세요." />
        </Card>
      ) : (
        <Card padding={0}>
          {rows.map((elder) => {
            const plan = planByElder.get(elder.id);
            const status = coverage.perElder[elder.id] ?? 'MISSING';
            const gaps = plan ? carePlanGaps(plan) : [];
            const needsCheck = plan ? needsComplete(plan.needs) : null;
            const needsMissing = needsCheck ? needsCheck.missing.length + (needsCheck.avoidFoodsRecorded ? 0 : 1) : 0;
            return (
              <div className={styles.rowBlock} key={elder.id}>
                <div className={styles.rowHead}>
                  <VStack gap={1}>
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <Text type="body" weight="medium">
                        {elder.name}
                      </Text>
                      <Chip tone={STATUS_TONE[status]} label={CARE_PLAN_STATUS_LABEL[status]} />
                      {gaps.length > 0 && <Chip tone="warn" label={`빈 곳: ${gaps.join(', ')}`} />}
                      {needsMissing > 0 && <Chip tone="warn" label={`욕구사정 빈 칸 ${needsMissing}개`} />}
                    </HStack>
                    <Text type="supporting" color="secondary">
                      {plan
                        ? `욕구사정 ${dotDate(plan.assessedOn)} · 서비스 ${plan.services.length}개 · 동의일 ${dotDate(plan.guardianAgreedOn)}`
                        : status === 'MISSING'
                          ? `${year}년 계획이 아직 없습니다. 작성하면 ‘동의 필요’로 바뀝니다.`
                          : ''}
                    </Text>
                  </VStack>
                  <HStack gap={1}>
                    {plan && <Button label="인쇄 보기" variant="ghost" onClick={() => setPrinting(plan)} />}
                    <Button label={plan ? '수정' : '작성'} variant={plan ? 'ghost' : 'secondary'} onClick={() => setEditingId(elder.id)} />
                  </HStack>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
