'use client';

/**
 * 최근 14일 추이 — 기록한 날을 한 줄씩 보여 주고, 판정에 걸린 칸은 색으로 짚는다. "AI 간호 요약"은 날짜와 숫자만 보낸다.
 * 체중은 그날 기준 30일 안의 가장 가까운 이전 값과 비교한다(기록이 주 2~3회여도 비교가 되도록).
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { aiSummarizeNursing } from '@/lib/lab/labApi';
import type { NursingLog, NursingSummaryResult, VitalFlagMetric, VitalReading, VitalSeriesEntry } from '@/lib/lab/labTypes';
import { VITAL_METRIC_LABEL, closestPreviousWeight, evaluateVitals, worstVitalLevel } from '@/lib/lab/vitalFlags';
import type { VitalFlag } from '@/lib/lab/vitalFlags';
import { AiChip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { dateLabel, errorText, recentDates } from '@/components/lab/labFormat';
import { readingFromLog } from './NursingLogDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

const DAYS = 14;
const MED_MARK: Record<string, string> = { GIVEN: '○', SKIPPED: '×', NA: '-' };

interface DayRow {
  date: string;
  reading: VitalReading;
  meds: string;
  flags: VitalFlag[];
}

function hasValue(r: VitalReading): boolean {
  return Object.values(r).some((v) => typeof v === 'number');
}

const flagClass = (flags: VitalFlag[], metric: VitalFlagMetric): string | undefined => {
  const f = flags.find((x) => x.metric === metric);
  if (!f) return undefined;
  return f.level === 'WATCH' ? styles.warnText : styles.dangerText;
};

const show = (v: number | null | undefined, suffix = '') => (typeof v === 'number' ? `${v}${suffix}` : '-');

interface TrendProps {
  logs: NursingLog[];
  /** 기준일(지금 입력 중인 날) */
  date: string;
  /** 입력 중인 값(범위 안의 값만). 저장 전이어도 추이에 반영한다 */
  draftReading: VitalReading;
  draftMeds: string;
  draftTreatment: string;
  isLoading: boolean;
  /** 요약을 메모 칸에 넣는다(이미 쓴 메모 뒤에 덧붙인다) */
  onInsertSummary: (text: string) => void;
}

