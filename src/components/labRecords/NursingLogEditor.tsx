'use client';

/**
 * 간호일지 하루치 편집기 — 어르신 한 명 · 하루.
 * 매일 쓰는 화면이라 키보드로 끝낼 수 있게 했다: Enter는 다음 칸, Ctrl(⌘)+Enter는 "저장하고 다음 어르신".
 * 입력하는 동안 높음·관찰·낮음을 칸 아래에 바로 보여 주고(0.35초 멈춘 뒤), 저장은 직원이 누를 때만 한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { deleteNursingLog, saveNursingLog } from '@/lib/lab/labApi';
import type { MedStatus, NursingLog, VitalFlagMetric } from '@/lib/lab/labTypes';
import { closestPreviousWeight, evaluateVitals, worstVitalLevel } from '@/lib/lab/vitalFlags';
import type { VitalFlag } from '@/lib/lab/vitalFlags';
import { Chip, ErrorBanner, LabConfirm, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, dateLabel, defaultPersonName, errorText, writeStored } from '@/components/lab/labFormat';
import {
  MED_OPTIONS,
  MED_SLOTS,
  TEXT_MAX,
  VITAL_SPECS,
  draftFromLog,
  fieldErrors,
  hasContent,
  readingOf,
  snapshotOf,
  toInput,
} from './NursingLogDraft';
import type { MedKey, NursingDraft, VitalKey } from './NursingLogDraft';
import { useNursingHistory } from './NursingLogHistory';
import NursingLogTrend from './NursingLogTrend';
import { LevelChip } from './RecordsUi';
import { sanitizeDecimal, useAlive, useDebounced } from './recordsFormat';
import styles from './labRecords.module.css';

const MED_MARK: Record<MedStatus, string> = { GIVEN: '○', SKIPPED: '×', NA: '-' };

interface EditorProps {
  elderId: number;
  elderName: string;
  date: string;
  log: NursingLog | null;
  /** 저장 뒤 다음 어르신으로 넘어갈 수 있는지(목록에 다음 분이 있는지) */
  hasNext: boolean;
  onSaved: (log: NursingLog, goNext: boolean) => void;
  onDeleted: (id: number) => void;
  onDirtyChange: (dirty: boolean) => void;
  onBack: () => void;
}

