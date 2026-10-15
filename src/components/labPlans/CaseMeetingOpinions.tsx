'use client';

/** 참석자별 의견 칸 — 말한 사람마다 한 칸, 의견이 없었으면 '의견 없음'을 골라 기록한다(빈 칸은 빠진 것으로 본다). */
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { AiChip, SupportText } from '@/components/lab/LabUi';
import { meetingRecordCheck } from '@/lib/lab/caseMeetingRules';
import { MAX_OPINION, recordShapeOf } from './CaseMeetingDraft';
import type { MeetingDraft } from './CaseMeetingDraft';
import styles from './labPlans10.module.css';

interface Props {
  draft: MeetingDraft;
  nameOf: (id: number) => string;
  jobOf: (id: number) => string | null;
  isDisabled: boolean;
  onChange: (patch: (d: MeetingDraft) => MeetingDraft) => void;
}

export default function CaseMeetingOpinions({ draft, nameOf, jobOf, isDisabled, onChange }: Props) {
  const missing = new Set(meetingRecordCheck(recordShapeOf(draft)).opinionsMissing);
  const setOpinion = (id: number, text: string, none: boolean) =>
    onChange((d) => {
      const ai = { ...d.ai };
      delete ai[`op:${id}`];
      return { ...d, ai, opinions: { ...d.opinions, [id]: { text: none ? '' : text.slice(0, MAX_OPINION), none } } };
    });

  if (draft.attendeeIds.length === 0) {
    return (
      <VStack gap={1}>
        <Text type="label">참석자별 의견</Text>
        <Text type="supporting" color="secondary">참석자를 고르면 사람마다 의견 칸이 생깁니다. 발언자 이름을 기록하도록 권고됩니다.</Text>
      </VStack>
    );
  }
  return (
    <VStack gap={2}>
      <Text type="label">참석자별 의견</Text>
      <SupportText>의견이 없었던 사람은 ‘의견 없음’을 골라 두세요. 칸을 비워 두면 회의록에서 빠진 것으로 봅니다.</SupportText>
      {draft.attendeeIds.map((id) => {
        const o = draft.opinions[id] ?? { text: '', none: false };
        return (
          <div key={id} className={styles.opinionRow}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text type="label">{nameOf(id)}</Text>
              <Text type="supporting" color="secondary">{jobOf(id) ?? '직종 미등록'}</Text>
              {draft.ai[`op:${id}`] && <AiChip />}
              {missing.has(id) && <Text type="supporting" color="secondary">의견 칸이 비어 있습니다</Text>}
            </HStack>
            <TextArea label={`${nameOf(id)} 의견`} isLabelHidden placeholder={`${nameOf(id)}님이 회의에서 말한 의견`} value={o.text} onChange={(v) => setOpinion(id, v, false)} rows={2} maxLength={MAX_OPINION} isDisabled={isDisabled || o.none} />
            <CheckboxInput label="의견 없음" value={o.none} onChange={(on) => setOpinion(id, '', on)} isDisabled={isDisabled} />
          </div>
        );
      })}
    </VStack>
  );
}
