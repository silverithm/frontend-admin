'use client';

/** 운영위원 입력 — 이름·역할·임기 시작/끝(3년 넘으면 저장 전에 막는다)·활동 여부·비고. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { COMMITTEE_ROLES, MAX_MEMBER_NAME, MAX_MEMBER_NOTE, suggestedTermEnd } from '@/lib/lab/committeeRules';
import type { CommitteeRole } from '@/lib/lab/labTypes';
import { memberBlockers } from './CommitteeDraft';
import type { MemberDraft } from './CommitteeDraft';
import styles from './labPlans.module.css';

interface Props {
  draft: MemberDraft;
  onChange: (next: MemberDraft) => void;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function CommitteeMemberForm({ draft, onChange, dirty, saving, error, onSave, onCancel }: Props) {
  const set = (p: Partial<MemberDraft>) => onChange({ ...draft, ...p });
  const editing = draft.id !== null;
  const blockers = memberBlockers(draft);
  const suggested = suggestedTermEnd(draft.termStart);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '위원 고치기' : '위원 추가'}</Text>
          {dirty && <Chip tone="warn" label="저장하지 않은 변경" />}
        </HStack>
        <div className={styles.fieldGrid}>
          <TextInput label="위원 이름" value={draft.name} onChange={(v) => set({ name: v.slice(0, MAX_MEMBER_NAME) })} placeholder="예: 김영희" isDisabled={saving} />
          <Selector
            label="역할"
            placeholder="역할 고르기"
            options={COMMITTEE_ROLES as unknown as Array<{ value: string; label: string }>}
            value={draft.role}
            onChange={(v) => v && set({ role: v as CommitteeRole })}
            isDisabled={saving}
          />
        </div>
        <div className={styles.fieldGrid}>
          <LabDateInput label="임기 시작일" value={draft.termStart} onChange={(v) => set({ termStart: v, termEnd: draft.termEnd === '' ? suggestedTermEnd(v) ?? '' : draft.termEnd })} />
          <LabDateInput label="임기 끝일" value={draft.termEnd} onChange={(v) => set({ termEnd: v })} />
        </div>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Button label="임기 3년으로 채우기" variant="ghost" isDisabled={saving || suggested === null} onClick={() => suggested && set({ termEnd: suggested })} />
          <SupportText>임기는 3년이고, 시작일부터 3년을 넘기면 저장할 수 없습니다.</SupportText>
        </HStack>
        <CheckboxInput label="활동 중인 위원" value={draft.active} onChange={(checked) => set({ active: checked })} isDisabled={saving} />
        <TextInput label="비고 (선택)" value={draft.note} onChange={(v) => set({ note: v.slice(0, MAX_MEMBER_NOTE) })} placeholder="예: 보호자 대표, 2025년 보궐 위촉" isDisabled={saving} />
        {blockers.length > 0 && draft.name !== '' && (
          <VStack gap={1}>
            <Text type="label">저장하기 전에 확인해 주세요</Text>
            {blockers.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          <Button label={editing ? '고치기 취소' : '비우기'} variant="ghost" isDisabled={saving} onClick={onCancel} />
          <Button label={editing ? '고친 내용 저장' : '위원 저장'} variant="primary" isLoading={saving} isDisabled={saving || blockers.length > 0 || (editing && !dirty)} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
