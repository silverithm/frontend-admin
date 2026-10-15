'use client';

/** 이수·검진 기록 한 건 추가·고치기 — 보수교육은 시간·교육기관·이수증 번호, 건강검진은 검진일·기관. 고치는 중이면 삭제 단추도 있다. */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createStaffCert, deleteStaffCert, updateStaffCert } from '@/lib/lab/labApi';
import type { StaffCert, StaffCertKind } from '@/lib/lab/labTypes';
import { ErrorBanner, LabConfirm, LabDateInput, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { EDU_HOURS_MAX, HR_LIMITS, certInput, certProblems, certTitle, draftFromCert, newCertDraft } from './StaffHrDraft';
import type { CertDraft, HrPerson } from './StaffHrDraft';
import { sanitizeDecimal, useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  kind: StaffCertKind;
  people: HrPerson[];
  /** 고치는 기록 — 없으면 새 기록 */
  cert: StaffCert | null;
  /** 새 기록의 기본 직원 */
  memberId: number | null;
  /** 새 기록의 기본 날짜 */
  defaultDate: string;
  onSaved: () => void;
  onClose: () => void;
}

export default function StaffHrCertForm({ kind, people, cert, memberId, defaultDate, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const [draft, setDraft] = useState<CertDraft>(() => (cert ? draftFromCert(cert) : newCertDraft(kind, defaultDate, memberId)));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = useMemo(() => certProblems(draft, today), [draft, today]);
  const isEdu = kind === 'CONTINUING_EDU';
  const noun = isEdu ? '이수' : '검진';
  const options = useMemo(() => {
    const list = people.map((p) => ({ value: String(p.memberId), label: p.name }));
    if (cert && !people.some((p) => p.memberId === cert.memberId)) list.push({ value: String(cert.memberId), label: `${cert.memberName ?? `직원 ${cert.memberId}`} (목록에 없음)` });
    return list;
  }, [people, cert]);
  const set = <K extends keyof CertDraft>(key: K, value: CertDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

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
      const input = certInput(draft);
      if (cert) await updateStaffCert(cert.id, input);
      else await createStaffCert(input);
      notify(cert ? `${noun} 기록을 고쳤습니다` : `${noun} 기록을 저장했습니다`, 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, `${noun} 기록을 저장하지 못했습니다`));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!cert || deleting) return;
    setDeleting(true);
    try {
      await deleteStaffCert(cert.id);
      notify(`${noun} 기록을 삭제했습니다`, 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, `${noun} 기록을 삭제하지 못했습니다`));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="large" weight="semibold">
            {cert ? `${certTitle(kind)} 기록 고치기` : `${certTitle(kind)} 기록 추가`}
          </Text>
          <Button label="닫기" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>
        <div className={styles.fieldGridWide}>
          <Selector
            label="직원"
            placeholder="직원 고르기"
            hasSearch={options.length > 8}
            searchPlaceholder="찾기"
            options={options}
            value={draft.memberId === null ? '' : String(draft.memberId)}
            onChange={(v) => v && set('memberId', Number(v))}
            isDisabled={saving}
          />
          <LabDateInput label={isEdu ? '이수일' : '검진일'} value={draft.doneOn} onChange={(v) => set('doneOn', v)} max={today} />
        </div>
        {isEdu ? (
          <div className={styles.fieldGridWide}>
            <TextInput label="이수 시간" placeholder={`예: 8 (최대 ${EDU_HOURS_MAX}시간)`} value={draft.hours} onChange={(v) => set('hours', sanitizeDecimal(v, 1).slice(0, 4))} isDisabled={saving} />
            <TextInput label="교육기관 (선택)" placeholder="예: 서울요양보호사교육원" value={draft.institution} onChange={(v) => set('institution', v.slice(0, HR_LIMITS.institution))} isDisabled={saving} />
            <TextInput label="이수증 번호 (선택)" placeholder="이수증에 적힌 번호" value={draft.certNo} onChange={(v) => set('certNo', v.slice(0, HR_LIMITS.certNo))} isDisabled={saving} />
          </div>
        ) : (
          <TextInput label="검진 기관 (선택)" placeholder="예: 서울건강검진센터" value={draft.institution} onChange={(v) => set('institution', v.slice(0, HR_LIMITS.institution))} isDisabled={saving} />
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
        <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
          {cert ? <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} /> : <span />}
          <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
        </HStack>
      </VStack>
      <LabConfirm isOpen={confirmDelete} title={`이 ${noun} 기록을 삭제할까요?`} description="삭제하면 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setConfirmDelete(false)} />
    </Card>
  );
}
