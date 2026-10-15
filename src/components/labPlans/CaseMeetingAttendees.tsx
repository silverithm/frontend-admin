'use client';

/** 참석자 고르기 — 고르는 즉시 attendeeCheck(직원 인사 기준 직종)로 빠진 직종·3인 미만·기준 없는 참석자를 알린다. */
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { CASE_GROUP_LABEL, CASE_MIN_ATTENDEES, attendeeCheck } from '@/lib/lab/caseMeetingRules';
import type { LabStaff, StaffProfile } from '@/lib/lab/labTypes';
import { MAX_ATTENDEES } from './CaseMeetingDraft';
import type { MeetingDraft } from './CaseMeetingDraft';
import { jobLookup } from './CaseMeetingRoles';
import styles from './labPlans10.module.css';

interface Props {
  draft: MeetingDraft;
  staff: LabStaff[];
  profiles: StaffProfile[];
  loading: boolean;
  error: string | null;
  isDisabled: boolean;
  onRetry: () => void;
  onChange: (patch: (d: MeetingDraft) => MeetingDraft) => void;
}

export default function CaseMeetingAttendees({ draft, staff, profiles, loading, error, isDisabled, onRetry, onChange }: Props) {
  const jobOf = jobLookup(profiles);
  const check = attendeeCheck(draft.attendeeIds, profiles, draft.heldOn);
  // 후보: 같은 기관 직원 + 저장된 회의에 있던 참석자(지금은 목록에 없는 직원 포함)
  const known = new Set(staff.map((s) => s.id));
  const extra = draft.attendeeIds.filter((id) => !known.has(id)).map((id) => ({ id, name: draft.names[id] ?? `직원 ${id}` }));
  const candidates = [...staff.map((s) => ({ id: s.id, name: s.name })), ...extra];
  const toggle = (id: number, on: boolean) =>
    onChange((d) => ({ ...d, attendeeIds: on ? (d.attendeeIds.includes(id) ? d.attendeeIds : [...d.attendeeIds, id]) : d.attendeeIds.filter((x) => x !== id) }));
  const tone = check.count === 0 ? 'neutral' : check.ok ? 'ok' : 'warn';

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text type="label">참석자 ({draft.attendeeIds.length}명)</Text>
        <Button label="선택 지우기" variant="ghost" isDisabled={isDisabled || draft.attendeeIds.length === 0} onClick={() => onChange((d) => ({ ...d, attendeeIds: [] }))} />
      </HStack>
      {error && <ErrorBanner message={error} onRetry={onRetry} />}
      {loading && candidates.length === 0 ? (
        <Loading size="section" label="직원 목록을 불러오는 중..." />
      ) : candidates.length === 0 && !error ? (
        <SupportText tone="warn">고를 직원이 없습니다. 직원을 먼저 등록해 주세요.</SupportText>
      ) : (
        <div className={styles.attendeeGrid}>
          {candidates.map((c) => {
            const job = jobOf(c.id);
            return (
              <CheckboxInput
                key={c.id}
                label={`${c.name} (${job ?? '직종 미등록'})`}
                value={draft.attendeeIds.includes(c.id)}
                onChange={(on) => toggle(c.id, on)}
                isDisabled={isDisabled || (!draft.attendeeIds.includes(c.id) && draft.attendeeIds.length >= MAX_ATTENDEES)}
              />
            );
          })}
        </div>
      )}
      <div className={styles.checkBox} data-tone={tone}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">참석 직종 확인</Text>
          {check.count > 0 && <Chip tone={check.ok ? 'ok' : 'warn'} label={check.ok ? '갖춤' : '보완 필요'} />}
        </HStack>
        {check.count === 0 ? (
          <Text type="supporting" color="secondary">참석자를 고르면 바로 직종과 인원을 확인합니다. 시설장은 꼭 참석해야 하고, 3인 이상이 직종별로 참석해야 합니다.</Text>
        ) : (
          <>
            <Text type="supporting" hasTabularNumbers>참석 {check.count}명 {check.count >= CASE_MIN_ATTENDEES ? '' : `— ${CASE_MIN_ATTENDEES}인 이상이어야 합니다`}</Text>
            {check.missing.length > 0 && (
              <SupportText tone="error">빠진 직종: {check.missing.map((g) => CASE_GROUP_LABEL[g]).join(', ')}</SupportText>
            )}
            {check.unknown > 0 && (
              <SupportText tone="warn">직원 인사 기준이 없는 참석자가 {check.unknown}명 있어 직종을 확인하지 못했습니다. 직원 인사에서 직종 등록을 한 뒤 다시 확인해 주세요.</SupportText>
            )}
            {check.ok && <Text type="supporting" color="secondary">3인 이상이 필요한 직종별로 참석했습니다.</Text>}
          </>
        )}
        {profiles.length === 0 && !loading && !error && <SupportText tone="warn">직원 인사에서 직종 등록이 아직 없습니다. 직종을 등록해야 참석 직종을 확인할 수 있습니다.</SupportText>}
        <SupportText>직종은 직원 인사 기준을 읽습니다. 회의일에 재직 중인 직원의 직종은 모두 필요한 것으로 보고, 시설장은 항상 필요합니다.</SupportText>
      </div>
    </VStack>
  );
}
