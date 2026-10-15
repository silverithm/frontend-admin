'use client';

/**
 * 욕구사정 칸 — 2026 매뉴얼 안내, 면담 메모로 AI 정리, 열 칸과 기피식품·기타 요구, 빠진 칸 표시.
 * AI 결과는 빈 칸(또는 이전 AI 제안 칸)에만 'AI 제안'으로 채우고, 직접 쓴 칸은 덮지 않는다.
 * 메모는 저장하지 않고, 어르신·작성자 이름은 지워서 보낸다.
 */
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { TextArea } from '@astryxdesign/core/TextArea';
import { aiNeedsAssessment } from '@/lib/lab/labApi';
import { NEEDS_ITEMS, needsComplete } from '@/lib/lab/needsRules';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { NEEDS_KEYS, NEEDS_LABEL, NEEDS_MAX, NEEDS_MEMO_MAX, mergeNeedsAi } from './ConsultationCarePlanPlanDraft';
import type { NeedsKey, PlanDraft } from './ConsultationCarePlanPlanDraft';
import { AiMemoBox } from './RecordsUi';
import { useAlive, useLatest } from './recordsFormat';
import own from './ConsultationCarePlanChange.module.css';

interface Props {
  draft: PlanDraft;
  setDraft: Dispatch<SetStateAction<PlanDraft>>;
  elderName: string;
  isDisabled?: boolean;
}

export default function ConsultationCarePlanNeedsSection({ draft, setDraft, elderName, isDisabled }: Props) {
  const alive = useAlive();
  const latest = useLatest(draft);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filled: number; kept: number } | null>(null);

  const check = needsComplete(draft.needs);
  const missingLabels = [...check.missing.map((k) => NEEDS_LABEL[k]), ...(check.avoidFoodsRecorded ? [] : [NEEDS_LABEL.avoidFoods])];

  const setNeed = (key: NeedsKey, value: string) =>
    setDraft((d) => {
      const marks = { ...d.needsAi };
      if (key !== 'other') delete marks[key];
      return { ...d, needs: { ...d.needs, [key]: value.slice(0, NEEDS_MAX) }, needsAi: marks };
    });

  const run = async () => {
    if (loading || memo.trim() === '') return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await aiNeedsAssessment({ note: memo.trim() }, { elderNames: [elderName], staffNames: [draft.writer] });
      if (!alive.current) return;
      // 응답이 도착한 시점의 최신 입력과 합친다(기다리는 동안 직접 쓴 칸을 덮지 않으려고)
      const m = mergeNeedsAi(latest.current, r.needs);
      setDraft(m.draft);
      setResult({ filled: m.filled, kept: m.kept });
    } catch (e) {
      if (alive.current) setError(errorText(e, 'AI가 면담 메모를 정리하지 못했습니다. 잠시 뒤 다시 눌러 주세요'));
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  return (
    <VStack gap={3}>
      <details className={own.guide}>
        <summary>욕구사정 작성 기준 (2026 평가 매뉴얼)</summary>
        <p>체크리스트나 한 단어(예: ‘양호’)만 적으면 인정되지 않습니다. 기능·상태를 보고 판단한 근거를 문장으로 서술해 주세요.</p>
        <p>구강상태와 기피식품은 2026년 1월부터 평가에서 봅니다. 기피식품이 없으면 ‘없음’이라고 적어 기록으로 남깁니다.</p>
        <p>욕구사정은 연 1회 이상 하고, 신규 수급자는 급여제공 시작일까지 마쳐야 합니다.</p>
        <p>기피식품은 식사 유의사항에도 함께 남겨 주세요.</p>
      </details>

      <AiMemoBox
        label="면담 메모 (선택)"
        description={`면담에서 들은 내용을 편하게 적으세요. 최대 ${NEEDS_MEMO_MAX.toLocaleString('ko-KR')}자. 메모에 없는 칸은 비워 두고, 지어내지 않습니다.`}
        placeholder="예: 보행기를 쓰고 계단은 혼자 오르기 어려워하심. 틀니가 맞지 않아 단단한 음식은 피하심. 오이를 싫어하심."
        memo={memo}
        onMemoChange={(v) => setMemo(v.slice(0, NEEDS_MEMO_MAX))}
        buttonLabel="면담 메모로 AI 정리"
        isLoading={loading}
        onRun={() => void run()}
        error={error}
        maxLength={NEEDS_MEMO_MAX}
        isDisabled={isDisabled}
        result={
          result && (
            <SupportText>
              {result.filled > 0 ? `${result.filled}칸에 AI 제안을 채웠습니다.` : 'AI가 새로 채운 칸이 없습니다. 메모에 근거가 없으면 비워 둡니다.'}
              {result.kept > 0 ? ` 직접 쓰신 ${result.kept}칸은 그대로 두었습니다.` : ''}
            </SupportText>
          )
        }
      />

      <VStack gap={1}>
        {missingLabels.length === 0 ? (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Chip tone="ok" label="열 칸과 기피식품이 모두 채워졌습니다" />
          </HStack>
        ) : (
          <>
            <SupportText tone="warn">
              빠진 칸 {missingLabels.length}개 — 채우지 않아도 저장은 되지만 평가에서는 빈 칸으로 봅니다.
            </SupportText>
            <HStack gap={1} wrap="wrap">
              {missingLabels.map((l) => (
                <Chip key={l} tone="warn" label={l} />
              ))}
            </HStack>
          </>
        )}
      </VStack>

      <div className={own.needsGrid}>
        {NEEDS_KEYS.map((k) => {
          const isSummary = k === 'summary';
          const base = NEEDS_LABEL[k] + (k === 'other' ? ' (선택)' : '');
          const ai = k !== 'other' && draft.needsAi[k] ? ' · AI 제안' : '';
          return (
            <TextArea
              key={k}
              label={`${base}${ai}`}
              description={
                isSummary ? '위 항목을 종합한 소견을 서술해 주세요' : k === 'avoidFoods' ? '싫어하거나 피해야 하는 식품과 이유. 없으면 ‘없음’' : k === 'other' ? '위 칸에 담기지 않는 요구(옛 기록의 ‘기타 요구’)' : undefined
              }
              placeholder={k === 'avoidFoods' ? '예: 오이(알레르기), 질긴 고기(틀니)' : k === 'other' ? '' : '기능·상태를 보고 판단한 근거를 적어 주세요'}
              value={draft.needs[k]}
              onChange={(v) => setNeed(k, v)}
              rows={isSummary ? 4 : 3}
              maxLength={NEEDS_MAX}
              isDisabled={isDisabled}
            />
          );
        })}
      </div>
      <SupportText>열 칸은 {NEEDS_ITEMS.map((i) => i.label).join('·')} 순서입니다.</SupportText>
    </VStack>
  );
}
