'use client';

/** 상담 메모 → AI로 정리. 신청 어르신·문의한 분 이름은 AI로 보내기 전에 지운다. 결과는 빈 칸에만 채우고 직접 쓴 칸은 건드리지 않는다. */
import { useRef, useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { errorText } from '@/components/lab/labFormat';
import { AiMemoBox } from '@/components/labRecords/RecordsUi';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { aiStructureIntakeNote } from '@/lib/lab/labApi';
import { INTAKE_CARE_GRADES } from '@/lib/lab/intakeRules';
import type { IntakeNoteAiResult } from '@/lib/lab/labTypes';
import { MAX_DAYS, MAX_NEEDS } from './IntakeDraft';
import type { IntakeDraft } from './IntakeDraft';

interface Props {
  draft: IntakeDraft;
  disabled: boolean;
  onChange: (patch: (d: IntakeDraft) => IntakeDraft) => void;
}

export default function IntakeNoteAi({ draft, disabled, onChange }: Props) {
  const alive = useAlive();
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ai: IntakeNoteAiResult; kept: string[] } | null>(null);
  const busy = useRef(false);

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const ai = await aiStructureIntakeNote(memo, [draft.applicantName, draft.contactName]);
      if (!alive.current) return;
      const kept: string[] = [];
      onChange((d) => {
        const next = { ...d };
        let used = false;
        const needs = ai.needs.trim().slice(0, MAX_NEEDS);
        if (needs !== '') {
          if (d.needs.trim() === '') {
            next.needs = needs;
            used = true;
          } else if (d.needs.trim() !== needs) kept.push('욕구');
        }
        const days = ai.desiredDays.trim().slice(0, MAX_DAYS);
        if (days !== '') {
          if (d.desiredDays.trim() === '') {
            next.desiredDays = days;
            used = true;
          } else if (d.desiredDays.trim() !== days) kept.push('희망 요일');
        }
        if (ai.careGrade) {
          if (d.careGrade === '') {
            next.careGrade = ai.careGrade;
            used = true;
          } else if (d.careGrade !== ai.careGrade) kept.push('등급');
        }
        if (used) next.aiAssisted = true;
        return next;
      });
      setResult({ ai, kept });
    } catch (err) {
      if (alive.current) setError(errorText(err, 'AI가 상담 메모를 정리하지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  const gradeLabel = result?.ai.careGrade ? INTAKE_CARE_GRADES.find((g) => g.value === result.ai.careGrade)?.label : null;
  return (
    <AiMemoBox
      label="상담 메모 (선택)"
      description="통화·방문 때 들은 내용을 적으면 욕구·희망 요일·등급 칸을 정리해 줍니다. 신청 어르신과 문의한 분의 이름은 AI로 보내기 전에 지웁니다."
      placeholder="예: 주 3회 오전 이용을 원하심. 혼자 식사 준비가 어렵고 낮에 많이 외로워하심. 3등급 받으셨다고 함"
      memo={memo}
      onMemoChange={setMemo}
      buttonLabel="AI로 정리"
      isLoading={loading}
      onRun={() => void run()}
      error={error}
      isDisabled={disabled}
      maxLength={3000}
      result={
        result && (
          <>
            <Text type="supporting" color="secondary">
              한 줄 요약: {result.ai.summary || '(없음)'}
            </Text>
            <Text type="supporting" color="secondary">
              제안 — 욕구: {result.ai.needs || '-'} / 희망 요일: {result.ai.desiredDays || '-'} / 등급: {gradeLabel ?? '-'}
            </Text>
            {result.kept.length > 0 && (
              <Text type="supporting" color="secondary">
                이미 적어 둔 칸({result.kept.join('·')})은 그대로 두었습니다. 위 제안을 보고 직접 고쳐 주세요.
              </Text>
            )}
          </>
        )
      }
    />
  );
}
