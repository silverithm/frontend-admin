'use client';

/**
 * 직원 복지·권익 — 다섯 기준 요약, 복지(포상) 제공대장, 가산금 받음·사용, A4 인쇄.
 * 고충은 건수만 읽는다(내용·작성자는 가져오지 않는다).
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { todayString } from '@/components/lab/labFormat';
import type { BonusFund, StaffWelfare } from '@/lib/lab/labTypes';
import StaffWelfareEntryForm from './StaffWelfareEntryForm';
import StaffWelfareEntryList from './StaffWelfareEntryList';
import StaffWelfareFundForm from './StaffWelfareFundForm';
import StaffWelfareFundList from './StaffWelfareFundList';
import { useBonusFunds, useGrievance, usePayrollProfiles, usePolicyDocList, useStaffList, useWelfareEntries, yearsFrom } from './StaffWelfareLoad';
import { BonusFundNotes, WelfareLedgerNotes } from './StaffWelfareNotes';
import StaffWelfarePrint from './StaffWelfarePrint';
import StaffWelfareSummary from './StaffWelfareSummary';
import plans from './labPlans.module.css';

const SCOPE_OPTIONS = [
  { value: 'ALL', label: '연 전체' },
  { value: 'Q1', label: '1분기' },
  { value: 'Q2', label: '2분기' },
  { value: 'Q3', label: '3분기' },
  { value: 'Q4', label: '4분기' },
];

export default function StaffWelfareLab() {
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [scope, setScope] = useState('ALL');
  const [entryEdit, setEntryEdit] = useState<StaffWelfare | null>(null);
  const [entryKey, setEntryKey] = useState(0);
  const [fundEdit, setFundEdit] = useState<BonusFund | null>(null);
  const [fundKey, setFundKey] = useState(0);
  const [printKey, setPrintKey] = useState(0);
  const entryBox = useRef<HTMLDivElement>(null);
  const fundBox = useRef<HTMLDivElement>(null);
  const entries = useWelfareEntries(thisYear);
  const funds = useBonusFunds(thisYear);
  const grievance = useGrievance(year);
  const profiles = usePayrollProfiles();
  const docs = usePolicyDocList();
  const staff = useStaffList();
  const docsSource = docs;
  const retryAll = () => {
    void entries.reload();
    void funds.reload();
    void grievance.reload();
    void profiles.reload();
    void docs.reload();
  };
  const openEntry = (e: StaffWelfare | null) => {
    setEntryEdit(e);
    setEntryKey((k) => k + 1);
    // 목록에서 고치기를 누르면 위의 입력 칸으로 올라가 보여 준다
    if (e) setTimeout(() => entryBox.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const openFund = (f: BonusFund | null) => {
    setFundEdit(f);
    setFundKey((k) => k + 1);
    if (f) setTimeout(() => fundBox.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const printable = !entries.loading && !entries.error;

  return (
    <div className={plans.stack}>
      <Card padding={4}>
        <VStack gap={2}>
          <Text type="label">직원 복지·권익</Text>
          <Text type="supporting" color="secondary">평가에서 직원 권익 향상은 5대 보험, 가산금 사용, 분기별 복지, 고충처리, 퇴직금 다섯 가지를 봅니다. 이 화면에서 복지 제공대장과 가산금 기록을 남기고 현황을 확인하세요.</Text>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <Selector label="연도" placeholder="연도 고르기" options={yearsFrom(thisYear).map((y) => ({ value: String(y), label: `${y}년` }))} value={String(year)} onChange={(v) => v && setYear(Number(v))} />
          </HStack>
        </VStack>
      </Card>

      <StaffWelfareSummary
        year={year}
        today={today}
        profiles={profiles}
        funds={funds}
        entries={entries}
        grievance={grievance}
        docs={docsSource}
        onRetry={retryAll}
      />

      <Card padding={4}>
        <VStack gap={3}>
          <Text type="label">복지(포상) 제공대장</Text>
          <WelfareLedgerNotes />
          <div ref={entryBox}>
          <StaffWelfareEntryForm
            key={`entry${entryKey}`}
            editing={entryEdit}
            staff={staff.data}
            staffLoading={staff.loading}
            staffError={staff.error}
            year={year}
            today={today}
            onChanged={entries.reload}
            onClear={() => openEntry(null)}
          />
          </div>
          <StaffWelfareEntryList year={year} all={entries.data} today={today} loading={entries.loading} error={entries.error} activeId={entryEdit?.id ?? null} isDisabled={false} onRetry={() => void entries.reload()} onOpen={openEntry} />
          <HStack gap={3} vAlign="end" wrap="wrap">
            <Selector label="인쇄 범위" placeholder="범위 고르기" options={SCOPE_OPTIONS} value={scope} onChange={(v) => v && setScope(v)} />
            <Button label="제공대장 인쇄" variant="secondary" isDisabled={!printable} onClick={() => setPrintKey((k) => k + 1)} />
          </HStack>
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={3}>
          <Text type="label">가산금 받음·사용</Text>
          <BonusFundNotes />
          <div ref={fundBox}>
          <StaffWelfareFundForm key={`fund${fundKey}`} editing={fundEdit} staff={staff.data} staffLoading={staff.loading} year={year} today={today} onChanged={funds.reload} onClear={() => openFund(null)} />
          </div>
          <StaffWelfareFundList year={year} all={funds.data} loading={funds.loading} error={funds.error} activeId={fundEdit?.id ?? null} isDisabled={false} onRetry={() => void funds.reload()} onOpen={openFund} />
        </VStack>
      </Card>

      <StaffWelfarePrint year={year} scope={scope === 'ALL' ? '' : scope} entries={printable ? entries.data : null} today={today} printKey={printKey} onReady={() => window.print()} />
    </div>
  );
}
