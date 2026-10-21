'use client';

/**
 * 수급자 등급 현황·변동 리포트 — 케어포의 "수급자 등급 변동 현황"에 해당한다.
 * 진행 중인 수급자의 등급별 인원, 올해 일어난 등급 변동(앞뒤 계약의 등급이 다른 지점), 올해 끝난 계약 수.
 * 새로 입력하는 것은 없고 계약·인정에 적힌 값으로만 계산한다. A4 인쇄를 둔다.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listElderContracts } from '@/lib/lab/labApi';
import { gradeReport } from '@/lib/lab/contractRules';
import type { ElderContract } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { companyNameStored, dotDate, errorText, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from '@/components/labRecords/RecordsPrint';
import { useLatest } from '@/components/labRecords/recordsFormat';
import print from '@/components/labRecords/labRecords.module.css';
import styles from './labPlans.module.css';

const GRADE_LABEL: Record<string, string> = { '1': '1등급', '2': '2등급', '3': '3등급', '4': '4등급', '5': '5등급', cognitive: '인지지원등급' };
const DIRECTION_LABEL = { UP: '무거워짐', DOWN: '가벼워짐' } as const;

export default function ContractGradeReport({ contractsVersion }: { contractsVersion: number }) {
  const year = Number(todayString().slice(0, 4));
  const [contracts, setContracts] = useState<ElderContract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setContracts(await listElderContracts());
    } catch (e) {
      setError(errorText(e, '계약 목록을 불러오지 못했습니다'));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, contractsVersion]);

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;
  if (contracts === null) return <Loading size="inline" label="계약을 불러오는 중..." />;
  if (contracts.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="등록된 계약이 없습니다" description="계약·인정에서 수급자 계약을 등록하면 등급별 인원과 등급 변동이 여기에 모입니다." />
      </Card>
    );
  }
  const report = gradeReport(contracts, year);
  return (
    <VStack gap={4}>
      <Card padding={4}>
        <VStack gap={3}>
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <Text type="large" weight="semibold">
              {year}년 등급 현황 · 진행 중 {report.activeElders}명
            </Text>
            <Button label="리포트 인쇄" variant="secondary" onClick={() => setPrinting(true)} />
          </HStack>
          <HStack gap={2} wrap="wrap">
            {report.byGrade
              .filter((g) => g.count > 0)
              .map((g) => (
                <Chip key={g.grade} tone="info" label={`${g.label} ${g.count}명`} />
              ))}
            {report.activeElders === 0 && <Text type="supporting" color="secondary">진행 중인 계약이 없습니다.</Text>}
          </HStack>
          <SupportText>같은 수급자의 가장 최근 진행 중 계약 등급으로 셉니다. 올해 끝난 계약은 {report.endedInYear}건입니다.</SupportText>
        </VStack>
      </Card>
      <Card padding={4}>
        <VStack gap={2}>
          <Text type="large" weight="semibold">
            {year}년 등급 변동 {report.changes.length}건
          </Text>
          {report.changes.length === 0 ? (
            <Text type="supporting" color="secondary">
              올해 등급이 바뀐 수급자가 없습니다. 갱신하면서 등급이 달라진 계약은 계약·인정에 새 계약으로 등록해야 여기에 보입니다.
            </Text>
          ) : (
            report.changes.map((c) => (
              <HStack key={`${c.elderlyId}-${c.on}`} hAlign="between" vAlign="center" gap={2} wrap="wrap">
                <Text type="label">
                  {c.elderlyName}
                  <span className={print.mutedText}> · {dotDate(c.on)}부터</span>
                </Text>
                <HStack gap={2} vAlign="center">
                  <Chip tone="neutral" label={`${GRADE_LABEL[c.from]} → ${GRADE_LABEL[c.to]}`} />
                  {c.direction && <Chip tone={c.direction === 'UP' ? 'warn' : 'ok'} label={DIRECTION_LABEL[c.direction]} />}
                </HStack>
              </HStack>
            ))
          )}
        </VStack>
      </Card>
      {printing && <GradeReportSheet year={year} report={report} onDone={() => setPrinting(false)} />}
    </VStack>
  );
}

function GradeReportSheet({ year, report, onDone }: { year: number; report: ReturnType<typeof gradeReport>; onDone: () => void }) {
  const company = companyNameStored();
  const done = useLatest(onDone);
  useEffect(() => {
    const finish = () => done.current();
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [done]);
  return (
    <RecordsPrintPortal>
      <h1 className={print.printTitle}>{year}년 수급자 등급 현황·변동</h1>
      <div className={print.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>진행 중 {report.activeElders}명</span>
        <span>올해 끝난 계약 {report.endedInYear}건</span>
      </div>
      <div className={print.printSection}>등급별 인원</div>
      <table className={print.sheetTable}>
        <thead>
          <tr>
            <th scope="col">등급</th>
            <th scope="col">인원</th>
          </tr>
        </thead>
        <tbody>
          {report.byGrade.map((g) => (
            <tr key={g.grade}>
              <td>{g.label}</td>
              <td>{g.count}명</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={print.printSection}>등급 변동 ({report.changes.length}건)</div>
      <table className={print.sheetTable}>
        <thead>
          <tr>
            <th scope="col">수급자</th>
            <th scope="col">변경 전</th>
            <th scope="col">변경 후</th>
            <th scope="col">시작일</th>
          </tr>
        </thead>
        <tbody>
          {report.changes.map((c) => (
            <tr key={`${c.elderlyId}-${c.on}`}>
              <td>{c.elderlyName}</td>
              <td>{GRADE_LABEL[c.from]}</td>
              <td>{GRADE_LABEL[c.to]}</td>
              <td>{dotDate(c.on)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={print.printNote}>계약·인정에 적힌 값으로 계산한 참고 자료입니다. 공단 자료와 대조해 주세요. 출력일 {dotDate(todayString())}</p>
    </RecordsPrintPortal>
  );
}
