'use client';

/**
 * 회의 메모 → AI로 회의록 정리. 위원 이름은 AI로 보내기 전에 ‘[위원]’으로 바뀐다.
 * 결과는 제안일 뿐 — 빈 칸에만 채우고 직접 쓴 칸은 건드리지 않는다.
 */
import { useRef, useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { errorText } from '@/components/lab/labFormat';
import { AiMemoBox } from '@/components/labRecords/RecordsUi';
import { useAlive, useLatest } from '@/components/labRecords/recordsFormat';
import { MAX_MEETING_AGENDA, MAX_MEETING_DECISION, MAX_MEETING_DECISIONS, MAX_MEETING_MINUTES } from '@/lib/lab/committeeRules';
import { aiDraftMeetingMinutes } from '@/lib/lab/labApi';
import type { CommitteeMember, MeetingMinutesAiResult } from '@/lib/lab/labTypes';
import { decisionRows } from './CommitteeDraft';
import type { MeetingDraft } from './CommitteeDraft';

interface Props {
  draft: MeetingDraft;
  members: CommitteeMember[];
  disabled: boolean;
  onChange: (patch: (d: MeetingDraft) => MeetingDraft) => void;
}

/** AI 제안을 빈 칸에만 채운 새 초안과, 채운 칸·직접 쓴 칸이라 그대로 둔 칸의 이름을 낸다 */
function applyMeetingAi(d: MeetingDraft, ai: MeetingMinutesAiResult): { next: MeetingDraft; filled: string[]; kept: string[] } {
  const filled: string[] = [];
  const kept: string[] = [];
  const next = { ...d };
  const agenda = ai.agenda.map((a) => a.trim()).filter((a) => a !== '').join('\n').slice(0, MAX_MEETING_AGENDA);
  if (agenda !== '') {
    if (d.agenda.trim() === '') {
      next.agenda = agenda;
      filled.push('안건');
    } else if (d.agenda.trim() !== agenda) kept.push('안건');
  }
  const minutes = ai.minutes.trim().slice(0, MAX_MEETING_MINUTES);
  if (minutes !== '') {
    if (d.minutes.trim() === '') {
      next.minutes = minutes;
      filled.push('회의록');
    } else if (d.minutes.trim() !== minutes) kept.push('회의록');
  }
  const decisions = ai.decisions.map((t) => t.trim().slice(0, MAX_MEETING_DECISION)).filter((t) => t !== '').slice(0, MAX_MEETING_DECISIONS);
  if (decisions.length > 0) {
    if (d.decisions.every((r) => r.text.trim() === '')) {
      next.decisions = decisionRows(decisions);
      filled.push('결정 사항');
    } else kept.push('결정 사항');
  }
  if (filled.length > 0) next.aiAssisted = true;
  return { next, filled, kept };
}

export default function CommitteeMeetingAi({ draft, members, disabled, onChange }: Props) {
  const alive = useAlive();
  const latest = useLatest(draft);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filled: string[]; kept: string[] } | null>(null);
  const busy = useRef(false);

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const ai = await aiDraftMeetingMinutes({ note: memo, kind: draft.kind }, members.map((m) => m.name));
      if (!alive.current) return;
      const applied = applyMeetingAi(latest.current, ai);
      onChange((d) => applyMeetingAi(d, ai).next);
      setResult({ filled: applied.filled, kept: applied.kept });
    } catch (err) {
      if (alive.current) setError(errorText(err, 'AI가 회의록을 정리하지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  return (
    <AiMemoBox
      label="회의 메모"
      description="회의 중 적은 메모를 그대로 붙여 넣으세요. 위원 이름은 AI로 보내기 전에 ‘[위원]’으로 바뀝니다."
      placeholder="예: 올해 후원금 사용 보고. 간식비 증액 논의, 다음 달부터 증액하기로 함. 안전점검 결과 공유."
      memo={memo}
      onMemoChange={setMemo}
      buttonLabel="AI로 회의록 정리"
      isLoading={loading}
      onRun={() => void run()}
      error={error}
      isDisabled={disabled}
      result={
        result && (
          <Text type="supporting" color="secondary">
            {result.filled.length > 0 ? `${result.filled.join('·')} 칸을 채웠습니다.` : '채울 빈 칸이 없었습니다.'}
            {result.kept.length > 0 ? ` 직접 쓴 ${result.kept.join('·')}은 그대로 두었습니다.` : ''} 회의에서 말하지 않은 내용이 들어갔는지 꼭 읽어 보세요. 위원 이름은 ‘[위원]’으로 나올 수 있어 실제 이름으로 고쳐 주세요.
          </Text>
        )
      }
    />
  );
}
