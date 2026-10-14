'use client';

/**
 * 인지기능 평가 입력 — 2026 매뉴얼 위험도평가 세 기준 중 하나.
 * 도구(K-MMSE·CIST·외부기관·치매 진단)와 점수, 판정(정상·의심·인지저하)을 받는다.
 * K-MMSE는 점수를 넣으면 판정을 "제안"으로 미리 골라 주지만, 교육 수준·연령에 따라 달라질 수 있어 직원이 바꿀 수 있다.
 */
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import {
  COGNITIVE_INSTITUTION_MAX,
  COGNITIVE_JUDGMENTS,
  COGNITIVE_SCORE_MAX,
  COGNITIVE_TOOLS,
  cognitiveToolLabel,
  suggestCognitiveJudgment,
} from '@/lib/lab/riskScales';
import type { CognitiveJudgment, CognitiveTool } from '@/lib/lab/labTypes';
import { Chip, NumField, SupportText } from './LabUi';
import { RiskLevelChip } from './RiskParts';
import styles from './lab.module.css';

export interface CognitiveDraft {
  tool: CognitiveTool;
  score: number | null;
  /** 아직 고르지 않았으면 null */
  judgment: CognitiveJudgment | null;
  /** 직원이 판정을 직접 골랐으면 true — 점수를 바꿔도 덮어쓰지 않는다 */
  judgmentByStaff: boolean;
  institution: string;
}

export function emptyCognitive(): CognitiveDraft {
  return { tool: 'KMMSE', score: null, judgment: null, judgmentByStaff: false, institution: '' };
}

/** 도구·점수가 바뀔 때 판정 제안을 다시 계산한다(직원이 직접 고른 판정은 그대로 둔다). */
export function withToolOrScore(draft: CognitiveDraft, patch: Partial<Pick<CognitiveDraft, 'tool' | 'score'>>): CognitiveDraft {
  const next = { ...draft, ...patch };
  if (patch.tool !== undefined && patch.tool !== draft.tool) {
    // 도구가 바뀌면 이전 도구의 판정 선택은 더 이상 근거가 없다
    next.judgmentByStaff = false;
    next.judgment = null;
    if (!isScoreTool(patch.tool)) next.score = null;
  }
  if (!next.judgmentByStaff) next.judgment = suggestCognitiveJudgment(next.tool, next.score);
  return next;
}

export function isScoreTool(tool: CognitiveTool): boolean {
  return tool === 'KMMSE' || tool === 'CIST';
}

/** scoreAssessment에 그대로 넘길 값 — 아직 고르지 않은 판정은 빼서 검사가 안내 문구를 내게 한다. */
export function cognitiveRaw(draft: CognitiveDraft): Record<string, unknown> {
  const out: Record<string, unknown> = { tool: draft.tool };
  if (draft.score !== null) out.score = draft.score;
  if (draft.judgment !== null) out.judgment = draft.judgment;
  if (draft.institution.trim() !== '') out.institution = draft.institution;
  return out;
}

interface RiskCognitiveFieldsProps {
  value: CognitiveDraft;
  onChange: (next: CognitiveDraft) => void;
}

export default function RiskCognitiveFields({ value, onChange }: RiskCognitiveFieldsProps) {
  const info = COGNITIVE_TOOLS.find((t) => t.id === value.tool) ?? COGNITIVE_TOOLS[0];
  const suggested = suggestCognitiveJudgment(value.tool, value.score);
  const differsFromSuggestion = suggested !== null && value.judgment !== null && value.judgment !== suggested;

  return (
    <VStack gap={4}>
      <RadioList
        label="평가 도구"
        description="선별검사는 진단이 아닙니다. 기관 밖에서 받은 결과도 같은 칸에 기록합니다."
        value={value.tool}
        onChange={(v) => onChange(withToolOrScore(value, { tool: v as CognitiveTool }))}
        size="sm"
      >
        {COGNITIVE_TOOLS.map((t) => (
          <RadioListItem key={t.id} value={t.id} label={cognitiveToolLabel(t.id)} description={t.hint} />
        ))}
      </RadioList>

      <div className={styles.fieldGrid}>
        {isScoreTool(value.tool) && (
          <NumField
            label={`${value.tool === 'KMMSE' ? 'K-MMSE' : 'CIST'} 점수 (0~${COGNITIVE_SCORE_MAX})`}
            value={value.score}
            onChange={(score) => onChange(withToolOrScore(value, { score }))}
            max={COGNITIVE_SCORE_MAX}
            grouped={false}
            placeholder="예: 22"
          />
        )}
        {info.institutionRequired && (
          <TextInput
            label="검사 기관"
            description="보건소·치매안심센터·병원 이름"
            value={value.institution}
            onChange={(v) => onChange({ ...value, institution: v.slice(0, COGNITIVE_INSTITUTION_MAX) })}
            isRequired
          />
        )}
      </div>

      <VStack gap={1}>
        <RadioList
          label="판정"
          description="점수 기준으로 미리 골라 드립니다. 어르신의 교육 수준·연령·검사 환경을 보고 직원이 확정해 주세요."
          value={value.judgment ?? ''}
          onChange={(v) => onChange({ ...value, judgment: v as CognitiveJudgment, judgmentByStaff: true })}
          size="sm"
          isRequired
        >
          {COGNITIVE_JUDGMENTS.map((j) => (
            <RadioListItem key={j.id} value={j.id} label={j.label} description={j.hint} />
          ))}
        </RadioList>
        {suggested !== null && (
          <div className={styles.suggestBox}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Chip tone="info" label="기준 제안" />
              <RiskLevelChip level={suggested} />
              <SupportText>
                {value.tool === 'KMMSE' ? '24점 이상 정상, 18~23점 의심, 17점 이하 인지저하 기준입니다.' : '진단서·소견서로 확인된 경우의 기본 판정입니다.'}
                {differsFromSuggestion ? ' 직접 고르신 판정으로 저장됩니다.' : ''}
              </SupportText>
            </HStack>
          </div>
        )}
      </VStack>
    </VStack>
  );
}
