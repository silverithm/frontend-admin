'use client';

/**
 * 직원 인사 기준 편집 — 직원을 고르고 입사일·직종·출생연도·자격 합격일·사무직 여부·메모를 저장한다.
 * 급여 기준이 있으면 "급여 기준에서 가져오기"로 직종·입사일을 채운다. 출생연도는 이 칸에서만 보인다(보수교육 대상 판정용).
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { saveStaffProfile } from '@/lib/lab/labApi';
import type { PayrollProfile } from '@/lib/lab/labTypes';
import { ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { JOB_OPTIONS } from './PayrollDraft';
import { BIRTH_YEAR_MAX, BIRTH_YEAR_MIN, HR_LIMITS, applyPayrollProfile, draftFromProfile, newProfileDraft, profileInput, profileProblems, profileSnapshot } from './StaffHrDraft';
import type { HrPerson, ProfileDraft } from './StaffHrDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  people: HrPerson[];
  payroll: PayrollProfile[];
  /** 처음 고를 직원 — 없으면 비워 둔다 */
  memberId: number | null;
  onSaved: () => void;
  onClose: () => void;
}

export default function StaffHrProfileEditor({ people, payroll, memberId, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const personOf = (id: number | null) => people.find((p) => p.memberId === id) ?? null;
  const start = (id: number | null): ProfileDraft => {
    const found = personOf(id);
    return found?.profile ? draftFromProfile(found.profile) : newProfileDraft(id);
  };
  const [draft, setDraft] = useState<ProfileDraft>(() => start(memberId));
  const [baseline, setBaseline] = useState(() => profileSnapshot(start(memberId)));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const problems = useMemo(() => profileProblems(draft), [draft]);
  const dirty = profileSnapshot(draft) !== baseline;
  const pay = payroll.find((p) => p.memberId === draft.memberId) ?? null;
  const person = personOf(draft.memberId);
  const options = people.map((p) => ({ value: String(p.memberId), label: p.profile ? p.name : `${p.name} (기준 없음)` }));
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const pickPerson = (id: number) => {
    const next = start(id);
    setDraft(next);
    setBaseline(profileSnapshot(next));
    setSubmitted(false);
    setError(null);
  };

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
      await saveStaffProfile(profileInput(draft));
      notify('직원 인사 기준을 저장했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '직원 인사 기준을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {person?.profile ? '직원 기준 고치기' : '직원 기준 등록'}
            </Text>
            <Text type="supporting" color="secondary">
              {person ? `${person.name} 직원` : '직원을 먼저 골라 주세요'}
            </Text>
          </VStack>
          <Button label="닫기" variant="ghost" isDisabled={saving} onClick={() => (dirty ? setConfirmLeave(true) : onClose())} />
        </HStack>

        <div className={styles.fieldGridWide}>
          <Selector
            label="직원"
            placeholder="직원 고르기"
            hasSearch={options.length > 8}
            searchPlaceholder="찾기"
            options={options}
            value={draft.memberId === null ? '' : String(draft.memberId)}
            onChange={(v) => v && pickPerson(Number(v))}
            isDisabled={saving}
          />
          <VStack gap={1}>
            <Button
              label="급여 기준에서 가져오기"
              variant="secondary"
              isDisabled={saving || pay === null}
              onClick={() => pay && setDraft((d) => applyPayrollProfile(d, pay))}
            />
            <SupportText>{draft.memberId === null ? '직원을 고르면 급여 기준이 있는지 알려 드립니다.' : pay ? '직종과 입사일을 급여 기준 값으로 채웁니다.' : '이 직원은 급여 기준이 없어 직접 적어야 합니다.'}</SupportText>
          </VStack>
        </div>

        <div className={styles.fieldGridWide}>
          <LabDateInput label="입사일" value={draft.hireDate} onChange={(v) => set('hireDate', v)} />
          <Selector
            label="직종"
            placeholder="직종 고르기"
            options={JOB_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={draft.jobType}
            onChange={(v) => v && set('jobType', v as ProfileDraft['jobType'])}
            isDisabled={saving}
          />
        </div>

        <div className={styles.fieldGridWide}>
          <TextInput
            label="출생연도 (선택)"
            placeholder="예: 1968"
            description={`요양보호사 보수교육 대상 연도(홀·짝)를 가리는 데만 씁니다. ${BIRTH_YEAR_MIN}~${BIRTH_YEAR_MAX}`}
            value={draft.birthYear}
            onChange={(v) => set('birthYear', v.replace(/\D/g, '').slice(0, 4))}
            isDisabled={saving}
          />
          <LabDateInput label="자격 합격일 (선택)" value={draft.licensePassedOn} onChange={(v) => set('licensePassedOn', v)} max={today} />
        </div>
        <SupportText>요양보호사 자격시험 합격 후 2년이 지나지 않은 해에는 보수교육이 면제됩니다. 합격일을 모르면 비워 두세요.</SupportText>

        <CheckboxInput label="사무직입니다 (건강검진 2년마다)" value={draft.officeWorker} onChange={(v) => set('officeWorker', v)} />
        <TextInput label="메모 (선택)" placeholder="예: 2024년 3월 재입사" value={draft.note} onChange={(v) => set('note', v.slice(0, HR_LIMITS.note))} isDisabled={saving} />

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
        <HStack hAlign="end" gap={2}>
          <Button label="기준 저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
        </HStack>
      </VStack>
      <LabConfirm isOpen={confirmLeave} title="저장하지 않고 닫을까요?" description="고친 내용이 사라집니다." actionLabel="닫기" onConfirm={onClose} onClose={() => setConfirmLeave(false)} />
    </Card>
  );
}
