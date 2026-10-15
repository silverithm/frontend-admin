'use client';

/**
 * 회의 메모 → AI로 정리. 참석자의 직종 이름만 roles로 보내고, 어르신·직원 이름은 메모에서 지운 뒤 보낸다.
 * 결과는 제안일 뿐이다 — 선정 사유·계획은 첫 대상 칸에, 회의록은 회의록 칸에 빈 칸만 채우고, 의견은 그 직종 참석자가 한 명일 때만 그 사람 칸에 넣는다.
 * 직종 참석자가 여럿이면 ‘직종 의견’으로 보여 주고 사람이 누구 칸에 넣을지 고른다. 저장은 사람이 한다.
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { AiChip, SupportText } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { AiMemoBox } from '@/components/labRecords/RecordsUi';
import { useAlive, useLatest } from '@/components/labRecords/recordsFormat';
import { aiCaseMeeting } from '@/lib/lab/labApi';
import { mergeCaseAi } from './CaseMeetingDraft';
import type { MeetingDraft } from './CaseMeetingDraft';
import type { Person } from './CaseMeetingRoles';
import styles from './labPlans10.module.css';

interface Props {
  draft: MeetingDraft;
  /** 직종 이름 → 그 직종 참석자 */
  roles: Map<string, Person[]>;
  elderNames: string[];
  staffNames: string[];
  isDisabled: boolean;
  onChange: (patch: (d: MeetingDraft) => MeetingDraft) => void;
}

interface RoleOpinion {
  role: string;
  opinion: string;
  people: Person[];
}

const FIELD_LABEL: Record<string, string> = { reason: '선정 사유', plan: '사례관리 계획', minutes: '회의록' };

export default function CaseMeetingAi({ draft, roles, elderNames, staffNames, isDisabled, onChange }: Props) {
  const alive = useAlive();
  const latest = useLatest(draft);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ filled: string[]; kept: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [shared, setShared] = useState<RoleOpinion[]>([]);
  const [giveNote, setGiveNote] = useState<string | null>(null);
  const busy = useRef(false);

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setDone(null);
    setWarning(null);
    setShared([]);
    setGiveNote(null);
    try {
      const roleNames = [...roles.keys()].slice(0, 10);
      const ai = await aiCaseMeeting({ note: memo, roles: roleNames }, { elderNames, staffNames });
      if (!alive.current) return;
      const suggestions: Record<string, string> = { reason: ai.reason, plan: ai.plan, minutes: ai.minutes };
      const many: RoleOpinion[] = [];
      const byRole = new Map<string, string[]>();
      for (const o of ai.opinions) {
        if (!roles.has(o.role) || o.opinion.trim() === '') continue;
        byRole.set(o.role, [...(byRole.get(o.role) ?? []), o.opinion.trim()]);
      }
      for (const [role, texts] of byRole) {
        const people = roles.get(role) ?? [];
        const text = texts.join('\n');
        if (people.length === 1) suggestions[`op:${people[0].id}`] = text;
        else if (people.length > 1) many.push({ role, opinion: text, people });
      }
      const applied = mergeCaseAi(latest.current, suggestions);
      onChange((d) => mergeCaseAi(d, suggestions).next);
      setDone({ filled: applied.filled, kept: applied.kept });
      setWarning(ai.warning && ai.warning.trim() !== '' ? ai.warning.trim() : null);
      setShared(many);
    } catch (err) {
      if (alive.current) setError(errorText(err, 'AI가 회의 메모를 정리하지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  const give = (item: RoleOpinion, person: Person) => {
    const key = `op:${person.id}`;
    const r = mergeCaseAi(latest.current, { [key]: item.opinion });
    if (r.filled.length === 0) {
      setGiveNote(`${person.name} 칸에 이미 직접 쓴 의견이 있어 바꾸지 않았습니다. 필요하면 위 내용을 직접 옮겨 적어 주세요.`);
      return;
    }
    setGiveNote(null);
    onChange((d) => mergeCaseAi(d, { [key]: item.opinion }).next);
    setShared((cur) => cur.filter((x) => x.role !== item.role));
  };

  const filledNames = (done?.filled ?? []).map((k) => (k.startsWith('op:') ? '참석자 의견' : FIELD_LABEL[k] ?? k));
  const filledText = [...new Set(filledNames)].join('·');

  return (
    <VStack gap={3}>
      <AiMemoBox
        label="회의 메모"
        description="회의 중 적은 메모를 붙여 넣으세요. 어르신·직원 이름은 AI로 보내기 전에 지웁니다. 참석자의 직종 이름만 함께 보냅니다."
        placeholder="예: 최근 낙상이 두 번 있었음. 간호 쪽은 혈압 확인을 늘리자고 했고 요양보호사는 화장실 이동 때 동행하겠다고 함. 30일 뒤 다시 보기로 함."
        memo={memo}
        onMemoChange={setMemo}
        buttonLabel="AI로 정리"
        isLoading={loading}
        onRun={() => void run()}
        error={error}
        isDisabled={isDisabled}
        result={
          done && (
            <Text type="supporting" color="secondary">
              {done.filled.length > 0 ? `${filledText} 칸에 제안을 채웠습니다.` : '채울 빈 칸이 없었습니다.'}
              {done.kept > 0 ? ` 직접 쓴 칸 ${done.kept}곳은 그대로 두었습니다.` : ''} 메모에 없는 내용이 들어갔는지 꼭 읽어 보세요. 의견은 그 직종 참석자가 한 명일 때만 그 사람 칸에 넣었습니다.
            </Text>
          )
        }
      />
      {roles.size === 0 && <SupportText tone="warn">참석자의 직종을 알 수 없어 의견은 제안되지 않습니다. 직원 인사에서 직종 등록을 해 주세요.</SupportText>}
      {warning && (
        <div className={styles.warningBox} role="alert">
          <HStack gap={2} vAlign="center" wrap="wrap">
            <AiChip />
            <Text type="label">사례관리 회의로 인정되지 않을 수 있습니다</Text>
          </HStack>
          <Text type="supporting">{warning}</Text>
          <Text type="supporting" color="secondary">단순 보고 회의, 1회성, 병원 입원 지원, 등급변경 신청, 요양시설 전원 의뢰, 단순 물품 구매는 인정되지 않는 예입니다. 기록하기 전에 확인해 주세요.</Text>
        </div>
      )}
      {shared.length > 0 && (
        <div className={styles.checkBox}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <AiChip />
            <Text type="label">직종 의견 — 누구 칸에 넣을지 골라 주세요</Text>
          </HStack>
          <SupportText>같은 직종의 참석자가 여러 명이라 AI가 누구 의견인지 알 수 없습니다. 실제로 말한 사람을 골라 그 칸에 넣어 주세요.</SupportText>
          {shared.map((item) => (
            <VStack key={item.role} gap={1}>
              <Text type="label">{item.role} 의견</Text>
              <div className={styles.printBlock}><Text type="supporting">{item.opinion}</Text></div>
              <HStack gap={2} wrap="wrap">
                {item.people.map((p) => (
                  <Button key={p.id} label={`${p.name} 칸에 넣기`} size="sm" variant="secondary" isDisabled={isDisabled || !draft.attendeeIds.includes(p.id)} onClick={() => give(item, p)} />
                ))}
                <Button label="넣지 않기" size="sm" variant="ghost" onClick={() => setShared((cur) => cur.filter((x) => x.role !== item.role))} />
              </HStack>
            </VStack>
          ))}
          {giveNote && <SupportText tone="warn">{giveNote}</SupportText>}
        </div>
      )}
    </VStack>
  );
}
