'use client';

/**
 * 월간 프로그램 계획표 — 달력 칸마다 프로그램을 넣고 고치며, 주별 현황·점검, AI 초안, 지난달 복사, 보호자 제공 표시, A4 가로 인쇄를 한다.
 * 칸을 고치면 이 화면의 초안에만 반영되고, 위쪽 "계획표 저장"을 눌러야 서버에 저장된다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { aiDraftProgramSchedule, getProgramSchedule, listProgramPlans, listPrograms, saveProgramSchedule } from '@/lib/lab/labApi';
import type { ProgramPlan, ProgramSchedule, ScheduleItem, ScheduleSharedMethod } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, LabConfirm, MonthStepper, SupportText, useNotify } from '@/components/lab/LabUi';
import { currentMonth, errorText, monthLabel } from '@/components/lab/labFormat';
import ProgramPlanAiDraft from './ProgramPlanAiDraft';
import ProgramPlanCalendar from './ProgramPlanCalendar';
import ProgramPlanDayPanel from './ProgramPlanDayPanel';
import { MAX_SCHEDULE_NOTES, mergeItems, previousMonthOf, shiftItemsToMonth, sortItems } from './ProgramPlanDraft';
import ProgramPlanMonthSheet from './ProgramPlanMonthSheet';
import type { MonthSheetData } from './ProgramPlanMonthSheet';
import { useProgramPlanPrint } from './ProgramPlanPrintJob';
import ProgramPlanShare from './ProgramPlanShare';
import ProgramPlanWeekly from './ProgramPlanWeekly';
import { useAlive } from './recordsFormat';
import { useSafetySettings } from './SafetyCheckSettings';
import styles from './labRecords.module.css';

interface Form {
  items: ScheduleItem[];
  notes: string;
  sharedOn: string;
  sharedMethod: ScheduleSharedMethod | null;
  aiAssisted: boolean;
}

const EMPTY: Form = { items: [], notes: '', sharedOn: '', sharedMethod: null, aiAssisted: false };
const snap = (f: Form) => JSON.stringify([f.items, f.notes, f.sharedOn, f.sharedMethod]);

function formOf(s: ProgramSchedule | null): Form {
  if (!s) return EMPTY;
  return {
    items: sortItems(s.items.map((i) => ({ ...i, date: i.date.slice(0, 10) }))),
    notes: s.notes ?? '',
    sharedOn: s.sharedOn ? s.sharedOn.slice(0, 10) : '',
    sharedMethod: s.sharedMethod,
    aiAssisted: s.aiAssisted,
  };
}

export default function ProgramPlanMonth() {
  const notify = useNotify();
  const alive = useAlive();
  const [month, setMonth] = useState(currentMonth);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [baseline, setBaseline] = useState(() => snap(EMPTY));
  const [saved, setSaved] = useState<ProgramSchedule | null>(null);
  const [plans, setPlans] = useState<ProgramPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ScheduleItem[] | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [printing, print] = useProgramPlanPrint<MonthSheetData>();
  const seq = useRef(0);
  const { operatingDays } = useSafetySettings(month);

  const dirty = snap(form) !== baseline;

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const schedule = await getProgramSchedule(target);
      if (n !== seq.current) return;
      const next = formOf(schedule);
      setSaved(schedule);
      setForm(next);
      setBaseline(snap(next));
      setProposal(null);
      setAiError(null);
      // 연간계획은 AI 초안의 참고용이라 못 불러와도 계획표는 쓸 수 있다
      listProgramPlans(Number(target.slice(0, 4)))
        .then((list) => n === seq.current && setPlans(list))
        .catch(() => n === seq.current && setPlans([]));
    } catch (e) {
      if (n !== seq.current) return;
      setSaved(null);
      setForm(EMPTY);
      setBaseline(snap(EMPTY));
      setError(errorText(e, '월간 프로그램 계획표를 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
    return () => {
      seq.current += 1;
    };
  }, [month, load]);

  const goMonth = (next: string) => {
    if (next === month) return;
    if (dirty) setPendingMonth(next);
    else {
      setSelectedDate(null);
      setMonth(next);
    }
  };

  const setItems = (items: ScheduleItem[], ai = false) => setForm((f) => ({ ...f, items, aiAssisted: f.aiAssisted || ai }));

  const save = async () => {
    if (saving) return;
    if ((form.sharedOn === '') !== (form.sharedMethod === null)) {
      setSaveError('제공일과 제공 방법은 함께 적거나 함께 비워 주세요');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveProgramSchedule({
        scheduleMonth: month,
        items: form.items,
        notes: form.notes.trim() === '' ? null : form.notes.trim(),
        sharedOn: form.sharedOn === '' ? null : form.sharedOn,
        sharedMethod: form.sharedMethod,
        aiAssisted: form.aiAssisted,
      });
      if (!alive.current) return;
      const next = formOf(result);
      setSaved(result);
      setForm(next);
      setBaseline(snap(next));
      notify(`${monthLabel(month)} 계획표를 저장했습니다`, 'success');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '월간 프로그램 계획표를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const runAi = async () => {
    if (aiLoading) return;
    if (operatingDays.length === 0) {
      setAiError('이 달 운영일이 없어 계획표를 만들 수 없습니다. 위생·안전 점검의 휴원일 설정을 확인해 주세요');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    const target = month;
    try {
      // 지난달 프로그램 일지 제목은 참고용이라 못 불러와도 계속한다
      let recentTitles: string[] = [];
      try {
        const logs = await listPrograms(previousMonthOf(target));
        recentTitles = [...new Set(logs.map((p) => p.title.trim()).filter(Boolean))].slice(0, 30);
      } catch {
        recentTitles = [];
      }
      const result = await aiDraftProgramSchedule({
        month: target,
        operatingDays,
        annualPlans: plans.filter((p) => p.goal.trim() !== '').map((p) => ({ category: p.category, goal: p.goal, frequency: p.frequency })),
        recentTitles: recentTitles.length > 0 ? recentTitles : undefined,
      });
      if (!alive.current || target !== month) return;
      setProposal(sortItems(result.items));
      if (result.items.length === 0) setAiError('AI가 넣을 만한 계획을 만들지 못했습니다. 다시 시도해 주세요');
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 계획표 초안을 만들지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const addProposal = () => {
    if (!proposal) return;
    const merged = mergeItems(form.items, proposal);
    setItems(merged.items, true);
    setProposal(null);
    notify(`계획표에 ${merged.added}개를 넣었습니다${merged.skipped > 0 ? ` (겹치는 ${merged.skipped}개는 건너뜀)` : ''}. 저장을 눌러야 남습니다`, 'info');
  };

  const replaceWithProposal = () => {
    if (!proposal) return;
    setItems(sortItems(proposal), true);
    setProposal(null);
    notify('계획표를 제안으로 바꿨습니다. 저장을 눌러야 남습니다', 'info');
  };

  const copyPrevious = async () => {
    setCopyConfirm(false);
    if (copying) return;
    setCopying(true);
    setSaveError(null);
    const target = month;
    try {
      const prev = await getProgramSchedule(previousMonthOf(target));
      if (!alive.current || target !== month) return;
      if (!prev || prev.items.length === 0) {
        setSaveError(`${monthLabel(previousMonthOf(target))} 계획표가 없어 복사할 수 없습니다`);
        return;
      }
      const moved = shiftItemsToMonth(prev.items, previousMonthOf(target), target);
      setItems(moved.items);
      notify(`지난달 계획 ${moved.items.length}개를 같은 주·같은 요일로 옮겼습니다${moved.dropped > 0 ? ` (이 달 밖 ${moved.dropped}개는 뺌)` : ''}. 저장을 눌러야 남습니다`, 'info');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '지난달 계획표를 불러오지 못했습니다'));
    } finally {
      if (alive.current) setCopying(false);
    }
  };

  const open = useMemo(() => new Set(operatingDays), [operatingDays]);
  const sharedDone = saved !== null && saved.sharedOn !== null && saved.sharedMethod !== null;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={goMonth} isDisabled={loading || saving} />
        <Text type="supporting" color="secondary">
          {loading ? '불러오는 중...' : `${monthLabel(month)} 프로그램 ${form.items.length}개`}
        </Text>
        {dirty && <Chip tone="warn" label="저장 전" />}
        {!loading && sharedDone && <Chip tone="ok" label="보호자 제공 기록 있음" />}
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}

      {loading ? (
        <Loading size="inline" label="계획표를 불러오는 중..." />
      ) : (
        <>
          <Card padding={4}>
            <div className={styles.toolbar}>
              <Button label="AI 계획표 초안" variant="secondary" isLoading={aiLoading} isDisabled={aiLoading || !!error} onClick={() => void runAi()} />
              <Button label="지난달 계획 복사" variant="secondary" isLoading={copying} isDisabled={copying || !!error} onClick={() => (form.items.length > 0 ? setCopyConfirm(true) : void copyPrevious())} />
              <Button label="보호자용 계획표 인쇄" variant="secondary" isDisabled={form.items.length === 0} onClick={() => print({ month, items: form.items, operatingDays, notes: form.notes })} />
              <div className={styles.spacer}>
                <Button label="계획표 저장" variant="primary" isLoading={saving} isDisabled={saving || !dirty || !!error} onClick={() => void save()} />
              </div>
            </div>
            <SupportText>운영일은 위생·안전 점검의 휴원일·토요일 운영 설정을 따릅니다. AI 초안은 연간계획 목표와 지난달 프로그램 일지 제목을 참고하며, 시각·강사는 직접 적어 주세요.</SupportText>
            {saveError && <ErrorBanner message={saveError} />}
            {aiError && <ErrorBanner message={aiError} />}
          </Card>

          {proposal && proposal.length > 0 && (
            <ProgramPlanAiDraft
              month={month}
              proposal={proposal}
              operatingDays={operatingDays}
              hasItems={form.items.length > 0}
              onRemove={(i) => setProposal((p) => (p ? p.filter((_, idx) => idx !== i) : p))}
              onAdd={addProposal}
              onReplace={replaceWithProposal}
              onDiscard={() => setProposal(null)}
            />
          )}

          <Card padding={4}>
            <ProgramPlanCalendar month={month} items={form.items} operatingDays={operatingDays} selectedDate={selectedDate} onSelect={setSelectedDate} />
            <div style={{ marginTop: 'var(--spacing-2)' }}>
              <SupportText>날짜를 눌러 그날 프로그램을 넣거나 고칩니다. 색 점은 인지(파랑)·신체(초록)·사회적응(노랑)입니다. 흐린 칸은 쉬는 날입니다.</SupportText>
            </div>
          </Card>

          {selectedDate && (
            <ProgramPlanDayPanel
              key={selectedDate}
              month={month}
              date={selectedDate}
              items={form.items}
              operatingDays={operatingDays}
              isOperating={open.has(selectedDate)}
              onChange={(items) => setItems(items)}
              onClose={() => setSelectedDate(null)}
            />
          )}

          <ProgramPlanWeekly month={month} items={form.items} operatingDays={operatingDays} />

          <ProgramPlanShare
            sharedOn={form.sharedOn}
            sharedMethod={form.sharedMethod}
            notes={form.notes}
            onSharedOn={(v) => setForm((f) => ({ ...f, sharedOn: v }))}
            onSharedMethod={(v) => setForm((f) => ({ ...f, sharedMethod: v }))}
            onNotes={(v) => setForm((f) => ({ ...f, notes: v.slice(0, MAX_SCHEDULE_NOTES) }))}
          />
        </>
      )}

      <LabConfirm
        isOpen={pendingMonth !== null}
        title="저장하지 않은 내용이 있습니다"
        description="다른 달로 넘어가면 지금 고친 계획표가 사라집니다. 그래도 넘어갈까요?"
        actionLabel="넘어가기"
        onConfirm={() => {
          const next = pendingMonth;
          setPendingMonth(null);
          if (next) {
            setSelectedDate(null);
            setMonth(next);
          }
        }}
        onClose={() => setPendingMonth(null)}
      />
      <LabConfirm
        isOpen={copyConfirm}
        title="지금 계획표를 지난달 것으로 바꿀까요?"
        description={`지금 있는 ${form.items.length}개 칸이 지난달 계획으로 바뀝니다. 저장하기 전까지는 되돌릴 수 있게 이 달을 다시 불러오면 원래대로 돌아옵니다.`}
        actionLabel="바꾸기"
        onConfirm={() => void copyPrevious()}
        onClose={() => setCopyConfirm(false)}
      />

      {printing && <ProgramPlanMonthSheet data={printing} />}
    </div>
  );
}
