'use client';

/**
 * 접종 기록 — 어르신을 여러 명 고르고 같은 날·같은 기관이면 한꺼번에 기록한다(어르신마다 한 건씩 저장, 같은 해·같은 백신은 덮어씀).
 * 한 명이 실패해도 나머지는 저장하고, 실패한 어르신만 남겨 다시 누를 수 있게 한다.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { saveVaccination } from '@/lib/lab/labApi';
import type { Vaccination, VaccinationStatus, VaccineKind, VaccineVerifiedBy } from '@/lib/lab/labTypes';
import { ErrorBanner, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import PersonPicker from './PersonPicker';
import { useAlive } from './recordsFormat';
import { INSTITUTION_MAX, NOTE_MAX, REASON_MAX, STATUS_LABEL, STATUS_OPTIONS, VACCINE_LABEL, VACCINE_OPTIONS, VERIFIED_OPTIONS, draftFromRecord, newVaccineDraft, validateVaccine, vaccinationInput } from './VaccinationDraft';
import type { ActiveElder, VaccineFormDraft } from './VaccinationDraft';
import { VaccinationRefusalNotice } from './VaccinationNotice';
import styles from './labRecords.module.css';
import own from './Vaccination.module.css';

interface Props {
  year: number;
  elders: ActiveElder[];
  /** 그 연도의 모든 백신 기록 — 덮어쓰게 되는 어르신을 알려 주려는 것 */
  existing: Vaccination[];
  /** 한 명 고치기로 열었을 때 */
  initial: { elderId: number; record: Vaccination | null } | null;
  onSaved: () => void;
  onClose: () => void;
}

interface Failure {
  id: number;
  name: string;
  message: string;
}

export default function VaccinationBatchForm({ year, elders, existing, initial, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const busy = useRef(false);
  const [draft, setDraft] = useState<VaccineFormDraft>(() => (initial?.record ? draftFromRecord(initial.record) : newVaccineDraft(year)));
  const [ids, setIds] = useState<number[]>(() => (initial ? [initial.elderId] : []));
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);

  const recordOf = useMemo(() => {
    const map = new Map<number, Vaccination>();
    for (const v of existing) if (v.vaccine === draft.vaccine) map.set(v.elderlyId, v);
    return map;
  }, [existing, draft.vaccine]);
  const items = useMemo(
    () => elders.map((e) => ({ id: e.id, name: e.name, hint: recordOf.has(e.id) ? `이미 ${STATUS_LABEL[recordOf.get(e.id)!.status]} 기록 있음` : null, priority: !recordOf.has(e.id) })),
    [elders, recordOf],
  );
  const overwrite = ids.filter((id) => recordOf.has(id)).length;
  const set = <K extends keyof VaccineFormDraft>(key: K, value: VaccineFormDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (busy.current) return;
    const problem = validateVaccine(draft, year) ?? (ids.length === 0 ? '기록할 어르신을 한 명 이상 골라 주세요' : null);
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    setFailures([]);
    const names = new Map(elders.map((e) => [e.id, e.name]));
    const failed: Failure[] = [];
    let ok = 0;
    for (const [index, id] of ids.entries()) {
      setProgress({ done: index, total: ids.length });
      try {
        await saveVaccination(vaccinationInput(id, year, draft));
        ok += 1;
      } catch (e) {
        failed.push({ id, name: names.get(id) ?? '이름 없음', message: errorText(e, '저장하지 못했습니다') });
      }
    }
    busy.current = false;
    if (!alive.current) return;
    setSaving(false);
    setProgress(null);
    if (ok > 0) onSaved();
    if (failed.length === 0) {
      notify(`${ok}명의 ${VACCINE_LABEL[draft.vaccine]} 접종 기록을 저장했습니다`, 'success');
      onClose();
      return;
    }
    setIds(failed.map((f) => f.id));
    setFailures(failed);
    setError(`${ok}명은 저장했고 ${failed.length}명은 저장하지 못했습니다. 아래 어르신만 남겨 두었으니 확인하고 다시 눌러 주세요`);
  };

  const needsReason = draft.status === 'REFUSED' || draft.status === 'EXCLUDED';
  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              접종 기록
            </Text>
            <Text type="supporting" color="secondary">
              {year}년 · 같은 날, 같은 기관에서 맞은 어르신을 한꺼번에 기록할 수 있습니다
            </Text>
          </VStack>
          <Button label="닫기" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>

        <div className={styles.fieldGrid}>
          <Selector
            label="백신"
            placeholder="백신 고르기"
            options={VACCINE_OPTIONS}
            value={draft.vaccine}
            onChange={(v) => v && set('vaccine', v as VaccineKind)}
            isDisabled={saving}
          />
          <Selector
            label="상태"
            placeholder="상태 고르기"
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={draft.status}
            onChange={(v) => v && set('status', v as VaccinationStatus)}
            isDisabled={saving}
          />
        </div>

        {draft.status === 'DONE' && (
          <div className={styles.fieldGrid}>
            <LabDateInput label="접종일" value={draft.givenOn} onChange={(v) => set('givenOn', v)} max={todayString()} />
            <TextInput label="접종 기관 (선택)" placeholder="예: 우리동네의원" value={draft.institution} onChange={(v) => set('institution', v.slice(0, INSTITUTION_MAX))} isDisabled={saving} />
            <Selector
              label="확인 방법"
              placeholder="확인 방법 고르기"
              options={VERIFIED_OPTIONS}
              value={draft.verifiedBy}
              onChange={(v) => v && set('verifiedBy', v as VaccineVerifiedBy)}
              isDisabled={saving}
            />
          </div>
        )}
        {needsReason && (
          <>
            <TextArea
              label={`${STATUS_LABEL[draft.status]} 사유`}
              placeholder={draft.status === 'REFUSED' ? '예: 보호자가 접종을 원하지 않음' : '예: 급성 질환으로 의사가 접종을 미룸'}
              value={draft.reason}
              onChange={(v) => set('reason', v.slice(0, REASON_MAX))}
              rows={2}
              maxLength={REASON_MAX}
              isDisabled={saving}
            />
            <VaccinationRefusalNotice />
          </>
        )}
        <TextInput label="메모 (선택)" placeholder="예: 접종확인서 사본 보관" value={draft.note} onChange={(v) => set('note', v.slice(0, NOTE_MAX))} isDisabled={saving} />

        <PersonPicker label="어르신" items={items} selected={ids} onChange={setIds} priorityLabel="미기록" max={100} isDisabled={saving} emptyText="진행 중인 어르신이 없습니다" />
        {overwrite > 0 && <SupportText tone="warn">이미 {VACCINE_LABEL[draft.vaccine]} 기록이 있는 {overwrite}명은 이 내용으로 덮어씁니다.</SupportText>}

        {error && <ErrorBanner message={error} />}
        {failures.length > 0 && (
          <ul className={own.failList}>
            {failures.map((f) => (
              <li key={f.id}>
                {f.name}: {f.message}
              </li>
            ))}
          </ul>
        )}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <span className={own.progressText}>
              <Text type="supporting" color="secondary">
                {progress ? `저장 중 ${progress.done + 1}/${progress.total}명...` : `${ids.length}명 선택`}
              </Text>
            </span>
            <Button label={ids.length > 0 ? `${ids.length}명 기록하기` : '기록하기'} variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
    </Card>
  );
}
