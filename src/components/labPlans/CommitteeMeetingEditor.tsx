'use client';

/** 회의 편집기 — 날짜·정기/임시·참석 위원(체크 목록)·안건·회의록·결정 사항(줄 추가)·다음 회의일·작성자, 메모 → AI 정리. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { MAX_MEETING_AGENDA, MAX_MEETING_ATTENDEES, MAX_MEETING_DECISION, MAX_MEETING_DECISIONS, MAX_MEETING_MINUTES, committeeRoleLabel } from '@/lib/lab/committeeRules';
import type { CommitteeMeetingKind, CommitteeMember } from '@/lib/lab/labTypes';
import { meetingBlockers, newDecisionKey } from './CommitteeDraft';
import type { MeetingDraft } from './CommitteeDraft';
import CommitteeMeetingAi from './CommitteeMeetingAi';
import styles from './labPlans.module.css';
import eight from './labPlans8.module.css';

const KINDS: ReadonlyArray<{ value: CommitteeMeetingKind; label: string }> = [
  { value: 'REGULAR', label: '정기 회의' },
  { value: 'SPECIAL', label: '임시 회의' },
];

interface Props {
  draft: MeetingDraft;
  onChange: (patch: (d: MeetingDraft) => MeetingDraft) => void;
  members: CommitteeMember[];
  today: string;
  dirty: boolean;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onPrint: () => void;
}

export default function CommitteeMeetingEditor({ draft, onChange, members, today, dirty, saving, deleting, error, onSave, onCancel, onDelete, onPrint }: Props) {
  const set = (p: Partial<MeetingDraft>) => onChange((d) => ({ ...d, ...p }));
  const editing = draft.id !== null;
  const busy = saving || deleting;
  const blockers = meetingBlockers(draft);
  const running = new Set(members.filter((m) => m.active && m.termEnd >= today).map((m) => m.id));
  // 참석 후보: 활동 중인 위원 + 이미 참석으로 고른 위원(그만둔 위원도 지난 회의 기록에는 남는다)
  const candidates = members.filter((m) => running.has(m.id) || draft.attendeeIds.includes(m.id));
  const toggle = (id: number, on: boolean) => set({ attendeeIds: on ? [...draft.attendeeIds, id] : draft.attendeeIds.filter((x) => x !== id) });
  const setDecision = (key: string, text: string) => set({ decisions: draft.decisions.map((r) => (r.key === key ? { ...r, text: text.slice(0, MAX_MEETING_DECISION) } : r)) });

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '회의 기록 고치기' : '새 회의 기록'}</Text>
          {dirty && <Chip tone="warn" label="저장하지 않은 변경" />}
          {draft.aiAssisted && <Chip tone="info" label="AI 제안 반영" />}
        </HStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label="회의 날짜" value={draft.heldOn} onChange={(v) => set({ heldOn: v })} />
          <Selector label="회의 종류" placeholder="종류 고르기" options={KINDS as unknown as Array<{ value: string; label: string }>} value={draft.kind} onChange={(v) => v && set({ kind: v as CommitteeMeetingKind })} isDisabled={busy} />
          <TextInput label="작성자" value={draft.writerName} onChange={(v) => set({ writerName: v.slice(0, 50) })} placeholder="회의록을 쓴 직원" isDisabled={busy} />
        </div>

        <VStack gap={2}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">참석 위원 ({draft.attendeeIds.length}명)</Text>
            <Button label="활동 위원 모두 선택" variant="ghost" isDisabled={busy || candidates.length === 0} onClick={() => set({ attendeeIds: [...new Set([...draft.attendeeIds, ...[...running]])].slice(0, MAX_MEETING_ATTENDEES) })} />
            <Button label="선택 지우기" variant="ghost" isDisabled={busy || draft.attendeeIds.length === 0} onClick={() => set({ attendeeIds: [] })} />
          </HStack>
          {candidates.length === 0 ? (
            <SupportText tone="warn">고를 위원이 없습니다. ‘위원 명단’ 보기에서 위원을 먼저 등록해 주세요.</SupportText>
          ) : (
            <div className={eight.attendeeGrid}>
              {candidates.map((m) => (
                <CheckboxInput key={m.id} label={`${m.name} (${committeeRoleLabel(m.role)})`} value={draft.attendeeIds.includes(m.id)} onChange={(on) => toggle(m.id, on)} isDisabled={busy} />
              ))}
            </div>
          )}
        </VStack>

        <CommitteeMeetingAi draft={draft} members={members} disabled={busy} onChange={onChange} />

        <TextArea label="안건" description="한 줄에 안건 하나씩 적어 주세요." value={draft.agenda} onChange={(v) => set({ agenda: v.slice(0, MAX_MEETING_AGENDA) })} placeholder="예: 1. 상반기 후원금 사용 보고" rows={4} maxLength={MAX_MEETING_AGENDA} isDisabled={busy} />
        <TextArea label="회의록 (선택)" description="논의 내용을 적습니다. 서버에 암호화해 저장합니다." value={draft.minutes} onChange={(v) => set({ minutes: v.slice(0, MAX_MEETING_MINUTES) })} placeholder="예: 후원금 사용 내역을 보고하고 간식비 증액을 논의함" rows={8} maxLength={MAX_MEETING_MINUTES} isDisabled={busy} />

        <VStack gap={2}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">결정 사항 ({draft.decisions.filter((r) => r.text.trim() !== '').length}건)</Text>
            <Button label="줄 추가" variant="ghost" isDisabled={busy || draft.decisions.length >= MAX_MEETING_DECISIONS} onClick={() => set({ decisions: [...draft.decisions, { key: newDecisionKey(), text: '' }] })} />
          </HStack>
          {draft.decisions.length === 0 && <SupportText>결정한 것이 있으면 ‘줄 추가’로 한 줄씩 적어 주세요.</SupportText>}
          {draft.decisions.map((r, i) => (
            <div key={r.key} className={eight.decisionRow}>
              <TextInput label={`결정 사항 ${i + 1}`} isLabelHidden value={r.text} onChange={(v) => setDecision(r.key, v)} placeholder={`결정 사항 ${i + 1}`} isDisabled={busy} />
              <Button label="삭제" variant="ghost" isDisabled={busy} onClick={() => set({ decisions: draft.decisions.filter((x) => x.key !== r.key) })} />
            </div>
          ))}
        </VStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label="다음 회의일 (선택)" value={draft.nextOn} onChange={(v) => set({ nextOn: v })} />
        </div>

        {blockers.length > 0 && (
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
          {editing && <Button label="회의록 인쇄" variant="secondary" isDisabled={busy || dirty} onClick={onPrint} />}
          {editing && <Button label="이 회의 삭제" variant="ghost" isLoading={deleting} isDisabled={busy} onClick={onDelete} />}
          <Button label={editing ? '고치기 취소' : '비우기'} variant="ghost" isDisabled={busy} onClick={onCancel} />
          <Button label={editing ? '고친 내용 저장' : '회의 저장'} variant="primary" isLoading={saving} isDisabled={busy || blockers.length > 0 || (editing && !dirty)} onClick={onSave} />
        </HStack>
        {editing && dirty && <SupportText>고친 내용을 저장한 뒤에 인쇄할 수 있습니다.</SupportText>}
      </VStack>
    </Card>
  );
}
