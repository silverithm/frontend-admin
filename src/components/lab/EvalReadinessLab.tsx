'use client';

/**
 * 평가 준비 — 장기요양기관 평가(재가·주야간보호) 지표별 준비 상태 점검표.
 * 지표 목록은 공개 매뉴얼을 요약한 것이라 번호·배점은 원문과 다르다. 실제 평가 전에는 원문과 대조해야 한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import { Loading } from '@/components/Loading';
import SectionHeader from '@/components/SectionHeader';
import { listEvalChecks } from '@/lib/lab/labApi';
import { EVAL_INDICATORS, EVAL_STATUS_LABEL, indicatorsByGroup, readinessSummary } from '@/lib/lab/evalIndicators';
import type { EvalCheck, EvalStatus } from '@/lib/lab/labTypes';
import EvalIndicatorPanel from './EvalIndicatorPanel';
import { Chip, ErrorBanner } from './LabUi';
import type { Tone } from './LabUi';
import { errorText } from './labFormat';
import styles from './lab.module.css';

const STATUS_TONE: Record<EvalStatus, Tone> = {
  READY: 'ok',
  PARTIAL: 'warn',
  MISSING: 'danger',
  NOT_APPLICABLE: 'neutral',
};

function Meter({ percent, label }: { percent: number; label: string }) {
  return (
    <div className={styles.meter} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className={styles.meterFill} style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function EvalReadinessLab() {
  const [checks, setChecks] = useState<EvalCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listEvalChecks();
      if (n !== seq.current) return;
      setChecks(list);
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '평가 준비 현황을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const byCode = useMemo(() => new Map(checks.map((c) => [c.indicatorCode, c])), [checks]);
  const summary = useMemo(() => readinessSummary(checks), [checks]);
  const groups = useMemo(() => indicatorsByGroup(), []);
  const deletedCount = useMemo(() => EVAL_INDICATORS.filter((i) => i.deletedIn2026).length, []);

  const handleSaved = (saved: EvalCheck) => setChecks((prev) => [...prev.filter((c) => c.indicatorCode !== saved.indicatorCode), saved]);

  if (loading && checks.length === 0 && !error) return <Loading size="section" label="평가 준비 현황을 불러오는 중..." />;

  return (
    <div className={styles.stack}>
      <Banner
        status="info"
        title="이 점검표는 공개 매뉴얼을 요약한 것입니다"
        description="지표 번호와 배점은 원문과 다릅니다. 실제 평가 전에는 매뉴얼 원문과 대조해 확인해 주세요. 준비 상태는 기관이 스스로 점검하는 용도이며 평가 결과를 예측하지 않습니다."
      />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <Card padding={4}>
        <VStack gap={3}>
          <div className={styles.rowHead}>
            <VStack gap={0.5}>
              <Text type="label">전체 준비 현황</Text>
              <Text type="display-3" weight="semibold" hasTabularNumbers>
                {summary.ready}/{summary.total}
                <Text type="body" color="secondary">
                  {' '}
                  지표 준비 완료 · {summary.percent}%
                </Text>
              </Text>
            </VStack>
            <Text type="supporting" color="secondary">
              일부 준비 {summary.partial} · 준비 안 됨 {summary.missing}
            </Text>
          </div>
          <Meter percent={summary.percent} label="전체 준비 완료 비율" />
          {deletedCount > 0 && (
            <Text type="supporting" color="secondary">
              2026판에서 삭제된 지표 {deletedCount}개는 준비율 계산에서 뺐습니다. 점검표에는 흐리게 남겨 두었어요.
            </Text>
          )}
          <div className={styles.groupGrid}>
            {groups.map((g) => {
              const applicable = g.indicators.filter((i) => !i.deletedIn2026 && byCode.get(i.code)?.status !== 'NOT_APPLICABLE');
              const ready = applicable.filter((i) => byCode.get(i.code)?.status === 'READY').length;
              const percent = applicable.length === 0 ? 0 : Math.round((ready / applicable.length) * 100);
              return (
                <VStack gap={1} key={g.id}>
                  <div className={styles.triggerLine}>
                    <Text type="supporting">{g.label}</Text>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      {ready}/{applicable.length}
                    </Text>
                  </div>
                  <Meter percent={percent} label={`${g.label} 준비 완료 비율`} />
                </VStack>
              );
            })}
          </div>
        </VStack>
      </Card>

      {groups.map((g) => (
        <VStack gap={2} key={g.id}>
          <SectionHeader title={g.label} count={g.indicators.length} level={4} />
          <Card padding={0}>
            {g.indicators.map((indicator, index) => {
              const check = byCode.get(indicator.code) ?? null;
              const isOpen = openCode === indicator.code;
              return (
                <div key={indicator.code} style={{ ...(index > 0 ? { borderTop: '1px solid var(--color-border)' } : {}), ...(indicator.deletedIn2026 ? { opacity: 0.6 } : {}) }}>
                  <Collapsible
                    isOpen={isOpen}
                    onOpenChange={(open) => setOpenCode(open ? indicator.code : null)}
                    trigger={
                      <div className={styles.triggerLine}>
                        <VStack gap={0.5}>
                          <Text type="body" weight="medium">
                            {indicator.title}
                          </Text>
                          <Text type="supporting" color="secondary">
                            {indicator.code}
                            {indicator.autoSource ? ' · 자동 근거 있음' : ''}
                            {indicator.deletedIn2026 ? ' · 준비율에서 뺌' : ''}
                          </Text>
                        </VStack>
                        {indicator.deletedIn2026 ? (
                          <Chip tone="neutral" label="2026판 삭제" />
                        ) : check ? (
                          <Chip tone={STATUS_TONE[check.status]} label={EVAL_STATUS_LABEL[check.status]} />
                        ) : (
                          <Chip tone="neutral" label="점검 전" />
                        )}
                      </div>
                    }
                  >
                    {/* 열었을 때만 그린다 — 자동 근거는 이때 처음 불러온다 */}
                    {isOpen && <EvalIndicatorPanel indicator={indicator} check={check} onSaved={handleSaved} />}
                  </Collapsible>
                </div>
              );
            })}
          </Card>
        </VStack>
      ))}

      <div>
        <Button label="새로 불러오기" variant="ghost" isDisabled={loading} onClick={() => void load()} />
      </div>
    </div>
  );
}
