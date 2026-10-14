'use client';

/**
 * 주간 식단표 — 위에는 오늘 다진식·죽식 인원, 그 아래 주 이동·지난주 복사·AI 식단, 그리고 월~토 식단 표.
 * 저장 한 번이 그 주 전체다. 지난주와 같은 주찬·한 주 안의 중복 주찬은 표 위에서 바로 알려 준다.
 * AI는 지난주 주찬을 피한 제안을 빈 칸에만 채우고, 직접 쓴 칸은 그대로 둔다. 저장은 사람이 누를 때만 한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Loading } from '@/components/Loading';
import { aiDraftMealPlan, getMealPlan, saveMealPlan } from '@/lib/lab/labApi';
import type { MealDay, MealPlan } from '@/lib/lab/labTypes';
import { MEAL_NOTES_LIMIT, copyWeek, currentWeekStart, daysMissingMain, hasAnyMenu, isAvoidedDish, mainsOf, menuRepeats, nextWeekStart, repeatedMainDates, weekdayLabel } from '@/lib/lab/mealRules';
import { addDays } from '@/lib/lab/programRules';
import { AiChip, Chip, ErrorBanner, LabConfirm, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import MealPlanDiet, { useMealElders } from './MealPlanDiet';
import { daysForWeek, draftFromPlan, mergeAiWeek, setCell, snapshotOf, toInput, validate } from './MealPlanDraft';
import type { MealDraft } from './MealPlanDraft';
import MealPlanPrint from './MealPlanPrint';
import MealPlanTable from './MealPlanTable';
import { useAlive, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

const shortDate = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
const weekRange = (start: string) => `${shortDate(start)} ~ ${shortDate(addDays(start, 5) ?? start)}`;

type Pending = { kind: 'week'; to: string } | { kind: 'copy' } | null;

export default function MealPlanLab() {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const mealElders = useMealElders();
  const [softCount, setSoftCount] = useState<number | undefined>(undefined);

  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [prevDays, setPrevDays] = useState<MealDay[] | null>(null);
  const [prevFailed, setPrevFailed] = useState(false);
  const [draft, setDraft] = useState<MealDraft>(() => draftFromPlan(currentWeekStart(), null, ''));
  const [baseline, setBaseline] = useState('');
  const latest = useLatest(draft);
  const seq = useRef(0);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiRef = useRef(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setLoadError(null);
    setAiError(null);
    setAiNote(null);
    setSaveError(null);
    const [cur, prev] = await Promise.allSettled([getMealPlan(target), getMealPlan(addDays(target, -7) ?? target)]);
    if (n !== seq.current) return; // 주를 빨리 넘길 때 늦게 온 응답은 버린다
    if (cur.status === 'rejected') {
      setLoadError(errorText(cur.reason, '주간 식단표를 불러오지 못했습니다'));
      setLoading(false);
      return;
    }
    const next = draftFromPlan(target, cur.value, defaultPersonName());
    setPlan(cur.value);
    setDraft(next);
    setBaseline(snapshotOf(next));
    setPrevFailed(prev.status === 'rejected');
    setPrevDays(prev.status === 'fulfilled' && prev.value ? daysForWeek(addDays(target, -7) ?? target, prev.value.days) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(weekStart);
    return () => {
      seq.current += 1;
    };
  }, [weekStart, load]);

  const ready = !loading && !loadError;
  const dirty = ready && snapshotOf(draft) !== baseline;
  const dirtyRef = useLatest(dirty);

  // 저장하지 않고 탭을 닫으려 할 때 브라우저가 한 번 묻는다
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyRef]);

  const repeats = useMemo(() => menuRepeats(draft.days), [draft.days]);
  const repeated = useMemo(() => repeatedMainDates(draft.days), [draft.days]);
  const lastMains = useMemo(() => (prevDays ? mainsOf(prevDays) : []), [prevDays]);
  const sameAsLast = useMemo(() => new Set(draft.days.filter((d) => isAvoidedDish(d.lunch.main, lastMains)).map((d) => d.date)), [draft.days, lastMains]);
  const missingMain = useMemo(() => (hasAnyMenu(draft.days) ? daysMissingMain(draft.days) : []), [draft.days]);
  const hasMenu = hasAnyMenu(draft.days);
  const busy = saving || aiLoading;

  const goWeek = (to: string) => {
    if (to === weekStart || busy) return;
    if (dirty) setPending({ kind: 'week', to });
    else setWeekStart(to);
  };

  const save = useCallback(async () => {
    if (savingRef.current || aiRef.current || loading || loadError) return;
    const now = latest.current;
    const problem = validate(now);
    if (problem) {
      setSaveError(problem);
      return;
    }
    const target = weekStart;
    const n = seq.current;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveMealPlan(toInput(target, now));
      if (now.writer.trim() !== '') writeStored(PROVIDER_KEY, now.writer.trim());
      if (!alive.current) return;
      notify('주간 식단표를 저장했습니다', 'success');
      if (n === seq.current) {
        setPlan(saved);
        // 저장한 시점의 내용을 기준으로 삼는다(저장 중 더 고친 글자는 저장 전 상태로 남는다)
        setBaseline(snapshotOf(now));
      }
    } catch (e) {
      if (alive.current && n === seq.current) setSaveError(errorText(e, '주간 식단표를 저장하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  }, [alive, latest, loadError, loading, notify, weekStart]);

  // Ctrl/Cmd+S로 저장
  const saveRef = useLatest(save);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveRef]);

  const applyCopy = () => {
    if (!prevDays) return;
    const days = daysForWeek(weekStart, copyWeek(prevDays, weekStart));
    setDraft((d) => ({ ...d, days, ai: {}, aiUsed: false }));
    setAiNote(null);
    notify('지난주 식단을 복사했습니다. 같은 주찬은 표시되니 바꿔 주세요', 'info');
  };

  const requestCopy = () => {
    if (!prevDays || busy) return;
    if (hasMenu) setPending({ kind: 'copy' });
    else applyCopy();
  };

  const runAi = async () => {
    if (aiRef.current || savingRef.current || !ready) return;
    const n = seq.current;
    aiRef.current = true;
    setAiLoading(true);
    setAiError(null);
    setAiNote(null);
    try {
      const result = await aiDraftMealPlan({
        weekStart,
        preferences: prefs.trim() === '' ? undefined : prefs.trim(),
        avoid: lastMains.length > 0 ? lastMains : undefined,
        softCount,
      });
      if (!alive.current || n !== seq.current) return; // 주가 바뀌었으면 이 제안은 버린다
      // 응답이 도착한 시점의 최신 입력과 합친다 — 기다리는 동안 직접 쓴 칸을 지키고, 센 개수는 이 자리에서 바로 쓴다
      const merged = mergeAiWeek(latest.current, result.days);
      setDraft((d) => ({ ...d, days: merged.days, ai: merged.ai, aiUsed: d.aiUsed || merged.filled > 0 }));
      setAiNote(
        merged.filled === 0
          ? '채울 빈 칸이 없어 바꾼 것이 없습니다.'
          : merged.kept > 0
            ? `빈 칸 ${merged.filled}곳에 제안을 채웠습니다. 직접 쓰신 ${merged.kept}칸은 그대로 두었습니다.`
            : `빈 칸 ${merged.filled}곳에 제안을 채웠습니다.`,
      );
    } catch (e) {
      if (alive.current && n === seq.current) setAiError(errorText(e, 'AI가 식단 초안을 만들지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      aiRef.current = false;
      if (alive.current) setAiLoading(false);
    }
  };

  const isThisWeek = weekStart === currentWeekStart();
  const isNextWeek = weekStart === nextWeekStart();
  const aiCount = Object.keys(draft.ai).length;

  return (
    <div className={styles.stack}>
      <MealPlanDiet elders={mealElders.elders} isLoading={mealElders.isLoading} error={mealElders.error} onRetry={mealElders.reload} onCount={setSoftCount} />

      <div className={styles.toolbar}>
        <div role="group" aria-label="주 선택" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <IconButton label="이전 주" tooltip="이전 주" variant="ghost" isDisabled={busy} onClick={() => goWeek(addDays(weekStart, -7) ?? weekStart)} icon={<Icon icon="chevronLeft" size="sm" />} />
          <span style={{ display: 'inline-block', minWidth: 150, textAlign: 'center' }}>
            <Text type="label" hasTabularNumbers>
              {weekRange(weekStart)}
            </Text>
          </span>
          <IconButton label="다음 주" tooltip="다음 주" variant="ghost" isDisabled={busy} onClick={() => goWeek(addDays(weekStart, 7) ?? weekStart)} icon={<Icon icon="chevronRight" size="sm" />} />
        </div>
        <Button label="이번 주" variant="ghost" isDisabled={busy || isThisWeek} onClick={() => goWeek(currentWeekStart())} />
        <Button label="다음 주 식단 만들기" variant="ghost" isDisabled={busy || isNextWeek} onClick={() => goWeek(nextWeekStart())} />
        <HStack gap={2} vAlign="center">
          {ready && !plan && <Chip tone="neutral" label="아직 저장 안 한 주" />}
          {dirty && <Chip tone="warn" label="저장 전" />}
          {draft.aiUsed && <AiChip label="AI 도움" />}
        </HStack>
      </div>

      {loadError && <ErrorBanner message={loadError} onRetry={() => void load(weekStart)} />}

      {loading ? (
        <Loading size="inline" label="식단표를 불러오는 중..." />
      ) : loadError ? null : (
        <>
          <Card padding={4}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="end" wrap="wrap">
                <Button
                  label="지난주 복사"
                  variant="secondary"
                  isDisabled={busy || !prevDays}
                  onClick={requestCopy}
                  tooltip={prevFailed ? '지난주 식단표를 불러오지 못했습니다' : !prevDays ? '지난주에 저장한 식단표가 없습니다' : undefined}
                />
                <div className={styles.toolbarGrow}>
                  <TextInput label="AI에게 원하는 방향 (선택)" value={prefs} onChange={(v) => setPrefs(v.slice(0, 200))} placeholder="예: 국물은 싱겁게, 이번 주는 생선을 많이" isDisabled={busy} onEnter={() => void runAi()} />
                </div>
                <Button label="AI 식단 짜기" variant="secondary" isLoading={aiLoading} isDisabled={busy} onClick={() => void runAi()} />
              </HStack>
              <SupportText>
                {lastMains.length > 0 ? `지난주 주찬 ${lastMains.length}가지는 피해서 제안합니다. ` : prevFailed ? '지난주 식단표를 불러오지 못해 지난주 주찬은 피하지 못합니다. ' : ''}
                AI는 빈 칸(또는 이전 AI 제안 칸)만 채우고 직접 쓴 칸은 그대로 둡니다. 결과는 제안이니 읽어 보고 고친 뒤 저장해 주세요.
              </SupportText>
              {aiError && <ErrorBanner message={aiError} />}
              {aiNote && !aiError && (
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <AiChip />
                  <SupportText>{aiNote}</SupportText>
                </HStack>
              )}
            </VStack>
          </Card>

          {repeats.length > 0 && (
            <Banner
              status="warning"
              title="같은 주에 주찬이 겹칩니다"
              description={repeats.map((r) => `${r.dish} (${r.dates.map((d) => weekdayLabel(d)).join('·')})`).join(', ')}
            />
          )}
          {sameAsLast.size > 0 && (
            <Banner status="info" title="지난주와 같은 주찬이 있습니다" description={`${[...sameAsLast].map((d) => weekdayLabel(d)).join('·')}요일 — 어르신 식단은 변화가 있어야 잘 드십니다.`} />
          )}

          <Card padding={3}>
            <MealPlanTable days={draft.days} ai={draft.ai} repeated={repeated} sameAsLast={sameAsLast} today={today} isDisabled={saving} onChange={(di, slot, text) => setDraft((d) => setCell(d, di, slot, text))} />
            <div style={{ marginTop: 'var(--spacing-2)' }}>
              <SupportText>
                Enter는 다음 날 같은 칸, ↑↓는 같은 날 위·아래 칸으로 옮깁니다. 저장은 Ctrl+S(Mac은 ⌘S)로도 됩니다.
                {aiCount > 0 ? ` 연한 파란 칸 ${aiCount}곳이 AI 제안입니다.` : ''}
              </SupportText>
            </div>
          </Card>

          <Card padding={4}>
            <div className={styles.fieldGridWide}>
              <TextArea label="주간 메모 (선택)" value={draft.notes} rows={3} maxLength={MEAL_NOTES_LIMIT} onChange={(v) => setDraft((d) => ({ ...d, notes: v }))} description="재료 수급·행사식·알레르기 안내 등" />
              <TextInput label="작성자 (선택)" value={draft.writer} onChange={(v) => setDraft((d) => ({ ...d, writer: v.slice(0, 50) }))} />
            </div>
          </Card>

          {saveError && <ErrorBanner message={saveError} />}
          {missingMain.length > 0 && <SupportText tone="warn">주찬이 비어 있는 날: {missingMain.map((d) => weekdayLabel(d)).join('·')}요일</SupportText>}

          <div className={styles.stickyBar}>
            <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
              <Button label="인쇄 (A4 가로)" variant="ghost" isDisabled={!hasMenu || saving} onClick={() => window.print()} />
              <HStack gap={2}>
                <Button label="이 주 식단 저장" variant="primary" isLoading={saving} isDisabled={busy || (!dirty && !!plan)} onClick={() => void save()} />
              </HStack>
            </HStack>
          </div>
        </>
      )}

      {ready && <MealPlanPrint weekStart={weekStart} days={draft.days} notes={draft.notes} writer={draft.writer} />}

      <LabConfirm
        isOpen={pending?.kind === 'week'}
        title="저장하지 않은 내용이 있습니다"
        description="다른 주로 넘어가면 지금 적은 내용이 사라집니다. 그래도 넘어갈까요?"
        actionLabel="넘어가기"
        onConfirm={() => {
          if (pending?.kind === 'week') setWeekStart(pending.to);
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
      <LabConfirm
        isOpen={pending?.kind === 'copy'}
        title="지난주 식단으로 바꿀까요?"
        description="지금 적힌 이 주의 칸이 모두 지난주 식단으로 바뀝니다. 저장하기 전에는 다른 주로 갔다 오면 원래대로 돌아옵니다."
        actionLabel="복사하기"
        onConfirm={() => {
          applyCopy();
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
