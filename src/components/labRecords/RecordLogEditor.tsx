'use client';

/**
 * 종류별 기록 편집기 — 한 건. 종류(업무수행일지·시설운영일지·안전관리 설명·현금영수증)에 따라 칸이 달라진다.
 * 위에서 아래로: (어르신) · 기록일 · 작성자 → 확인 항목 → 내용 · 조치 (· 금액 · 승인번호) → 저장.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createRecordLog, deleteRecordLog, updateRecordLog } from '@/lib/lab/labApi';
import type { RecordLog, RecordLogKind } from '@/lib/lab/labTypes';
import { MAX_LOG_ACTION, MAX_LOG_AMOUNT, MAX_LOG_AUTHOR, MAX_LOG_BODY, MAX_LOG_EXTRA, RECORD_LOG_KINDS, draftFromRecordLog, newRecordLogDraft, normalizeChecks, recordLogInput, recordLogProblems } from '@/lib/lab/recordLogRules';
import type { RecordLogDraft } from '@/lib/lab/recordLogRules';
import { ErrorBanner, LabConfirm, LabDateInput, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './RecordLog.module.css';

interface Props {
  kind: RecordLogKind;
  elders: LabElder[];
  log: RecordLog | null;
  /** 새 기록일 때 미리 고를 어르신(안전관리 설명 현황에서 바로 들어올 때) */
  presetElderId?: number | null;
  onSaved: () => void;
  onClose: () => void;
}

const snapshot = (d: RecordLogDraft) => JSON.stringify(d);

