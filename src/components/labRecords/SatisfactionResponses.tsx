'use client';

/** 기간 안 응답 목록 — 조사일·어르신(또는 익명)·응답한 분·평균·의견. 잘못 받은 응답은 삭제한다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { deleteSatisfaction } from '@/lib/lab/labApi';
import type { SatisfactionKind, SatisfactionResponse } from '@/lib/lab/labTypes';
import { SURVEY_QUESTIONS } from '@/lib/lab/satisfactionRules';
import { Chip, ErrorBanner, LabConfirm } from '@/components/lab/LabUi';
import { dotDate, errorText } from '@/components/lab/labFormat';
import { useAlive } from './recordsFormat';
import own from './Satisfaction.module.css';

function averageText(r: SatisfactionResponse, kind: SatisfactionKind): string {
  const values = SURVEY_QUESTIONS[kind].map((q) => r.scores[q.code]).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return '-';
  const sum = values.reduce((a, b) => a + b, 0);
  return (Math.floor((20 * sum + values.length) / (2 * values.length)) / 10).toFixed(1);
}

interface Props {
  kind: SatisfactionKind;
  responses: SatisfactionResponse[];
  onDeleted: (id: number) => void;
}

export default function SatisfactionResponses({ kind, responses, onDeleted }: Props) {
  const alive = useAlive();
  const [target, setTarget] = useState<SatisfactionResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!target || deleting) return;
    setDeleting(true);
    try {
      await deleteSatisfaction(target.id);
      const id = target.id;
      if (alive.current) setTarget(null);
      onDeleted(id);
    } catch (e) {
      if (alive.current) {
        setTarget(null);
        setError(errorText(e, '만족도 응답을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  if (responses.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="이 기간에 받은 응답이 없습니다" description="응답을 받으면 여기에 목록으로 쌓입니다." />
      </Card>
    );
  }
  return (
    <Card padding={0}>
      {error && <ErrorBanner message={error} />}
      {responses.map((r) => (
        <div key={r.id} className={own.responseRow}>
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <Text type="label">
              {dotDate(r.surveyDate)} · {r.elderlyName ?? '익명'} · {r.respondent === 'GUARDIAN' ? '보호자' : '본인'}
            </Text>
            <HStack gap={2} vAlign="center">
              <Chip tone="neutral" label={`평균 ${averageText(r, kind)}점`} />
              <Button label="삭제" variant="ghost" onClick={() => setTarget(r)} />
            </HStack>
          </HStack>
          {r.comment && (
            <div className={own.commentText}>
              <Text type="supporting">{r.comment}</Text>
            </div>
          )}
        </div>
      ))}
      <LabConfirm isOpen={target !== null} title="이 응답을 삭제할까요?" description="삭제하면 요약과 식사 반기 현황에서도 빠지며 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setTarget(null)} />
    </Card>
  );
}
