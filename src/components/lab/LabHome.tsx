'use client';

/**
 * 실험실 — 기관 업무를 AI와 함께 새로 만들어 보는 곳. 접근 권한이 있는 기관의 관리자에게만 탭이 보인다.
 * 도구가 늘어 묶음 여섯 개(기록, 운영, 소통·연계, 청구, 재무, 평가 대비)로 나눠 오간다. 마지막으로 쓴 도구는 이 브라우저에 기억해 다음에 바로 연다.
 * 상담일지와 욕구사정·급여계획은 같은 화면(ConsultationCarePlanLab)의 두 보기다. 메뉴 항목이 둘이고, 각자 그 보기로 바로 연다.
 */
import { useEffect, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Text } from '@astryxdesign/core/Text';
import PageHeader from '@/components/PageHeader';
import CareEventLab from '@/components/labRecords/CareEventLab';
import ConsultationCarePlanLab from '@/components/labRecords/ConsultationCarePlanLab';
import DonationLab from '@/components/labRecords/DonationLab';
import GuardianNoticeLab from '@/components/labRecords/GuardianNoticeLab';
import LedgerLab from '@/components/labRecords/LedgerLab';
import MealPlanLab from '@/components/labRecords/MealPlanLab';
import NursingLogLab from '@/components/labRecords/NursingLogLab';
import PayrollLab from '@/components/labRecords/PayrollLab';
import ProgramLogLab from '@/components/labRecords/ProgramLogLab';
import RehabLab from '@/components/labRecords/RehabLab';
import SafetyCheckLab from '@/components/labRecords/SafetyCheckLab';
import StaffTrainingLab from '@/components/labRecords/StaffTrainingLab';
import BudgetLab from '@/components/labPlans/BudgetLab';
import CommunityLab from '@/components/labPlans/CommunityLab';
import CareRecordLab from './CareRecordLab';
import CopayLab from './CopayLab';
import EvalReadinessLab from './EvalReadinessLab';
import RiskAssessmentLab from './RiskAssessmentLab';
import { readStored, writeStored } from './labFormat';
import styles from './lab.module.css';

type LabTool = 'care' | 'nursing' | 'program' | 'consult' | 'copay' | 'risk' | 'carePlan' | 'training' | 'eval' | 'meal' | 'safety' | 'payroll' | 'ledger' | 'donation' | 'careEvent' | 'rehab' | 'guardian' | 'community' | 'budget';

interface ToolGroup {
  id: string;
  label: string;
  tools: ReadonlyArray<{ id: LabTool; label: string }>;
}

const GROUPS: readonly ToolGroup[] = [
  {
    id: 'records',
    label: '기록',
    tools: [
      { id: 'care', label: '급여제공기록' },
      { id: 'nursing', label: '간호일지' },
      { id: 'program', label: '프로그램 일지' },
      { id: 'consult', label: '상담일지' },
      { id: 'careEvent', label: '상태변화·사고' },
      { id: 'rehab', label: '기능회복훈련' },
    ],
  },
  {
    id: 'operations',
    label: '운영',
    tools: [
      { id: 'meal', label: '주간 식단표' },
      { id: 'safety', label: '위생·안전 점검' },
    ],
  },
  {
    id: 'outreach',
    label: '소통·연계',
    tools: [
      { id: 'guardian', label: '보호자 안내' },
      { id: 'community', label: '봉사·자원연계' },
    ],
  },
  { id: 'billing', label: '청구', tools: [{ id: 'copay', label: '본인부담금' }] },
  {
    id: 'finance',
    label: '재무',
    tools: [
      { id: 'payroll', label: '급여대장' },
      { id: 'ledger', label: '회계 장부' },
      { id: 'donation', label: '후원금' },
      { id: 'budget', label: '예산·결산' },
    ],
  },
  {
    id: 'evaluation',
    label: '평가 대비',
    tools: [
      { id: 'risk', label: '위험도 평가' },
      { id: 'carePlan', label: '욕구사정·급여계획' },
      { id: 'training', label: '직원 교육·회의' },
      { id: 'eval', label: '평가 준비' },
    ],
  },
];

const TOOL_IDS: readonly string[] = GROUPS.flatMap((g) => g.tools.map((t) => t.id));

const TOOL_KEY = 'carev.lab.tool';

function isTool(value: string | null): value is LabTool {
  return value !== null && TOOL_IDS.includes(value);
}

export default function LabHome() {
  const [tool, setTool] = useState<LabTool>('care');

  // 저장된 값은 브라우저에서만 읽을 수 있으므로 첫 그림 뒤에 반영한다
  useEffect(() => {
    const stored = readStored(TOOL_KEY);
    if (isTool(stored)) setTool(stored);
  }, []);

  const choose = (value: LabTool) => {
    setTool(value);
    writeStored(TOOL_KEY, value);
  };

  return (
    <div className={styles.stack}>
      <PageHeader
        title="실험실"
        titleBadge={<Badge variant="blue" label="실험 중" />}
        description="기관 업무를 AI와 함께 새로 만들어 보는 곳입니다. 지금은 이 기관에만 열려 있어요."
      />

      <nav aria-label="실험실 도구" className={styles.toolGroups}>
        {GROUPS.map((group) => (
          <div key={group.id} role="group" aria-label={group.label} className={styles.toolGroup}>
            <span className={styles.toolGroupTitle}>
              <Text type="label" color="secondary">
                {group.label}
              </Text>
            </span>
            <div className={styles.toolChips}>
              {group.tools.map((t) => (
                <button key={t.id} type="button" className={styles.toolChip} aria-pressed={tool === t.id} onClick={() => choose(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {tool === 'care' && <CareRecordLab />}
      {tool === 'careEvent' && <CareEventLab />}
      {tool === 'rehab' && <RehabLab />}
      {tool === 'guardian' && <GuardianNoticeLab />}
      {tool === 'community' && <CommunityLab />}
      {tool === 'budget' && <BudgetLab />}
      {tool === 'nursing' && <NursingLogLab />}
      {tool === 'program' && <ProgramLogLab />}
      {/* 메뉴가 둘이라 key로 다시 그려 각자 맞는 보기로 연다 */}
      {(tool === 'consult' || tool === 'carePlan') && (
        <ConsultationCarePlanLab key={tool} initialView={tool === 'carePlan' ? 'plan' : 'consult'} />
      )}
      {tool === 'meal' && <MealPlanLab />}
      {tool === 'safety' && <SafetyCheckLab />}
      {tool === 'copay' && <CopayLab />}
      {tool === 'payroll' && <PayrollLab />}
      {tool === 'ledger' && <LedgerLab />}
      {tool === 'donation' && <DonationLab />}
      {tool === 'risk' && <RiskAssessmentLab />}
      {tool === 'training' && <StaffTrainingLab />}
      {tool === 'eval' && <EvalReadinessLab />}
    </div>
  );
}