export default function RecordLogEditor({ kind, elders, log, presetElderId = null, onSaved, onClose }: Props) {
  const rule = RECORD_LOG_KINDS[kind];
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const [initial] = useState<RecordLogDraft>(() => {
    if (log) return draftFromRecordLog(log);
    const base = newRecordLogDraft(today, (typeof window !== 'undefined' && localStorage.getItem('userName')) || '');
    return { ...base, elderId: presetElderId };
  });
  const [draft, setDraft] = useState<RecordLogDraft>(initial);
  const [baseline] = useState(() => snapshot(initial));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const problems = useMemo(() => recordLogProblems(kind, draft, today), [kind, draft, today]);
  const dirty = snapshot(draft) !== baseline;
  const elderName = elders.find((e) => e.id === draft.elderId)?.name ?? log?.elderlyName ?? '';
  const elderOptions = useMemo(() => {
    const list = elders.map((e) => ({ value: String(e.id), label: e.name }));
    if (log?.elderlyId && !elders.some((e) => e.id === log.elderlyId)) list.push({ value: String(log.elderlyId), label: `${log.elderlyName} (목록에 없음)` });
    return list;
  }, [elders, log]);

  const set = <K extends keyof RecordLogDraft>(key: K, value: RecordLogDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleCheck = (value: string, on: boolean) =>
    setDraft((d) => {
      // 하나만 고르는 종류(현금영수증 구분)는 새로 고르면 이전 선택을 바꾼다
      const next = rule.exactlyOne ? (on ? [value] : []) : on ? [...d.checks, value] : d.checks.filter((c) => c !== value);
      return { ...d, checks: normalizeChecks(kind, next) };
    });

  const save = async () => {
    if (saving) return;
    setSubmitted(true);
    if (problems.length > 0) {
      setError('아래 빨간 안내를 확인해 주세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = recordLogInput(kind, draft);
      if (log) await updateRecordLog(log.id, input);
      else await createRecordLog(input);
      notify(log ? '기록을 고쳤습니다' : '기록을 저장했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!log || deleting) return;
    setDeleting(true);
    try {
      await deleteRecordLog(log.id);
      notify('기록을 삭제했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '기록을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {log ? `${rule.label} 고치기` : `새 ${rule.label}`}
            </Text>
            {rule.perElder && (
              <Text type="supporting" color="secondary">
                {elderName ? `${elderName} 어르신` : '어르신을 먼저 골라 주세요'}
              </Text>
            )}
          </VStack>
          <Button label="목록으로" variant="ghost" isDisabled={saving} onClick={() => (dirty ? setConfirmLeave(true) : onClose())} />
        </HStack>

        <div className={styles.fieldGridWide}>
          {rule.perElder && (
            <Selector
              label="어르신"
              placeholder="어르신 고르기"
              hasSearch={elderOptions.length > 8}
              searchPlaceholder="찾기"
              options={elderOptions}
              value={draft.elderId === null ? '' : String(draft.elderId)}
              onChange={(v) => v && set('elderId', Number(v))}
            />
          )}
          <LabDateInput label={kind === 'CASH_RECEIPT' ? '발행일' : kind === 'SAFETY_BRIEFING' ? '설명한 날' : '기록일'} value={draft.entryDate} onChange={(v) => set('entryDate', v)} max={today} />
          <TextInput label={kind === 'CASH_RECEIPT' ? '발행한 직원' : kind === 'SAFETY_BRIEFING' ? '설명한 직원' : '작성자'} placeholder="직원 이름" value={draft.author} onChange={(v) => set('author', v.slice(0, MAX_LOG_AUTHOR))} />
        </div>

        {rule.requiredGroups.length > 0 ? (
          // 묶음이 있는 종류(안전관리 설명: 설명한 안전 항목 / 설명한 대상)는 묶음마다 나눠 보인다
          rule.requiredGroups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name}>
              <Text type="label">{group.name}</Text>
              <div className={own.checkGrid}>
                {rule.checks
                  .filter((c) => group.values.includes(c.value))
                  .map((c) => (
                    <CheckboxInput key={c.value} label={c.label} value={draft.checks.includes(c.value)} onChange={(on) => toggleCheck(c.value, on)} />
                  ))}
              </div>
            </div>
          ))
        ) : (
          <div role="group" aria-label={rule.checksLabel}>
            <Text type="label">{rule.checksLabel}</Text>
            <div className={own.checkGrid}>
              {rule.checks.map((c) => (
                <CheckboxInput key={c.value} label={c.label} value={draft.checks.includes(c.value)} onChange={(on) => toggleCheck(c.value, on)} />
              ))}
            </div>
          </div>
        )}
        {kind === 'SAFETY_BRIEFING' && <SupportText>안전 항목과 설명한 대상(수급자·보호자)을 각각 하나 이상 골라 주세요. 연 1회 이상 설명하는 것이 기준입니다(고시 대조 필요).</SupportText>}

        {rule.hasAmount && (
          <div className={styles.fieldGridWide}>
            <NumField label="금액 (원)" value={draft.amount} onChange={(v) => set('amount', v)} max={MAX_LOG_AMOUNT} placeholder="예: 85,000" />
            <TextInput label="승인번호 (선택)" placeholder="현금영수증 승인번호" value={draft.extra} onChange={(v) => set('extra', v.slice(0, MAX_LOG_EXTRA))} />
          </div>
        )}

        <TextArea label={rule.bodyLabel} placeholder={rule.bodyPlaceholder} value={draft.body} onChange={(v) => set('body', v.slice(0, MAX_LOG_BODY))} rows={4} maxLength={MAX_LOG_BODY} />
        {!rule.hasAmount && kind !== 'SAFETY_BRIEFING' && (
          <TextArea label="조치·전달 사항 (선택)" placeholder="예: 내일 오전에 업체에 다시 연락하기로 함" value={draft.action} onChange={(v) => set('action', v.slice(0, MAX_LOG_ACTION))} rows={2} maxLength={MAX_LOG_ACTION} />
        )}

        {submitted && problems.length > 0 && (
          <div className={styles.errorText}>
            <ul style={{ margin: 0, paddingInlineStart: 'var(--spacing-4)' }}>
              {problems.map((p) => (
                <li key={p}>
                  <Text type="supporting" color="inherit">
                    {p}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            {log ? <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} /> : <span />}
            <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
      <LabConfirm isOpen={confirmDelete} title="이 기록을 삭제할까요?" description="삭제하면 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setConfirmDelete(false)} />
      <LabConfirm isOpen={confirmLeave} title="저장하지 않고 나갈까요?" description="고친 내용이 사라집니다." actionLabel="나가기" onConfirm={onClose} onClose={() => setConfirmLeave(false)} />
    </Card>
  );
}
