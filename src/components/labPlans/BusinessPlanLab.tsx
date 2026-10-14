'use client';

/**
 * 사업계획 — 연도별 연간 사업계획서. 세 분야(기관운영·서비스 제공·직원관리)마다 여섯 칸 항목을 적고,
 * 점검(businessPlanIssues)을 칸 옆과 위쪽에 실시간으로 보여 준다. 비어 있어도 저장은 되고 점검으로 알린다.
 * 총수입·총지출은 예산·결산(5차)에서 가져올 수 있고, 지난해 기록 숫자로 AI 초안을 받는다. A4 인쇄.
 * 저장하지 않은 변경이 있으면 연도를 바꾸기 전에 묻는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { defaultPersonName, errorText, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { YearStepper } from '@/components/labRecords/RecordsUi';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { latestBudget } from '@/lib/lab/budgetRules';
import { SECTIONS, businessPlanIssues, budgetGap, sectionBudget } from '@/lib/lab/businessPlanRules';
import { getBusinessPlan, listBudgets, saveBusinessPlan } from '@/lib/lab/labApi';
import type { Budget, BusinessPlanItem, BusinessSection } from '@/lib/lab/labTypes';
import { MAX_SECTION_ITEMS, MAX_WRITER, draftOfPlan, emptyPlanDraft, fingerprint, inputOfDraft, newItem, plainOf, saveBlockers } from './BusinessPlanDraft';
import type { ItemDraft, PlanDraft } from './BusinessPlanDraft';
import BusinessPlanAi from './BusinessPlanAi';
import BusinessPlanPrint from './BusinessPlanPrint';
import BusinessPlanSectionCard from './BusinessPlanSectionCard';
import BusinessPlanTotals from './BusinessPlanTotals';
import styles from './labPlans.module.css';
import s7 from './labPlans7.module.css';

const SHOWN_ISSUES = 8;

export default function BusinessPlanLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const { elders, isLoading: eldersLoading, error: eldersError } = useLabElders();
  const [year, setYear] = useState(thisYear);
  const [draft, setDraft] = useState<PlanDraft>(() => emptyPlanDraft(thisYear, defaultPersonName()));
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [noBudget, setNoBudget] = useState(false);
  const [importedRevision, setImportedRevision] = useState<number | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const seq = useRef(0);
  const busy = useRef(false);

  const dirty = baseline !== '' && fingerprint(draft) !== baseline;

  const show = useCallback((d: PlanDraft) => {
    setDraft(d);
    setBaseline(fingerprint(d));
    setSaveError(null);
  }, []);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    setImportedRevision(null);
    setNoBudget(false);
    setImportError(null);
    const [p, b] = await Promise.allSettled([getBusinessPlan(year), listBudgets(year)]);
    if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
    if (p.status === 'fulfilled') {
      const base = p.value ? draftOfPlan(p.value) : { ...emptyPlanDraft(year, defaultPersonName()), writtenOn: year === thisYear ? todayString() : '' };
      show(base);
    } else {
      show(emptyPlanDraft(year, defaultPersonName()));
      setError(errorText(p.reason, '사업계획서를 불러오지 못했습니다'));
    }
    // 예산을 못 읽어도 계획서는 쓸 수 있다 — 차이 표시만 빠진다
    if (b.status === 'fulfilled') setBudget(latestBudget(b.value, year));
    else {
      setBudget(null);
      setImportError(errorText(b.reason, '예산·결산을 불러오지 못했습니다') + ' — 예산과의 차이는 표시하지 못합니다');
    }
    setLoading(false);
  }, [year, alive, show, thisYear]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const changeYear = (y: number) => {
    const go = () => setYear(y);
    if (dirty) setPending(() => go);
    else go();
  };

  const plain = useMemo(() => plainOf(draft), [draft]);
  const issues = useMemo(() => businessPlanIssues(plain), [plain]);
  const sums = useMemo(() => sectionBudget(plain), [plain]);
  const gap = useMemo(() => budgetGap(plain, budget), [plain, budget]);
  const blockers = saveBlockers(draft);
  const disabled = loading || saving;

  const setSection = (section: BusinessSection, items: ItemDraft[]) => setDraft((d) => ({ ...d, sections: { ...d.sections, [section]: items } }));

  const importBudget = async () => {
    if (importing) return;
    setImporting(true);
    setImportError(null);
    setNoBudget(false);
    try {
      const latest = latestBudget(await listBudgets(year), year);
      if (!alive.current) return;
      setBudget(latest);
      if (!latest) {
        setNoBudget(true);
        return;
      }
      const lines = latest.lines;
      const sum = (dir: 'INCOME' | 'EXPENSE') => lines.filter((l) => l.direction === dir).reduce((acc, l) => acc + (typeof l.amount === 'number' ? l.amount : 0), 0);
      setDraft((d) => ({ ...d, totalIncome: sum('INCOME'), totalExpense: sum('EXPENSE') }));
      setImportedRevision(latest.revision);
    } catch (err) {
      if (alive.current) setImportError(errorText(err, '예산·결산에서 가져오지 못했습니다'));
    } finally {
      if (alive.current) setImporting(false);
    }
  };

  const applyAi = (section: BusinessSection, items: BusinessPlanItem[]) =>
    setDraft((d) => {
      const room = MAX_SECTION_ITEMS - d.sections[section].length;
      if (room <= 0) return d;
      return { ...d, aiAssisted: true, sections: { ...d.sections, [section]: [...d.sections[section], ...items.slice(0, room).map((it) => newItem(it))] } };
    });

  const save = async () => {
    if (busy.current || blockers.length > 0) {
      if (blockers.length > 0) setSaveError(blockers[0]);
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveBusinessPlan(inputOfDraft(draft));
      if (!alive.current) return;
      show(draftOfPlan(saved));
      notify(issues.length === 0 ? '사업계획서를 저장했습니다' : `사업계획서를 저장했습니다. 비어 있는 칸 ${issues.length}곳이 남아 있습니다`, 'success');
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '사업계획서를 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const sectionIssues = (section: BusinessSection) => issues.filter((i) => i.section === section);
  const planWide = issues.filter((i) => i.section === null);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={changeYear} max={thisYear + 1} isDisabled={saving} />
        {draft.id !== null && !dirty && <Chip tone="ok" label="저장됨" />}
        {draft.id === null && !loading && <Chip tone="warn" label="저장 전" />}
        {dirty && draft.id !== null && <Chip tone="warn" label="저장하지 않은 변경" />}
        <span className={styles.spacer} />
        <Button label="A4 인쇄" variant="secondary" isDisabled={loading || saving} onClick={() => setPrintKey((k) => k + 1)} />
        <Button label="사업계획 저장" variant="primary" isLoading={saving} isDisabled={disabled || blockers.length > 0 || (draft.id !== null && !dirty)} onClick={() => void save()} />
      </div>

      <Banner
        status="info"
        title="2026 평가 2 사업계획 기준①"
        description="사업계획서에 기관운영·서비스 제공·직원관리 세 분야가 모두 있어야 하고, 항목마다 세부사업명·사업목표·사업내용·사업대상·사업예산·추진일정 여섯 칸과 기관 예산의 총수입·총지출이 들어 있어야 합니다. 프로그램 계획만 있으면 인정되지 않습니다."
      />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {eldersError && <SupportText tone="warn">{eldersError} — AI 초안에 어르신 수가 0명으로 들어갑니다.</SupportText>}

      {loading ? (
        <Loading size="section" label="사업계획서를 불러오는 중..." />
      ) : (
        <>
          <Card padding={4}>
            <VStack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="label">저장 전 점검</Text>
                {issues.length === 0 ? <Chip tone="ok" label="빈 칸 없음" /> : <Chip tone="warn" label={`${issues.length}건`} />}
              </HStack>
              {issues.length === 0 ? (
                <SupportText>세 분야의 여섯 칸과 총수입·총지출이 모두 적혀 있습니다.</SupportText>
              ) : (
                <>
                  <ul className={s7.issueList}>
                    {issues.slice(0, SHOWN_ISSUES).map((i, n) => (
                      <li key={`${i.section}-${i.index}-${i.field}-${n}`}>
                        <SupportText tone="warn">{i.message}</SupportText>
                      </li>
                    ))}
                  </ul>
                  {issues.length > SHOWN_ISSUES && <SupportText>그 밖에 {issues.length - SHOWN_ISSUES}건이 더 있습니다. 각 분야 카드의 칸 옆에서 확인하세요.</SupportText>}
                  <SupportText>비어 있어도 저장은 됩니다. 평가 전에 채워 주세요.</SupportText>
                </>
              )}
            </VStack>
          </Card>

          <Card padding={4}>
            <div className={styles.fieldGrid}>
              <TextInput label="작성자" value={draft.writerName} onChange={(v) => setDraft((d) => ({ ...d, writerName: v.slice(0, MAX_WRITER) }))} isDisabled={saving} placeholder="작성한 사람 이름" />
              <LabDateInput label="작성일 (선택)" value={draft.writtenOn} onChange={(v) => setDraft((d) => ({ ...d, writtenOn: v }))} />
            </div>
          </Card>

          {SECTIONS.map(({ value }) => (
            <BusinessPlanSectionCard key={value} section={value} items={draft.sections[value]} issues={sectionIssues(value)} subtotal={sums[value]} disabled={saving} onChange={(items) => setSection(value, items)} />
          ))}

          <BusinessPlanTotals
            totalIncome={draft.totalIncome}
            totalExpense={draft.totalExpense}
            onIncome={(v) => setDraft((d) => ({ ...d, totalIncome: v }))}
            onExpense={(v) => setDraft((d) => ({ ...d, totalExpense: v }))}
            sums={sums}
            gap={gap}
            importedRevision={importedRevision}
            noBudget={noBudget}
            importing={importing}
            importError={importError}
            disabled={saving}
            onImport={() => void importBudget()}
          />
          {planWide.length > 0 && (
            <SupportText tone="warn">{planWide.map((i) => i.message).join(' / ')}</SupportText>
          )}

          <BusinessPlanAi year={year} elderCount={eldersLoading || eldersError ? null : elders.length} disabled={saving} onApply={applyAi} />

          {draft.aiAssisted && <SupportText>AI 제안을 반영한 계획서입니다. 숫자·일정·대상이 우리 기관 실제와 맞는지 확인한 뒤 저장해 주세요.</SupportText>}
          {saveError && <ErrorBanner message={saveError} />}
          {blockers.length > 0 && <SupportText tone="warn">{blockers.join(' / ')}</SupportText>}
          <HStack gap={2} hAlign="end" wrap="wrap">
            <Button label="A4 인쇄" variant="secondary" isDisabled={saving} onClick={() => setPrintKey((k) => k + 1)} />
            <Button label="사업계획 저장" variant="primary" isLoading={saving} isDisabled={disabled || blockers.length > 0 || (draft.id !== null && !dirty)} onClick={() => void save()} />
          </HStack>
        </>
      )}

      <BusinessPlanPrint draft={draft} printKey={printKey} onReady={() => window.print()} />
      <LabConfirm
        isOpen={pending !== null}
        title="저장하지 않은 변경이 있습니다"
        description="계속하면 지금 고친 내용이 사라집니다. 계속할까요?"
        actionLabel="버리고 계속"
        onConfirm={() => {
          const action = pending;
          setPending(null);
          action?.();
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
