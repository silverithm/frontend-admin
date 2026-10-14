'use client';

/** 봉사 일지 입력 양식 — 날짜·봉사자·소속·시작/끝(분은 바로 보여 준다)·활동 종류·내용·VMS 등록·확인자. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { TimeField } from '@/components/labRecords/RecordsUi';
import { volunteerMinutes } from '@/lib/lab/communityRules';
import type { VolunteerActivityType } from '@/lib/lab/labTypes';
import { ACTIVITY_OPTIONS, MAX_CONFIRMER_NAME, MAX_VOLUNTEER_CONTENT, MAX_VOLUNTEER_NAME, MAX_VOLUNTEER_ORG, minutesText, volunteerIssues } from './CommunityVolunteerDraft';
import type { VolunteerDraft } from './CommunityVolunteerDraft';
import styles from './labPlans.module.css';

interface Props {
  draft: VolunteerDraft;
  onChange: (next: VolunteerDraft) => void;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function CommunityVolunteerForm({ draft, onChange, saving, error, onSave, onCancel }: Props) {
  const set = (patch: Partial<VolunteerDraft>) => onChange({ ...draft, ...patch });
  const today = todayString();
  const issues = volunteerIssues(draft, today);
  const editing = draft.id !== null;
  const minutes = volunteerMinutes(draft.start, draft.end);
  const touched = draft.name !== '';

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '봉사 일지 고치기' : '봉사 활동 적기'}</Text>
          {editing && <Chip tone="warn" label="수정 중" />}
        </HStack>
        <div className={styles.fieldGrid}>
          <LabDateInput label="활동 날짜" value={draft.date} max={today} onChange={(v) => set({ date: v })} />
          <TextInput label="봉사자 이름" value={draft.name} onChange={(v) => set({ name: v.slice(0, MAX_VOLUNTEER_NAME) })} isDisabled={saving} />
          <TextInput label="소속 (선택)" placeholder="예: ○○고등학교, 개인" value={draft.organization} onChange={(v) => set({ organization: v.slice(0, MAX_VOLUNTEER_ORG) })} isDisabled={saving} />
        </div>
        <div className={styles.fieldGrid}>
          <TimeField label="시작 시간" value={draft.start} onChange={(v) => set({ start: v })} />
          <TimeField label="끝 시간" value={draft.end} onChange={(v) => set({ end: v })} />
          <VStack gap={1}>
            <Text type="label">활동 시간</Text>
            <Text type="body" hasTabularNumbers>
              {minutes === null ? '-' : `${minutes}분 (${minutesText(minutes)})`}
            </Text>
          </VStack>
        </div>
        <div className={styles.fieldGrid}>
          <Selector label="활동 종류" options={ACTIVITY_OPTIONS} value={draft.activityType} onChange={(v) => v && set({ activityType: v as VolunteerActivityType })} isDisabled={saving} />
          <TextInput label="확인자 (기관 담당자)" value={draft.confirmer} onChange={(v) => set({ confirmer: v.slice(0, MAX_CONFIRMER_NAME) })} isDisabled={saving} />
        </div>
        <TextArea
          label="활동 내용 (선택)"
          placeholder="예: 점심 식사 배식과 정리, 노래 교실 보조"
          value={draft.content}
          onChange={(v) => set({ content: v.slice(0, MAX_VOLUNTEER_CONTENT) })}
          rows={3}
          maxLength={MAX_VOLUNTEER_CONTENT}
          isDisabled={saving}
        />
        <VStack gap={1}>
          <Switch label="VMS(1365)에 등록했습니다" value={draft.vmsRegistered} onChange={(v) => set({ vmsRegistered: v })} isDisabled={saving} />
          <SupportText>VMS는 활동일로부터 30일 안에 등록해야 합니다. 등록하면 켜 두세요. 30일이 지나도록 꺼져 있으면 목록에서 붉게 표시됩니다.</SupportText>
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
          <Button label={editing ? '고친 내용 저장' : '봉사 일지 저장'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
