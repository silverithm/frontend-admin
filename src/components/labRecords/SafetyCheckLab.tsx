'use client';

/**
 * 위생·안전 점검 — 위에는 이번 달 현황(종류별 done/required·빠진 날), 가운데는 월간 달력과 점검표 작성, 아래는 재난훈련 연 2회.
 * 운영일은 평일(월~금)에서 공휴일·휴원일을 뺀 날이고, 빼 둔 날과 "차량 운행 안 함"은 이 브라우저에 기억한다(평가 준비 화면도 읽는다).
 * 빠진 날을 누르면 그날 점검표가 바로 열린다. 달·날짜·종류를 바꿀 때 저장하지 않은 점검표가 있으면 먼저 묻는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listSafetyChecks, listSafetyChecksByYear } from '@/lib/lab/labApi';
import type { SafetyCheck, SafetyKind } from '@/lib/lab/labTypes';
import { SAFETY_CADENCE_LABEL, SAFETY_KINDS, cadenceOf, monthlySafetySummary, safetyKindLabel } from '@/lib/lab/safetyRules';
import { mondayOf } from '@/lib/lab/programRules';
import { ErrorBanner, LabConfirm, LabDateInput, MonthStepper, SupportText } from '@/components/lab/LabUi';
import { currentMonth, errorText, monthLabel, todayString } from '@/components/lab/labFormat';
import SafetyCheckCalendar from './SafetyCheckCalendar';
import SafetyCheckDrill from './SafetyCheckDrill';
import SafetyCheckEditor from './SafetyCheckEditor';
import { useSafetySettings } from './SafetyCheckSettings';
import SafetyCheckSummary from './SafetyCheckSummary';
import { monthOf, yearOf } from './recordsFormat';
import styles from './labRecords.module.css';

interface Target {
  kind: SafetyKind;
  date: string;
}

/** 저장 결과를 목록에 반영한다(같은 종류·날짜가 있으면 바꾸고, 없으면 더한다) */
function upsert(list: SafetyCheck[], saved: SafetyCheck): SafetyCheck[] {
  const day = saved.checkDate.slice(0, 10);
  const rest = list.filter((c) => c.id !== saved.id && !(c.kind === saved.kind && c.checkDate.slice(0, 10) === day));
  return [...rest, saved];
}