export default function NursingLogTrend({ logs, date, draftReading, draftMeds, draftTreatment, isLoading, onInsertSummary }: TrendProps) {
  const alive = useAlive();
  const seq = useRef(0);
  const [sendTreatment, setSendTreatment] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [summary, setSummary] = useState<NursingSummaryResult | null>(null);
  const [inserted, setInserted] = useState(false);

  const rows = useMemo<DayRow[]>(() => {
    const byDate = new Map(logs.map((l) => [l.logDate.slice(0, 10), l]));
    const out: DayRow[] = [];
    for (const d of recentDates(DAYS, date)) {
      const saved = byDate.get(d);
      const reading = d === date ? draftReading : saved ? readingFromLog(saved) : {};
      const meds = d === date ? draftMeds : saved ? [saved.medMorning, saved.medLunch, saved.medEvening].map((m) => (m ? MED_MARK[m] : '·')).join(' ') : '';
      if (!hasValue(reading) && !meds.replace(/[ ·]/g, '')) continue;
      const earlier = logs.filter((l) => l.logDate.slice(0, 10) < d);
      const previous = closestPreviousWeight(earlier, d) ?? undefined;
      out.push({ date: d, reading, meds, flags: evaluateVitals(reading, previous, d) });
    }
    return out;
  }, [logs, date, draftReading, draftMeds]);

  const strip = useMemo(() => {
    const byDate = new Map(rows.map((r) => [r.date, r]));
    return recentDates(DAYS, date).map((d) => {
      const row = byDate.get(d);
      const worst = row ? worstVitalLevel(row.flags) : null;
      const cls = !row ? '' : worst === null ? styles.stripOk : worst === 'WATCH' ? styles.stripWatch : styles.stripDanger;
      return { date: d, cls, title: `${dateLabel(d)} ${row ? (worst ? '확인 필요' : '정상 범위') : '기록 없음'}` };
    });
  }, [rows, date]);

  const runSummary = async () => {
    const readings: VitalSeriesEntry[] = rows.filter((r) => hasValue(r.reading)).map((r) => ({ date: r.date, ...r.reading }));
    if (readings.length === 0 || aiLoading) return;
    const n = ++seq.current;
    setAiLoading(true);
    setAiError(null);
    setInserted(false);
    try {
      const treatment = sendTreatment ? draftTreatment.trim().slice(0, 1500) : '';
      const result = await aiSummarizeNursing({ readings, ...(treatment ? { treatment } : {}) });
      if (!alive.current || n !== seq.current) return;
      setSummary(result);
    } catch (e) {
      if (alive.current && n === seq.current) setAiError(errorText(e, 'AI가 바이탈을 요약하지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      if (alive.current && n === seq.current) setAiLoading(false);
    }
  };

  const recordedDays = rows.filter((r) => hasValue(r.reading)).length;

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="label">최근 {DAYS}일 추이</Text>
          <Text type="supporting" color="secondary">
            {isLoading ? '지난 기록을 불러오는 중...' : `${DAYS}일 중 ${recordedDays}일 측정`}
          </Text>
        </HStack>

        <div className={styles.strip} role="img" aria-label={`최근 ${DAYS}일 측정 기록 띠. 초록은 정상 범위, 노랑은 관찰, 빨강은 확인 필요`}>
          {strip.map((s) => (
            <span key={s.date} className={`${styles.stripCell} ${s.cls}`} title={s.title} />
          ))}
        </div>

        {rows.length === 0 ? (
          <Text type="supporting" color="secondary">
            {isLoading ? ' ' : '최근 14일 안에 측정 기록이 없습니다. 위 칸에 오늘 값을 적으면 여기에 나타납니다.'}
          </Text>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">혈압</th>
                  <th scope="col">맥박</th>
                  <th scope="col">체온</th>
                  <th scope="col">혈당</th>
                  <th scope="col">체중</th>
                  <th scope="col">투약(아·점·저)</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.date}>
                    <td>{dateLabel(r.date)}{r.date === date ? ' · 입력 중' : ''}</td>
                    <td className={flagClass(r.flags, 'bloodPressure')}>{typeof r.reading.systolic === 'number' || typeof r.reading.diastolic === 'number' ? `${show(r.reading.systolic)}/${show(r.reading.diastolic)}` : '-'}</td>
                    <td className={flagClass(r.flags, 'pulse')}>{show(r.reading.pulse)}</td>
                    <td className={flagClass(r.flags, 'temperature')}>{show(r.reading.temperature, '℃')}</td>
                    <td className={flagClass(r.flags, 'bloodSugar')}>{show(r.reading.bloodSugar)}</td>
                    <td className={flagClass(r.flags, 'weight')}>{show(r.reading.weight, 'kg')}</td>
                    <td>{r.meds || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <SupportText>빨강은 높음·낮음, 노랑은 관찰 범위입니다. 진단이 아니라 눈여겨볼 값을 알려 주는 표시예요.</SupportText>

        <HStack gap={3} vAlign="center" wrap="wrap">
          <Button label="AI 간호 요약" variant="secondary" isLoading={aiLoading} isDisabled={aiLoading || recordedDays === 0} onClick={() => void runSummary()} />
          <CheckboxInput label="처치 메모도 함께 보내기" description="이름 없이 쓴 경우에만 켜 주세요" value={sendTreatment} onChange={setSendTreatment} isDisabled={aiLoading} />
        </HStack>
        <Text type="supporting" color="secondary">
          날짜와 측정 숫자만 AI로 보냅니다(어르신 이름은 보내지 않습니다).
        </Text>
        {aiError && <ErrorBanner message={aiError} />}
        {summary && !aiError && (
          <div className={styles.suggestBox}>
            <VStack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <AiChip />
                <Text type="supporting" color="secondary">
                  참고용 요약입니다. 읽어 보고 필요한 부분만 메모에 넣어 주세요.
                </Text>
              </HStack>
              <Text type="body">
                <span className={styles.pre}>{summary.summary || '요약할 만한 변화가 없습니다.'}</span>
              </Text>
              {summary.flags.map((f, i) => (
                <SupportText key={`${f.metric}-${i}`} tone="warn">
                  {f.metric in VITAL_METRIC_LABEL ? `${VITAL_METRIC_LABEL[f.metric as VitalFlagMetric]} — ` : ''}
                  {f.message}
                </SupportText>
              ))}
              {summary.summary.trim() !== '' && (
                <div>
                  <Button
                    label={inserted ? '메모에 넣었습니다' : '메모 칸에 넣기'}
                    variant="secondary"
                    isDisabled={inserted}
                    onClick={() => {
                      onInsertSummary(summary.summary.trim());
                      setInserted(true);
                    }}
                  />
                </div>
              )}
            </VStack>
          </div>
        )}
      </VStack>
    </Card>
  );
}
