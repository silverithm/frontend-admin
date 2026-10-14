'use client';

/** 어르신 한 분의 위험도 평가 이력 — 오래된 오입력은 여기서 지울 수 있다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { deleteRiskAssessment, listRiskAssessments } from '@/lib/lab/labApi';
import { riskKindLabel } from '@/lib/lab/riskScales';
import type { RiskAssessment } from '@/lib/lab/labTypes';
import { AiChip, ErrorBanner, LabConfirm, useNotify } from './LabUi';
import { RiskLevelChip } from './RiskParts';
import { dotDate, errorText } from './labFormat';
import styles from './lab.module.css';

interface RiskHistoryPanelProps {
  elderId: number;
  /** 저장·삭제 뒤 바깥 목록을 새로 불러오게 한다 */
  refreshToken: number;
  onChanged: () => void;
}

export default function RiskHistoryPanel({ elderId, refreshToken, onChanged }: RiskHistoryPanelProps) {
  const notify = useNotify();
  const [items, setItems] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<RiskAssessment | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listRiskAssessments(elderId);
      if (n !== seq.current) return;
      setItems(list);
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '위험도 평가 이력을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [elderId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const remove = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await deleteRiskAssessment(target.id);
      setItems((prev) => prev.filter((i) => i.id !== target.id));
      setTarget(null);
      onChanged();
      notify('평가를 삭제했습니다', 'success');
    } catch (e) {
      setTarget(null);
      setError(errorText(e, '위험도 평가를 삭제하지 못했습니다'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <Loading size="inline" label="이력을 불러오는 중..." />;

  return (
    <VStack gap={2}>
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {items.length === 0 && !error ? (
        <EmptyState isCompact title="평가 이력이 없습니다" description="‘새 평가’에서 첫 평가를 남겨 보세요." />
      ) : (
        items.map((item) => (
          <div className={styles.suggestBox} key={item.id} style={{ borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
            <HStack hAlign="between" vAlign="start" gap={2} wrap="wrap">
              <VStack gap={1}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="body" weight="medium">
                    {riskKindLabel(item.kind)}
                  </Text>
                  <Text type="body" hasTabularNumbers>
                    {dotDate(item.assessedOn)} · {item.total}점
                  </Text>
                  <RiskLevelChip level={item.riskLevel} />
                  {item.aiAssisted && <AiChip label="AI 도움" />}
                </HStack>
                <Text type="supporting" color="secondary">
                  평가자 {item.assessorName}
                  {item.note ? ` · ${item.note}` : ''}
                </Text>
              </VStack>
              <Button label="삭제" size="sm" variant="ghost" onClick={() => setTarget(item)} />
            </HStack>
          </div>
        ))
      )}
      <LabConfirm
        isOpen={target !== null}
        title="이 평가를 삭제할까요?"
        description={target ? `${dotDate(target.assessedOn)} ${riskKindLabel(target.kind)} 평가(${target.total}점)가 지워지며 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={busy}
        onConfirm={() => void remove()}
        onClose={() => setTarget(null)}
      />
    </VStack>
  );
}