export default function NursingLogEditor({ elderId, elderName, date, log, hasNext, onSaved, onDeleted, onDirtyChange, onBack }: EditorProps) {
  const notify = useNotify();
  const alive = useAlive();
  const rootRef = useRef<HTMLDivElement>(null);
  const vitalsRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<NursingDraft>(() => draftFromLog(log, defaultPersonName()));
  const [baseline, setBaseline] = useState(() => snapshotOf(draftFromLog(log, defaultPersonName())));
  const [aiUsed, setAiUsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const history = useNursingHistory(elderId, date);

  const dirty = snapshotOf(draft) !== baseline;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // 숫자를 치는 도중의 중간값("2" → "25" → "250")을 판정하지 않도록 잠깐 멈춘 뒤에 판정한다
  const liveVitals = useDebounced(draft.vitals);
  const reading = useMemo(() => readingOf({ ...draft, vitals: liveVitals }), [draft, liveVitals]);
  const flags = useMemo<VitalFlag[]>(() => {
    const previous = closestPreviousWeight(history.logs, date) ?? undefined;
    return evaluateVitals(reading, previous, date);
  }, [reading, history.logs, date]);
  const flagByMetric = useMemo(() => new Map<VitalFlagMetric, VitalFlag>(flags.map((f) => [f.metric, f])), [flags]);
  const errors = useMemo(() => fieldErrors(draft), [draft]);
  const worst = worstVitalLevel(flags);

  const setVital = (key: VitalKey, text: string, decimals: number) => setDraft((d) => ({ ...d, vitals: { ...d.vitals, [key]: sanitizeDecimal(text, decimals) } }));
  const setMed = (key: MedKey, value: string) => setDraft((d) => ({ ...d, meds: { ...d.meds, [key]: value === '' ? null : (value as MedStatus) } }));

  // 직전 기록(가장 가까운 이전 날)의 투약 — "어제와 같게"
  const lastMeds = useMemo(() => {
    const earlier = history.logs.filter((l) => l.logDate.slice(0, 10) < date && (l.medMorning || l.medLunch || l.medEvening));
    return earlier.length > 0 ? earlier[earlier.length - 1] : null;
  }, [history.logs, date]);

  const medsText = MED_SLOTS.map((s) => (draft.meds[s.key] ? MED_MARK[draft.meds[s.key] as MedStatus] : '·')).join(' ');

  const insertSummary = (text: string) => {
    setAiUsed(true);
    setDraft((d) => ({ ...d, note: (d.note.trim() === '' ? text : `${d.note.trim()}\n\n${text}`).slice(0, TEXT_MAX) }));
  };

  const save = async (goNext: boolean) => {
    if (saving) return;
    // 바꾼 것이 없고 이미 저장된 기록이면 저장 없이 다음 어르신으로만 넘어간다
    if (!dirty && log) {
      if (goNext) onSaved(log, true);
      return;
    }
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      setSaveError('범위를 벗어난 칸이 있습니다. 빨간 표시를 확인해 주세요');
      return;
    }
    if (!hasContent(draft)) {
      setSaveError('바이탈·투약·처치·메모 중 한 가지 이상 적어 주세요');
      return;
    }
    if (draft.recorder.trim() === '') {
      setSaveError('기록자 이름을 적어 주세요');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveNursingLog(toInput(draft, elderId, date, aiUsed || (log?.aiAssisted ?? false)));
      writeStored(PROVIDER_KEY, draft.recorder.trim());
      history.apply(saved);
      if (!alive.current) {
        onSaved(saved, false);
        return;
      }
      setBaseline(snapshotOf(draft));
      onSaved(saved, goNext);
      notify(worst ? '저장했습니다. 확인이 필요한 수치가 있어요' : '저장했습니다', 'success');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '간호일지를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!log || deleting) return;
    setDeleting(true);
    try {
      await deleteNursingLog(log.id);
      onDeleted(log.id);
      notify('기록을 삭제했습니다', 'success');
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '간호일지를 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  // Enter → 다음 칸(바이탈 칸 안에서만). 마지막 칸에서는 처치 칸으로.
  const onVitalsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') return;
    const inputs = Array.from(vitalsRef.current?.querySelectorAll<HTMLInputElement>('input:not([disabled])') ?? []);
    const index = inputs.indexOf(target as HTMLInputElement);
    if (index === -1) return;
    e.preventDefault();
    const next = inputs[index + 1] ?? rootRef.current?.querySelector<HTMLTextAreaElement>('textarea');
    next?.focus();
    if (next instanceof HTMLInputElement) next.select();
  };
  const onRootKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing && !e.repeat) {
      e.preventDefault();
      void save(hasNext);
    }
  };

  const messageFlags = flags;

  return (
    <div className={styles.stack} ref={rootRef} onKeyDown={onRootKey}>
      <Card padding={4}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <VStack gap={0.5}>
              <Text type="large" weight="semibold">
                {elderName}
              </Text>
              <Text type="supporting" color="secondary">
                {dateLabel(date)} 간호일지
              </Text>
            </VStack>
            <HStack gap={2} vAlign="center" wrap="wrap">
              {log ? <Chip tone="ok" label="저장됨" /> : <Chip tone="neutral" label="기록 없음" />}
              {dirty && <Chip tone="warn" label="저장 전" />}
              {worst && <Chip tone={worst === 'WATCH' ? 'warn' : 'danger'} label={`확인 필요 ${messageFlags.length}`} />}
              <span className={styles.onlyNarrow}>
                <Button label="목록으로" variant="ghost" onClick={onBack} />
              </span>
            </HStack>
          </HStack>

          <VStack gap={2}>
            <Text type="label">바이탈</Text>
            <div className={styles.fieldGrid} ref={vitalsRef} onKeyDown={onVitalsKey}>
              {VITAL_SPECS.map((spec) => {
                const metric: VitalFlagMetric = spec.key === 'systolic' || spec.key === 'diastolic' ? 'bloodPressure' : spec.key;
                const flag = spec.key === 'diastolic' ? undefined : flagByMetric.get(metric);
                const error = errors[spec.key];
                return (
                  <div className={styles.vitalField} key={spec.key}>
                    <TextInput
                      label={`${spec.label} (${spec.unit})`}
                      value={draft.vitals[spec.key]}
                      onChange={(text) => setVital(spec.key, text, spec.decimals)}
                      placeholder={spec.placeholder}
                      status={submitted && error ? { type: 'error', message: error } : undefined}
                      hasAutoFocus={spec.key === 'systolic'}
                    />
                    <div className={styles.vitalFlag}>{flag && <LevelChip level={flag.level} />}</div>
                  </div>
                );
              })}
            </div>
            {messageFlags.map((f) => (
              <SupportText key={f.metric} tone={f.level === 'WATCH' ? 'warn' : 'error'}>
                {f.message}
              </SupportText>
            ))}
            <SupportText>Enter로 다음 칸, Ctrl(⌘)+Enter로 {hasNext ? '저장하고 다음 어르신' : '저장'}. 소수점은 쉼표로 쳐도 됩니다.</SupportText>
          </VStack>

          <VStack gap={2}>
            <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
              <Text type="label">투약</Text>
              <HStack gap={1} wrap="wrap">
                <Button
                  label="모두 드림"
                  variant="ghost"
                  onClick={() => setDraft((d) => ({ ...d, meds: { medMorning: 'GIVEN', medLunch: 'GIVEN', medEvening: 'GIVEN' } }))}
                />
                {lastMeds && (
                  <Button
                    label={`${Number(lastMeds.logDate.slice(5, 7))}/${Number(lastMeds.logDate.slice(8, 10))}과 같게`}
                    variant="ghost"
                    onClick={() => setDraft((d) => ({ ...d, meds: { medMorning: lastMeds.medMorning, medLunch: lastMeds.medLunch, medEvening: lastMeds.medEvening } }))}
                  />
                )}
                <Button label="비우기" variant="ghost" onClick={() => setDraft((d) => ({ ...d, meds: { medMorning: null, medLunch: null, medEvening: null } }))} />
              </HStack>
            </HStack>
            {MED_SLOTS.map((slot) => (
              <HStack key={slot.key} gap={3} vAlign="center" wrap="wrap">
                <span style={{ minWidth: 64 }}>
                  <Text type="body">{slot.label}</Text>
                </span>
                <SegmentedControl label={slot.label} value={draft.meds[slot.key] ?? ''} onChange={(v) => setMed(slot.key, draft.meds[slot.key] === v ? '' : v)}>
                  {MED_OPTIONS.map((o) => (
                    <SegmentedControlItem key={o.value} value={o.value} label={o.label} />
                  ))}
                </SegmentedControl>
              </HStack>
            ))}
            <SupportText>고른 항목을 다시 누르면 선택이 풀립니다. 비워 두면 “기록 안 함”으로 저장됩니다.</SupportText>
          </VStack>

          <div className={styles.fieldGridWide}>
            <TextArea label="처치" value={draft.treatment} onChange={(v) => setDraft((d) => ({ ...d, treatment: v }))} rows={3} maxLength={TEXT_MAX} isOptional placeholder="예: 우측 발목 소독 후 드레싱, 보행 시 통증 호소 없음" />
            <TextArea label="메모" value={draft.note} onChange={(v) => setDraft((d) => ({ ...d, note: v }))} rows={3} maxLength={TEXT_MAX} isOptional placeholder="특이사항·보호자 연락·의료기관 이용 등" />
          </div>

          <div className={styles.fieldGrid}>
            <TextInput label="기록자 이름" value={draft.recorder} onChange={(v) => setDraft((d) => ({ ...d, recorder: v.slice(0, 50) }))} isRequired />
          </div>

          {saveError && <ErrorBanner message={saveError} />}

          <div className={styles.stickyBar}>
            <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
              <div>{log && <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}</div>
              <HStack gap={2} wrap="wrap">
                <Button label="저장" variant={hasNext ? 'secondary' : 'primary'} isLoading={saving} isDisabled={saving || (!dirty && !!log)} onClick={() => void save(false)} />
                {hasNext && <Button label={!dirty && log ? '다음 어르신' : '저장하고 다음 어르신'} variant="primary" isDisabled={saving} onClick={() => void save(true)} />}
              </HStack>
            </HStack>
          </div>
        </VStack>

        <LabConfirm
          isOpen={confirmDelete}
          title="이 기록을 삭제할까요?"
          description={`${elderName} 어르신의 ${dateLabel(date)} 간호일지가 지워지며 되돌릴 수 없습니다.`}
          actionLabel="삭제"
          isLoading={deleting}
          onConfirm={() => void remove()}
          onClose={() => setConfirmDelete(false)}
        />
      </Card>

      {history.error && <ErrorBanner message={history.error} onRetry={() => void history.reload()} />}
      <NursingLogTrend
        logs={history.logs}
        date={date}
        draftReading={reading}
        draftMeds={medsText}
        draftTreatment={draft.treatment}
        isLoading={history.isLoading}
        onInsertSummary={insertSummary}
      />
    </div>
  );
}
