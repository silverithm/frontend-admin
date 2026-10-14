'use client';

/**
 * 평가 지표 하나의 점검 — 요건 확인, 자동 근거, 직접 쓴 근거, AI 검토, 상태 선택·저장.
 * AI 검토는 "제안"이다. 상태를 바꾸거나 저장하는 것은 항상 직원이다.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { aiReviewEvalEvidence, saveEvalCheck } from '@/lib/lab/labApi';
import { EVAL_STATUS_LABEL } from '@/lib/lab/evalIndicators';
import type { EvalIndicator } from '@/lib/lab/evalIndicators';
import type { EvalCheck, EvalReviewResult, EvalStatus } from '@/lib/lab/labTypes';
import EvalAutoEvidence from './EvalAutoEvidence';
import { AiChip, Chip, ErrorBanner, SupportText, useNotify } from './LabUi';
import { errorText } from './labFormat';
import styles from './lab.module.css';

const STATUS_CHOICES: ReadonlyArray<{ value: EvalStatus; label: string }> = [
  { value: 'READY', label: '준비됨' },
  { value: 'PARTIAL', label: '일부' },
  { value: 'MISSING', label: '없음' },
  { value: 'NOT_APPLICABLE', label: '해당 없음' },
];

interface EvalIndicatorPanelProps {
  indicator: EvalIndicator;
  check: EvalCheck | null;
  onSaved: (check: EvalCheck) => void;
}

export default function EvalIndicatorPanel({ indicator, check, onSaved }: EvalIndicatorPanelProps) {
  const notify = useNotify();
  const [status, setStatus] = useState<EvalStatus | null>(check?.status ?? null);
  const [evidence, setEvidence] = useState(check?.evidence ?? '');
  const [review, setReview] = useState<EvalReviewResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const runReview = async () => {
    const text = evidence.trim();
    if (text === '' || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiReviewEvalEvidence({
        indicatorCode: indicator.code,
        title: indicator.title,
        requirements: indicator.requirements,
        evidence: text,
      });
      if (alive.current) setReview(result);
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 증빙을 검토하지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const save = async () => {
    if (saving || status === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveEvalCheck(indicator.code, {
        status,
        evidence: evidence.trim() === '' ? null : evidence.trim(),
        aiComment: review?.comment ?? check?.aiComment ?? null,
      });
      onSaved(saved);
      notify('점검 내용을 저장했습니다', 'success');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '평가 준비 상태를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  // 저장한 적 없는 지표는 직원이 상태를 직접 고르기 전까지 어느 것도 선택되어 있지 않고, 저장도 막혀 있다
  const changed =
    status !== null &&
    (check === null ||
    status !== check.status ||
    (evidence.trim() || null) !== (check.evidence ?? null) ||
    (review !== null && review.comment !== (check.aiComment ?? '')));

  return (
    <div className={styles.itemBody}>
      <VStack gap={1}>
        <Text type="label">이 지표에서 확인하는 것</Text>
        <ul className={styles.reqList}>
          {indicator.requirements.map((req) => (
            <li key={req}>
              <Text type="body">{req}</Text>
            </li>
          ))}
        </ul>
      </VStack>

      {indicator.autoSource && (
        <EvalAutoEvidence
          source={indicator.autoSource}
          indicatorCode={indicator.code}
          onUse={(text) => setEvidence((prev) => (prev.trim() === '' ? text : `${prev.trim()}\n${text}`).slice(0, 3000))}
        />
      )}

      <TextArea
        label="근거"
        description="이 지표를 어떻게 준비했는지 적어 주세요. 문서 이름, 보관 위치, 최근 실시일 등."
        value={evidence}
        onChange={(v) => setEvidence(v.slice(0, 3000))}
        rows={5}
        maxLength={3000}
      />

      <HStack gap={3} vAlign="center" wrap="wrap">
        <Button label="AI 검토" variant="secondary" isLoading={aiLoading} isDisabled={aiLoading || evidence.trim() === ''} onClick={() => void runReview()} />
        <Text type="supporting" color="secondary">
          근거 글만 AI로 보냅니다. 검토는 제안이며 평가 결과를 보장하지 않습니다.
        </Text>
      </HStack>
      {aiError && <ErrorBanner message={aiError} />}

      {review && (
        <div className={styles.suggestBox}>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <AiChip />
              <Text type="body" weight="medium">
                제안 상태: {EVAL_STATUS_LABEL[review.suggestedStatus]}
              </Text>
              <Button label="이 상태로 선택" size="sm" variant="ghost" isDisabled={status === review.suggestedStatus} onClick={() => setStatus(review.suggestedStatus)} />
            </HStack>
            {review.missing.length > 0 && (
              <VStack gap={1}>
                <Text type="label">빠진 것</Text>
                <ul className={styles.reqList}>
                  {review.missing.map((m) => (
                    <li key={m}>
                      <Text type="body">{m}</Text>
                    </li>
                  ))}
                </ul>
              </VStack>
            )}
            {review.comment && <Text type="body">{review.comment}</Text>}
            <SupportText>AI 제안 — 확인 후 상태를 고르고 저장해 주세요.</SupportText>
          </VStack>
        </div>
      )}

      <VStack gap={2}>
        <SegmentedControl label="준비 상태" value={status ?? ''} onChange={(v) => setStatus(v as EvalStatus)} size="sm">
          {STATUS_CHOICES.map((s) => (
            <SegmentedControlItem key={s.value} value={s.value} label={s.label} />
          ))}
        </SegmentedControl>
        {saveError && <ErrorBanner message={saveError} />}
        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
          {check ? <Chip tone="neutral" label={`저장된 상태: ${EVAL_STATUS_LABEL[check.status]}`} /> : <Chip tone="neutral" label="아직 저장 전" />}
          <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || !changed} onClick={() => void save()} />
        </HStack>
      </VStack>
    </div>
  );
}
