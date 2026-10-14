'use client';

/**
 * 보기 1 "급여 기준" — 직원 목록(왼쪽)과 선택한 직원의 급여 기준 편집 양식(오른쪽).
 * 기준이 없는 직원은 "미설정"으로 먼저 보인다. 저장은 직원 한 명씩(savePayrollProfile)이다.
 */
import { useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { deletePayrollProfile, savePayrollProfile } from '@/lib/lab/labApi';
import type { LabStaff, PayrollProfile } from '@/lib/lab/labTypes';
import PayrollProfileForm from './PayrollProfileForm';
import { emptyProfileDraft, jobLabel, profileDraftOf, profileInputOf, profileSnapshot, profileSummary } from './PayrollDraft';
import type { ProfileDraft } from './PayrollDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  staff: LabStaff[];
  profiles: PayrollProfile[];
  /** 저장·삭제가 끝난 프로필 목록 갱신 */
  onProfilesChange: (next: (prev: PayrollProfile[]) => PayrollProfile[]) => void;
}

export default function PayrollProfiles({ staff, profiles, onProfilesChange }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [baseline, setBaseline] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const byMember = useMemo(() => new Map(profiles.map((p) => [p.memberId, p])), [profiles]);
  const people = useMemo(() => {
    const known = new Set(staff.map((s) => s.id));
    // 직원 목록에서 빠졌지만 급여 기준이 남은 사람도 보여 준다(퇴사자 정리용)
    const extra = profiles.filter((p) => !known.has(p.memberId)).map((p) => ({ id: p.memberId, name: p.memberName ?? `직원 ${p.memberId}`, role: '', position: '' }));
    const q = query.trim();
    return [...staff, ...extra].filter((s) => q === '' || s.name.includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [staff, profiles, query]);

  const selected = selectedId === null ? null : people.find((s) => s.id === selectedId) ?? staff.find((s) => s.id === selectedId) ?? null;
  const existing = selectedId === null ? null : byMember.get(selectedId) ?? null;
  const dirty = selectedId !== null && profileSnapshot(draft) !== baseline;
  const missingCount = staff.filter((s) => !byMember.has(s.id)).length;

  const open = (id: number) => {
    const p = byMember.get(id) ?? null;
    const next = p ? profileDraftOf(p) : emptyProfileDraft();
    setSelectedId(id);
    setDraft(next);
    setBaseline(p ? profileSnapshot(next) : '');
    setError(null);
  };

  const choose = (id: number) => {
    if (saving || id === selectedId) return;
    if (dirty) setPendingId(id);
    else open(id);
  };

  const save = async () => {
    if (savingRef.current || selectedId === null) return;
    const id = selectedId;
    const now = draft;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await savePayrollProfile(profileInputOf(id, now));
      if (!alive.current) return;
      onProfilesChange((prev) => [...prev.filter((p) => p.memberId !== saved.memberId), saved]);
      notify('급여 기준을 저장했습니다', 'success');
      // 저장 중에 다른 직원으로 옮기지 못하게 막아 두었으므로 같은 직원이다
      setBaseline(profileSnapshot(now));
    } catch (e) {
      if (alive.current) setError(errorText(e, '급여 기준을 저장하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (savingRef.current || !existing) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await deletePayrollProfile(existing.id);
      if (!alive.current) return;
      const memberId = existing.memberId;
      onProfilesChange((prev) => prev.filter((p) => p.memberId !== memberId));
      notify('급여 기준을 삭제했습니다. 저장된 급여 줄은 그대로 남습니다', 'info');
      setConfirmDelete(false);
      setSelectedId(null);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '급여 기준을 삭제하지 못했습니다'));
      }
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  return (
    <div className={styles.split} data-has-selection={selectedId !== null ? 'true' : 'false'}>
      <div className={`${styles.stackTight} ${styles.splitList}`}>
        <Text type="supporting" color="secondary">
          {staff.length === 0 ? '직원 목록이 비어 있습니다' : missingCount > 0 ? `급여 기준이 없는 직원 ${missingCount}명 — 눌러서 설정하세요` : `직원 ${staff.length}명 모두 설정됨`}
        </Text>
        {people.length > 8 || query !== '' ? <TextInput label="직원 찾기" isLabelHidden placeholder="이름으로 찾기" value={query} onChange={setQuery} hasClear /> : null}
        <Card padding={0}>
          <div className={styles.listScroll}>
            {people.length === 0 ? (
              <div className={styles.rowBlock}>
                <Text type="supporting" color="secondary">
                  {query !== '' ? `‘${query.trim()}’와 맞는 직원이 없습니다` : '직원이 없습니다'}
                </Text>
              </div>
            ) : (
              people.map((s) => {
                const p = byMember.get(s.id);
                return (
                  <button key={s.id} type="button" className={styles.elderButton} aria-current={s.id === selectedId} disabled={saving} onClick={() => choose(s.id)}>
                    <span>
                      <Text type="label">{s.name}</Text>
                      <br />
                      <span className={styles.mutedText}>
                        <Text type="supporting" color="inherit">
                          {p ? profileSummary(p) : [s.position, s.role].filter(Boolean).join(' · ') || '직종 미설정'}
                        </Text>
                      </span>
                    </span>
                    <span className={styles.chips}>{p ? <Chip tone="ok" label={jobLabel(p.jobType)} /> : <Chip tone="warn" label="미설정" />}</span>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className={styles.splitDetail}>
        {selected ? (
          <PayrollProfileForm
            name={selected.name}
            meta={[selected.position, selected.role].filter(Boolean).join(' · ') || '같은 기관 직원'}
            draft={draft}
            onChange={setDraft}
            isExisting={existing !== null}
            dirty={dirty || existing === null}
            saving={saving}
            error={error}
            onSave={() => void save()}
            onDelete={() => setConfirmDelete(true)}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <Card padding={6}>
            <EmptyState isCompact title="왼쪽에서 직원을 골라 주세요" description="직종·월급(시급)·가족 수·4대보험 가입 여부를 한 번만 저장해 두면, 월 급여대장이 이 기준으로 계산합니다." />
          </Card>
        )}
      </div>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 직원의 급여 기준을 삭제할까요?"
        description="이미 저장한 월 급여 줄은 남지만, 이 직원은 월 급여대장의 입력 줄에서 빠집니다."
        actionLabel="삭제"
        isLoading={saving}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
      <LabConfirm
        isOpen={pendingId !== null}
        title="저장하지 않은 내용이 있습니다"
        description="다른 직원으로 넘어가면 지금 고친 내용이 사라집니다. 그래도 넘어갈까요?"
        actionLabel="넘어가기"
        onConfirm={() => {
          if (pendingId !== null) open(pendingId);
          setPendingId(null);
        }}
        onClose={() => setPendingId(null)}
      />
    </div>
  );
}
