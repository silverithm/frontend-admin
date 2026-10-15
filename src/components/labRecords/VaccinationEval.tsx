'use client';

/**
 * 평가 환산 — 평가 연도를 고르면 계약 전체와 전년도 인플루엔자 기록으로 접종률을 센다(evalVaccineRate).
 * 기준일·분모·분자·거부 제외를 한 줄씩 풀어 쓴다. 2026·2027 평가는 접종률과 관계없이 충족 처리다.
 */
import { useCallback, useMemo, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listElderContracts, listVaccinations } from '@/lib/lab/labApi';
import { VACCINE_AUTO_MET_UNTIL_YEAR, evalVaccineRate, vaccineBaseDate } from '@/lib/lab/vaccineRules';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate, todayString } from '@/components/lab/labFormat';
import { YearStepper } from './RecordsUi';
import { useRecordsLoader } from './useRecordsLoader';
import styles from './labRecords.module.css';
import own from './Vaccination.module.css';

function scoreText(score: number | null): string {
  return score === null ? '해당 없음' : `${score}점`;
}

export default function VaccinationEval({ reloadKey }: { reloadKey: number }) {
  const thisYear = Number(todayString().slice(0, 4));
  const [evalYear, setEvalYear] = useState(thisYear);
  // 저장·삭제 뒤 다시 읽도록 reloadKey를 load 함수에 묶는다
  const loadContracts = useCallback(async () => {
    void reloadKey;
    return listElderContracts();
  }, [reloadKey]);
  const loadRecords = useCallback(async () => {
    void reloadKey;
    return listVaccinations({ year: evalYear - 1 });
  }, [evalYear, reloadKey]);
  const contracts = useRecordsLoader(loadContracts, '계약 정보를 불러오지 못했습니다', []);
  const records = useRecordsLoader(loadRecords, `${evalYear - 1}년 접종 기록을 불러오지 못했습니다`, []);

  const loading = contracts.isLoading || records.isLoading;
  const error = contracts.error ?? records.error;
  const result = useMemo(() => evalVaccineRate(contracts.data, records.data, evalYear), [contracts.data, records.data, evalYear]);
  const base = vaccineBaseDate(evalYear);
  const refused = result.excluded;

  return (
    <Card padding={4}>
      <div className={styles.stack}>
        <div className={styles.toolbar}>
          <div className={styles.stackTight}>
            <Text type="large" weight="semibold">
              평가 환산 (수급자 인플루엔자 접종률)
            </Text>
            <Text type="supporting" color="secondary">
              평가 연도를 고르면 그 평가에서 보는 접종률을 지금 기록으로 미리 계산합니다
            </Text>
          </div>
          <div className={styles.spacer}>
            <YearStepper value={evalYear} onChange={setEvalYear} isDisabled={loading} max={thisYear + 2} />
          </div>
        </div>

        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => {
              void contracts.reload();
              void records.reload();
            }}
          />
        )}
        {loading && <Loading size="inline" label="평가 접종률을 계산하는 중..." />}

        {!loading && !error && (
          <>
            {result.autoMet && (
              <div className={own.noticeBox}>
                <Text type="supporting">
                  {VACCINE_AUTO_MET_UNTIL_YEAR}년까지의 평가는 접종률과 관계없이 충족으로 처리됩니다(평가시행세칙 대조 필요). 아래 값은 기록을 미리 쌓아 두었을 때의 참고용입니다.
                </Text>
              </div>
            )}
            <div className={own.summaryBox}>
              <div className={own.summaryItem}>
                <Text type="supporting" color="secondary">
                  접종률
                </Text>
                <Text type="large" weight="semibold" hasTabularNumbers>
                  {result.rate === null ? '-' : `${result.rate}%`}
                </Text>
              </div>
              <div className={own.summaryItem}>
                <Text type="supporting" color="secondary">
                  점수 (추정)
                </Text>
                <Text type="large" weight="semibold">
                  {scoreText(result.score)}
                </Text>
              </div>
              <div className={own.summaryItem}>
                <Text type="supporting" color="secondary">
                  판정
                </Text>
                {result.autoMet ? <Chip tone="ok" label="충족 처리" /> : <Chip tone="info" label="접종률로 판정" />}
              </div>
            </div>
            <ul className={own.explainList}>
              <li>기준일: {dotDate(base)} ({evalYear}년 평가는 평가 연도 2년 전 12월 31일을 기준으로 합니다).</li>
              <li>분모: 기준일에 계약을 유지하던 어르신 {result.eligible}명에서 거부·제외 {refused}명을 뺀 {result.denominator}명.</li>
              <li>분자: 그 어르신 중 {evalYear - 1}년에 인플루엔자 접종을 받은 {result.vaccinated}명.</li>
              <li>거부·제외: 접종 거부 기록이 있으면 분자·분모에서 뺍니다. 제외(건강 상태 등)가 어디까지 인정되는지는 확인하지 못했습니다(대조 필요).</li>
              <li>점수: 100% 1점, 90% 이상 0.75점, 80% 이상 0.5점이며 80% 미만은 매뉴얼에 점수가 없어 0점으로 두었습니다(대조 필요). 접종률은 소수 첫째 자리에서 반올림해 구간을 가릅니다.</li>
              <li>‘급여 유지’를 계약 유지로 보았습니다. 실제 이용 여부와 다를 수 있어 공단 자료와 대조해 주세요.</li>
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
