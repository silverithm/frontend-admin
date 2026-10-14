'use client';

/** 의견 → ‘AI로 의견 주제 묶기’. 이름은 보내기 전에 지워지고, 결과는 읽어 보는 제안일 뿐 저장되지 않는다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { aiSummarizeSurvey } from '@/lib/lab/labApi';
import type { SatisfactionKind, SurveySummaryAiResult } from '@/lib/lab/labTypes';
import { AiChip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from './recordsFormat';
import own from './Satisfaction.module.css';

export const MAX_AI_COMMENTS = 200;

interface Props {
  kind: SatisfactionKind;
  comments: string[];
  result: SurveySummaryAiResult | null;
  onResult: (result: SurveySummaryAiResult | null) => void;
}

export default function SatisfactionAiThemes({ kind, comments, result, onResult }: Props) {
  const alive = useAlive();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (loading || comments.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const out = await aiSummarizeSurvey({ kind, comments: comments.slice(0, MAX_AI_COMMENTS) });
      if (alive.current) onResult(out);
    } catch (e) {
      if (alive.current) setError(errorText(e, 'AI가 의견을 묶지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  return (
    <Card padding={4}>
      <div className={own.questionBlock} style={{ borderBottom: 0, padding: 0 }}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="large" weight="semibold">
            의견 주제 묶기
          </Text>
          <Text type="supporting" color="secondary">
            의견 {comments.length}건
          </Text>
        </HStack>
        <SupportText>비슷한 의견을 주제별로 묶어 줍니다. 어르신 이름은 지워서 보내고, 결과는 제안일 뿐 저장되지 않습니다. 원문과 맞는지 읽어 보세요.</SupportText>
        <div>
          <Button label="AI로 의견 주제 묶기" variant="secondary" isLoading={loading} isDisabled={loading || comments.length === 0} onClick={() => void run()} />
        </div>
        {comments.length === 0 && <SupportText>이 기간·종류에 의견이 적힌 응답이 없습니다.</SupportText>}
        {comments.length > MAX_AI_COMMENTS && <SupportText>의견이 많아 앞의 {MAX_AI_COMMENTS}건만 묶습니다.</SupportText>}
        {error && <ErrorBanner message={error} />}
        {result && !error && (
          <>
            <HStack gap={2} vAlign="center">
              <AiChip />
              <Button label="결과 지우기" variant="ghost" onClick={() => onResult(null)} />
            </HStack>
            {result.themes.length === 0 ? (
              <SupportText>묶을 만한 주제가 나오지 않았습니다.</SupportText>
            ) : (
              result.themes.map((t) => (
                <div key={t.theme} className={own.themeRow}>
                  <Text type="label">
                    {t.theme} · {t.count}건
                  </Text>
                  {t.example && (
                    <Text type="supporting" color="secondary">
                      예: {t.example}
                    </Text>
                  )}
                </div>
              ))
            )}
            {result.suggestions.length > 0 && (
              <>
                <Text type="label">개선 제안</Text>
                <ul className={own.suggestList}>
                  {result.suggestions.map((s) => (
                    <li key={s}>
                      <Text type="supporting">{s}</Text>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
