'use client';

/** 회의 쓰기 — 날짜, 참석자와 직종 확인, 메모 → AI 정리, 참석자별 의견, 대상 어르신(사유·계획·반영·평가), 회의록. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { AiChip, Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import type { LabElder } from '@/components/lab/useLabElders';
import { meetingRecordCheck } from '@/lib/lab/caseMeetingRules';
import type { LabStaff, StaffProfile } from '@/lib/lab/labTypes';
import CaseMeetingAi from './CaseMeetingAi';
import CaseMeetingAttendees from './CaseMeetingAttendees';
import { MAX_MINUTES, MAX_TARGETS, emptyTarget, meetingBlockers, recordShapeOf } from './CaseMeetingDraft';
import type { MeetingDraft, TargetDraft } from './CaseMeetingDraft';
import CaseMeetingOpinions from './CaseMeetingOpinions';
import { jobLookup, nameLookup, rolesOf } from './CaseMeetingRoles';
import CaseMeetingTargetCard from './CaseMeetingTargetCard';
import styles from './labPlans10.module.css';

interface Props {
  draft: MeetingDraft;
  onChange: (patch: (d: MeetingDraft) => MeetingDraft) => void;
  staff: LabStaff[];
  profiles: StaffProfile[];
  rosterLoading: boolean;
  rosterError: string | null;
  onRosterRetry: () => void;
  elders: LabElder[];
  eldersLoading: boolean;
  eldersError: string | null;
  today: string;
  writerName: string;
  dirty: boolean;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onPrint: () => void;
}

export default function CaseMeetingEditor(p: Props) {
  const { draft, onChange, staff, profiles, elders, today } = p;
  const editing = draft.id !== null;
  const busy = p.saving || p.deleting;
  const blockers = meetingBlockers(draft, today);
  const nameOf = nameLookup(staff, draft.names);
  const jobOf = jobLookup(profiles);
  const roles = rolesOf(draft.attendeeIds, nameOf, jobOf);
  const record = meetingRecordCheck(recordShapeOf(draft));

  const setTarget = (key: string, patch: Partial<TargetDraft>) =>
    onChange((d) => {
      const ai = { ...d.ai };
      if (d.targets[0]?.key === key) {
        if (patch.reason !== undefined) delete ai.reason;
        if (patch.plan !== undefined) delete ai.plan;
      }
      return { ...d, ai, targets: d.targets.map((t) => (t.key === key ? { ...t, ...patch } : t)) };
    });
  const removeTarget = (key: string) =>
    onChange((d) => {
      const ai = { ...d.ai };
      if (d.targets[0]?.key === key) {
        delete ai.reason;
        delete ai.plan;
      }
      return { ...d, ai, targets: d.targets.filter((t) => t.key !== key) };
    });

  const knownElders = new Set(elders.map((e) => e.id));
  const elderOptionsFor = (self: TargetDraft) => {
    const taken = new Set(draft.targets.filter((t) => t.key !== self.key && t.elderlyId !== null).map((t) => t.elderlyId));
    const list = elders.filter((e) => !taken.has(e.id)).map((e) => ({ value: String(e.id), label: e.name }));
    if (self.elderlyId !== null && !knownElders.has(self.elderlyId)) list.unshift({ value: String(self.elderlyId), label: self.elderlyName || `어르신 ${self.elderlyId}` });
    return list;
  };
  const ownerOptions = [{ value: 'none', label: '담당 미정' }, ...staff.map((s) => ({ value: String(s.id), label: s.name }))];
  const elderNames = elders.map((e) => e.name);

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '회의 기록 고치기' : '새 회의 기록'}</Text>
          {p.dirty && <Chip tone="warn" label="저장하지 않은 변경" />}
          {draft.aiAssisted && <AiChip label="AI 제안 반영" />}
        </HStack>

        <div className={styles.attendeeGrid}>
          <LabDateInput label="회의 날짜" value={draft.heldOn} max={today} onChange={(v) => onChange((d) => ({ ...d, heldOn: v }))} />
        </div>

        <CaseMeetingAttendees draft={draft} staff={staff} profiles={profiles} loading={p.rosterLoading} error={p.rosterError} isDisabled={busy} onRetry={p.onRosterRetry} onChange={onChange} />

        <CaseMeetingAi draft={draft} roles={roles} elderNames={elderNames} staffNames={staff.map((s) => s.name)} isDisabled={busy} onChange={onChange} />

        <CaseMeetingOpinions draft={draft} nameOf={nameOf} jobOf={jobOf} isDisabled={busy} onChange={onChange} />

        <VStack gap={3}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">대상 어르신 ({draft.targets.length}명)</Text>
            <Button label="대상 추가" variant="secondary" isDisabled={busy || draft.targets.length >= MAX_TARGETS} onClick={() => onChange((d) => ({ ...d, targets: [...d.targets, emptyTarget()] }))} />
          </HStack>
          {p.eldersError && <ErrorBanner message={p.eldersError} />}
          {draft.targets.map((t, i) => (
            <CaseMeetingTargetCard
              key={t.key}
              index={i}
              target={t}
              heldOn={draft.heldOn}
              today={today}
              elderOptions={elderOptionsFor(t)}
              ownerOptions={ownerOptions}
              eldersLoading={p.eldersLoading}
              defaultEvaluator={p.writerName}
              aiReason={i === 0 && !!draft.ai.reason}
              aiPlan={i === 0 && !!draft.ai.plan}
              canRemove={draft.targets.length > 1}
              isDisabled={busy}
              onChange={(patch) => setTarget(t.key, patch)}
              onRemove={() => removeTarget(t.key)}
            />
          ))}
        </VStack>

        <VStack gap={1}>
          {draft.ai.minutes && <AiChip />}
          <TextArea
            label="회의록 (선택)"
            description="논의한 내용을 적습니다. 서버에 암호화해 저장합니다."
            placeholder="예: 낙상 위험을 함께 논의하고 직종별로 맡을 일을 나눔"
            value={draft.minutes}
            onChange={(v) =>
              onChange((d) => {
                const ai = { ...d.ai };
                delete ai.minutes;
                return { ...d, ai, minutes: v.slice(0, MAX_MINUTES) };
              })
            }
            rows={6}
            maxLength={MAX_MINUTES}
            isDisabled={busy}
          />
        </VStack>

        {!record.ok && (
          <VStack gap={1}>
            <Text type="label">회의 기록에 빠진 칸</Text>
            {record.opinionsMissing.length > 0 && <SupportText tone="warn">의견 칸이 없는 참석자: {record.opinionsMissing.map(nameOf).join(', ')} (의견이 없었다면 ‘의견 없음’을 골라 주세요)</SupportText>}
            {record.targetsIncomplete > 0 && <SupportText tone="warn">선정 사유나 계획이 빈 대상이 {record.targetsIncomplete}명 있습니다.</SupportText>}
          </VStack>
        )}
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
        {p.error && <ErrorBanner message={p.error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          {editing && <Button label="회의록 인쇄" variant="secondary" isDisabled={busy || p.dirty} onClick={p.onPrint} />}
          {editing && <Button label="이 회의 삭제" variant="ghost" isLoading={p.deleting} isDisabled={busy} onClick={p.onDelete} />}
          <Button label={editing ? '고치기 취소' : '비우기'} variant="ghost" isDisabled={busy} onClick={p.onCancel} />
          <Button label={editing ? '고친 내용 저장' : '회의 저장'} variant="primary" isLoading={p.saving} isDisabled={busy || blockers.length > 0 || (editing && !p.dirty)} onClick={p.onSave} />
        </HStack>
        {editing && p.dirty && <SupportText>고친 내용을 저장한 뒤에 인쇄할 수 있습니다. AI 제안은 저장해야 남습니다.</SupportText>}
      </VStack>
    </Card>
  );
}
