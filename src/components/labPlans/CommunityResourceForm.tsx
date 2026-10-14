'use client';

/** 자원연계 입력 양식 — 어르신(또는 기관 전체)·날짜·자원 종류·기관·담당자·내용·결과·후속 확인 예정일·연계기록지 제공. */
import { useMemo } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { AiChip, Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import type { LabElder } from '@/components/lab/useLabElders';
import type { ResourceType } from '@/lib/lab/labTypes';
import { ALL_ELDERS, MAX_CONTACT_PERSON, MAX_INSTITUTION, MAX_RESOURCE_CONTENT, MAX_RESOURCE_OUTCOME, MAX_WRITER_NAME, RESOURCE_OPTIONS, resourceIssues } from './CommunityResourceDraft';
import type { ResourceDraft } from './CommunityResourceDraft';
import styles from './labPlans.module.css';

interface Props {
  draft: ResourceDraft;
  onChange: (next: ResourceDraft) => void;
  elders: LabElder[];
  eldersLoading: boolean;
  /** 고치는 중인 기록의 어르신이 목록에 없을 때(퇴소 등) 보여 줄 이름 */
  fallbackElderName: string | null;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function CommunityResourceForm({ draft, onChange, elders, eldersLoading, fallbackElderName, saving, error, onSave, onCancel }: Props) {
  const set = (patch: Partial<ResourceDraft>) => onChange({ ...draft, ...patch });
  const issues = resourceIssues(draft);
  const editing = draft.id !== null;
  const touched = draft.institution !== '' || draft.content !== '';
  const elderOptions = useMemo(() => {
    const list = [{ value: ALL_ELDERS, label: '기관 전체(특정 어르신 아님)' }, ...elders.map((e) => ({ value: String(e.id), label: e.name }))];
    if (draft.elderlyId !== null && !elders.some((e) => e.id === draft.elderlyId)) list.push({ value: String(draft.elderlyId), label: fallbackElderName ?? '(목록에 없는 어르신)' });
    return list;
  }, [elders, draft.elderlyId, fallbackElderName]);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '자원연계 고치기' : '자원연계 적기'}</Text>
          {editing && <Chip tone="warn" label="수정 중" />}
          {draft.aiAssisted && <AiChip label="AI 제안 참고" />}
        </HStack>
        <div className={styles.fieldGrid}>
          <Selector
            label="대상 어르신"
            placeholder={eldersLoading ? '어르신 목록을 불러오는 중...' : '어르신 고르기'}
            hasSearch
            searchPlaceholder="이름으로 찾기"
            options={elderOptions}
            value={draft.elderlyId === null ? ALL_ELDERS : String(draft.elderlyId)}
            onChange={(v) => set({ elderlyId: v === null || v === ALL_ELDERS ? null : Number(v) })}
            isDisabled={saving}
          />
          <LabDateInput label="연계 날짜" value={draft.linkedOn} onChange={(v) => set({ linkedOn: v })} />
          <Selector label="자원 종류" options={RESOURCE_OPTIONS} value={draft.resourceType} onChange={(v) => v && set({ resourceType: v as ResourceType, aiAssisted: false })} isDisabled={saving} />
        </div>
        <div className={styles.fieldGrid}>
          <TextInput label="기관 이름" placeholder="예: ○○보건소 치매안심센터" value={draft.institution} onChange={(v) => set({ institution: v.slice(0, MAX_INSTITUTION) })} isDisabled={saving} />
          <TextInput label="담당자 (선택)" value={draft.contactPerson} onChange={(v) => set({ contactPerson: v.slice(0, MAX_CONTACT_PERSON) })} isDisabled={saving} />
        </div>
        <TextArea
          label="연계한 내용"
          placeholder="예: 치매 선별검사를 의뢰하고 검사 일정을 안내함"
          value={draft.content}
          onChange={(v) => set({ content: v.slice(0, MAX_RESOURCE_CONTENT) })}
          rows={3}
          maxLength={MAX_RESOURCE_CONTENT}
          isDisabled={saving}
        />
        <TextArea
          label="결과 (선택)"
          description="아직 결과가 없으면 비워 두세요. 후속 확인 예정일이 지났는데 결과가 비어 있으면 목록에서 알려 드립니다."
          value={draft.outcome}
          onChange={(v) => set({ outcome: v.slice(0, MAX_RESOURCE_OUTCOME) })}
          rows={2}
          maxLength={MAX_RESOURCE_OUTCOME}
          isDisabled={saving}
        />
        <div className={styles.fieldGrid}>
          <LabDateInput label="후속 확인 예정일 (선택)" value={draft.followUpOn} onChange={(v) => set({ followUpOn: v })} />
          <TextInput label="작성자" value={draft.writer} onChange={(v) => set({ writer: v.slice(0, MAX_WRITER_NAME) })} isDisabled={saving} />
        </div>
        <VStack gap={1}>
          <Switch label="연계기록지를 제공했습니다" value={draft.referralGiven} onChange={(v) => set({ referralGiven: v })} isDisabled={saving} />
          <SupportText>2026년 평가 ‘외부기관연계’ 지표에서 의료기관 진료 내용을 기록하고 연계기록지를 제공했는지 확인합니다. 제공했다면 켜 두세요.</SupportText>
        </VStack>
        {touched && issues.length > 0 && (
          <VStack gap={1}>
            {issues.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          {editing && <Button label="고치기 취소" variant="ghost" isDisabled={saving} onClick={onCancel} />}
          <Button label={editing ? '고친 내용 저장' : '자원연계 저장'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