export default function SafetyCheckLab() {
  const today = todayString();
  const [month, setMonth] = useState(currentMonth);
  const settings = useSafetySettings(month);
  const [target, setTarget] = useState<Target>({ kind: 'KITCHEN', date: todayString() });
  const [checks, setChecks] = useState<SafetyCheck[]>([]);
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const [year, setYear] = useState(yearOf(today));
  const [drills, setDrills] = useState<SafetyCheck[]>([]);
  const [drillLoading, setDrillLoading] = useState(true);
  const [drillError, setDrillError] = useState<string | null>(null);
  const drillSeq = useRef(0);

  const [editMode, setEditMode] = useState(false);
  const [pending, setPending] = useState<{ apply: () => void } | null>(null);
  const dirtyRef = useRef(false);
  const editorBox = useRef<HTMLDivElement>(null);

  const load = useCallback(async (value: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listSafetyChecks(value);
      if (n !== seq.current) return; // 달을 빨리 넘길 때 늦게 온 응답은 버린다
      setChecks(list);
      setLoadedMonth(value);
    } catch (e) {
      if (n !== seq.current) return;
      setChecks([]);
      setLoadedMonth(null);
      setError(errorText(e, '점검 기록을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  const loadDrills = useCallback(async (value: number) => {
    const n = ++drillSeq.current;
    setDrillLoading(true);
    setDrillError(null);
    try {
      const list = await listSafetyChecksByYear(value, 'DRILL');
      if (n !== drillSeq.current) return;
      setDrills(list);
    } catch (e) {
      if (n !== drillSeq.current) return;
      setDrills([]);
      setDrillError(errorText(e, '재난훈련 기록을 불러오지 못했습니다'));
    } finally {
      if (n === drillSeq.current) setDrillLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
    return () => {
      seq.current += 1;
    };
  }, [month, load]);
  useEffect(() => {
    void loadDrills(year);
    return () => {
      drillSeq.current += 1;
    };
  }, [year, loadDrills]);

  /** 저장하지 않은 점검표가 있으면 묻고, 없으면 바로 옮긴다 */
  const guarded = (apply: () => void) => {
    if (dirtyRef.current) setPending({ apply });
    else apply();
  };

  const goMonth = (next: string) =>
    guarded(() => {
      setMonth(next);
      setEditMode(false);
      // 새 달에서 쓸 날짜: 이번 달이면 오늘, 그 밖의 달은 1일(아직 안 온 달은 쓸 수 없다고 안내한다)
      setTarget((t) => ({ ...t, date: next === monthOf(todayString()) ? todayString() : `${next}-01` }));
    });

  const openTarget = (next: Target) =>
    guarded(() => {
      setMonth(monthOf(next.date));
      setTarget(next);
      setEditMode(false);
      setTimeout(() => editorBox.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    });

  const pickMissing = (kind: SafetyKind, missing: string) => {
    const cadence = cadenceOf(kind);
    let date = missing;
    if (cadence === 'MONTHLY') date = month === monthOf(today) ? today : `${month}-01`;
    else if (cadence === 'WEEKLY') date = settings.operatingDays.find((d) => d <= today && mondayOf(d) === missing) ?? (missing.startsWith(month) ? missing : `${month}-01`);
    openTarget({ kind, date: date > today ? today : date });
  };

  const kinds = useMemo(() => SAFETY_KINDS.filter((k) => !(settings.noVehicle && k === 'VEHICLE')), [settings.noVehicle]);
  const dailyKinds = useMemo(() => kinds.filter((k) => cadenceOf(k) === 'DAILY'), [kinds]);
  const operatingSet = useMemo(() => new Set(settings.operatingDays), [settings.operatingDays]);
  const closedSet = useMemo(() => new Set(settings.closed.filter((d) => d.startsWith(`${month}-`))), [settings.closed, month]);
  const summary = useMemo(() => monthlySafetySummary(checks, month, settings.operatingDays.filter((d) => d <= today), month > monthOf(today) ? [] : kinds), [checks, month, settings.operatingDays, today, kinds]);

  const existing = checks.find((c) => c.kind === target.kind && c.checkDate.slice(0, 10) === target.date) ?? null;
  const dateOk = target.date <= today && monthOf(target.date) === month;
  const canEdit = dateOk && !loading && !error && loadedMonth === month;

  const kindOptions = SAFETY_KINDS.map((k) => ({ value: k, label: `${safetyKindLabel(k)} · ${SAFETY_CADENCE_LABEL[cadenceOf(k)]}` }));

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={goMonth} isDisabled={loading} />
        <Text type="supporting" color="secondary">
          운영일 {settings.operatingDays.length}일{closedSet.size > 0 ? ` (휴원 ${closedSet.size}일 뺌)` : ''}
        </Text>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}

      <SafetyCheckSummary month={month} summary={summary} noVehicle={settings.noVehicle} onNoVehicle={settings.setNoVehicle} isLoading={loading} onPick={pickMissing} />

      <Card padding={4}>
        <VStack gap={3}>
          <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
            <Text type="large" weight="semibold">
              {monthLabel(month)} 점검 달력
            </Text>
            <Button label={editMode ? '운영일 편집 끝내기' : '공휴일·휴원일 빼기'} variant={editMode ? 'primary' : 'secondary'} size="sm" onClick={() => setEditMode((v) => !v)} />
          </HStack>
          <SafetyCheckCalendar
            month={month}
            checks={checks}
            operating={operatingSet}
            closed={closedSet}
            dailyKinds={dailyKinds}
            editMode={editMode}
            selected={target.date}
            onSelect={(date) => openTarget({ ...target, date })}
            onToggleClosed={settings.toggleClosed}
          />
          <SupportText>
            {editMode
              ? '쉬는 평일을 누르면 운영일에서 빠지고, 다시 누르면 돌아옵니다. 이 브라우저에 기억합니다.'
              : `숫자는 그날 해야 하는 매일 점검(주방·위생${settings.noVehicle ? '' : '·차량'})을 한 개수입니다. 날짜를 누르면 그날 점검표가 열립니다.`}
          </SupportText>
        </VStack>
      </Card>

      <div ref={editorBox} className={styles.stack}>
        <Card padding={4}>
          <div className={styles.fieldGrid}>
            <LabDateInput label="점검 날짜" value={target.date} max={today} onChange={(v) => v && v !== target.date && openTarget({ ...target, date: v })} />
            <Selector label="점검 종류" options={kindOptions} value={target.kind} onChange={(v) => v && v !== target.kind && guarded(() => setTarget((t) => ({ ...t, kind: v as SafetyKind })))} />
          </div>
        </Card>

        {!dateOk ? (
          <Card padding={4}>
            <SupportText>{target.date > today ? '오늘 이후 날짜는 점검을 기록할 수 없습니다. 날짜를 고르거나 달력에서 지난 날을 눌러 주세요.' : '점검 날짜를 이 달 안에서 골라 주세요.'}</SupportText>
          </Card>
        ) : loading ? (
          <Loading size="inline" label="점검 기록을 불러오는 중..." />
        ) : !canEdit ? (
          <Card padding={4}>
            <SupportText>점검 기록을 불러오지 못해 새로 쓸 수 없습니다. 같은 날 기록을 덮어쓸 수 있어서, 불러온 뒤에 써 주세요.</SupportText>
          </Card>
        ) : (
          <SafetyCheckEditor
            key={`${target.kind}|${target.date}|${existing?.id ?? 'new'}`}
            kind={target.kind}
            date={target.date}
            existing={existing}
            dirtyRef={dirtyRef}
            onSaved={(saved) => {
              setChecks((list) => upsert(list, saved));
              if (saved.kind === 'DRILL') void loadDrills(year);
            }}
            onDeleted={(id) => {
              setChecks((list) => list.filter((c) => c.id !== id));
              if (target.kind === 'DRILL') void loadDrills(year);
            }}
          />
        )}
      </div>

      <SafetyCheckDrill
        year={year}
        maxYear={yearOf(today)}
        checks={drills}
        isLoading={drillLoading}
        error={drillError}
        onYear={(y) => setYear(y)}
        onRetry={() => void loadDrills(year)}
        onWrite={() => openTarget({ kind: 'DRILL', date: today })}
        onOpen={(date) => openTarget({ kind: 'DRILL', date })}
      />

      <LabConfirm
        isOpen={pending !== null}
        title="저장하지 않은 점검표가 있습니다"
        description="다른 날짜·종류로 옮기면 지금 적은 내용이 사라집니다. 그래도 옮길까요?"
        actionLabel="옮기기"
        onConfirm={() => {
          dirtyRef.current = false;
          pending?.apply();
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
