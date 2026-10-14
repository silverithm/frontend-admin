'use client';

/**
 * 평가 지표의 자동 근거 — 케어브이에 이미 쌓인 기록으로 지표가 얼마나 채워졌는지 센다.
 * 지표 칸을 열었을 때만 불러온다(기록 조회가 여러 번 나가므로 목록을 열자마자 돌리지 않는다).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { listCareDeliveries, listCareRecordsByDate, listRiskLatest } from '@/lib/lab/labApi';
import { summarizeQuality } from '@/lib/lab/careRecordQuality';
import { EVAL_AUTO_SOURCE_LABEL } from '@/lib/lab/evalIndicators';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import { currentHalfLabel, halfYearStatus } from '@/lib/lab/riskScales';
import { ErrorBanner } from './LabUi';
import { careFieldsOf, currentMonth, errorText, monthLabel, recentDates, todayString } from './labFormat';
import { fetchLabElders } from './useLabElders';
import styles from './lab.module.css';

interface Evidence {
  lines: string[];
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

async function collect(source: EvalAutoSource): Promise<Evidence> {
  const asOf = todayString();
  if (source === 'RISK_HALF_YEAR') {
    const latest = await listRiskLatest();
    const today = new Date();
    const braden = latest.filter((l) => halfYearStatus(l.braden?.assessedOn, today) === 'DONE').length;
    const morse = latest.filter((l) => halfYearStatus(l.morse?.assessedOn, today) === 'DONE').length;
    const both = latest.filter((l) => halfYearStatus(l.braden?.assessedOn, today) === 'DONE' && halfYearStatus(l.morse?.assessedOn, today) === 'DONE').length;
    return {
      lines: [
        `${currentHalfLabel(today)} 욕창·낙상 평가를 모두 마친 어르신: ${both}/${latest.length}명 (${pct(both, latest.length)}%)`,
        `욕창(Braden) ${braden}/${latest.length}명 · 낙상(Morse) ${morse}/${latest.length}명 (${asOf} 기준)`,
      ],
    };
  }
  if (source === 'CARE_RECORD_DELIVERY') {
    const month = currentMonth();
    const [deliveries, elders] = await Promise.all([listCareDeliveries(month), fetchLabElders()]);
    const delivered = new Set(deliveries.map((d) => d.elderlyId)).size;
    return {
      lines: [`${monthLabel(month)} 급여제공기록 제공대장: ${delivered}/${elders.length}명 제공 기록 있음 (${pct(delivered, elders.length)}%, ${asOf} 기준)`],
    };
  }
  const dates = recentDates(7);
  const days = await Promise.all(dates.map((d) => listCareRecordsByDate(d)));
  const records = days.flat();
  const summary = summarizeQuality(
    records.map(careFieldsOf),
  );
  if (summary.total === 0) return { lines: [`최근 7일(${dates[0]} ~ ${dates[dates.length - 1]}) 저장된 급여제공기록이 없습니다`] };
  return {
    lines: [
      `최근 7일 급여제공기록 ${summary.total}건 중 형식적 문구가 있는 기록 ${summary.vague}건, 빈 기록 ${summary.empty}건`,
      `형식적 문구가 없는 기록 비율: ${summary.goodPercent === null ? '-' : `${summary.goodPercent}%`} (${asOf} 기준)`,
    ],
  };
}

interface EvalAutoEvidenceProps {
  source: EvalAutoSource;
  /** 근거 글에 이 내용을 넣는다 */
  onUse: (text: string) => void;
}

export default function EvalAutoEvidence({ source, onUse }: EvalAutoEvidenceProps) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await collect(source);
      if (n !== seq.current) return;
      setEvidence(result);
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '자동 근거를 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  return (
    <div className={styles.suggestBox}>
      <VStack gap={2}>
        <Text type="label">자동 근거 · {EVAL_AUTO_SOURCE_LABEL[source]}</Text>
        {loading ? (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" aria-label="자동 근거를 세는 중" />
            <Text type="supporting" color="secondary">
              케어브이 기록을 세는 중...
            </Text>
          </HStack>
        ) : error ? (
          <ErrorBanner message={error} onRetry={() => void load()} />
        ) : (
          evidence && (
            <>
              <VStack gap={1}>
                {evidence.lines.map((line) => (
                  <Text key={line} type="body">
                    {line}
                  </Text>
                ))}
              </VStack>
              <div>
                <Button label="근거 글에 넣기" size="sm" variant="secondary" onClick={() => onUse(evidence.lines.join('\n'))} />
              </div>
            </>
          )
        )}
      </VStack>
    </div>
  );
}
