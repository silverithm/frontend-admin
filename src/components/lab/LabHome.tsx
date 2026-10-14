'use client';

/**
 * 실험실 — 기관 업무를 AI와 함께 새로 만들어 보는 곳. 접근 권한이 있는 기관의 관리자에게만 탭이 보인다.
 * 네 가지 도구를 SegmentedControl로 오간다. 마지막으로 쓴 도구는 이 브라우저에 기억해 다음에 바로 연다.
 */
import { useEffect, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import PageHeader from '@/components/PageHeader';
import CareRecordLab from './CareRecordLab';
import CopayLab from './CopayLab';
import EvalReadinessLab from './EvalReadinessLab';
import RiskAssessmentLab from './RiskAssessmentLab';
import { readStored, writeStored } from './labFormat';
import styles from './lab.module.css';

type LabTool = 'care' | 'copay' | 'risk' | 'eval';

const TOOLS: ReadonlyArray<{ id: LabTool; label: string }> = [
  { id: 'care', label: '급여제공기록' },
  { id: 'copay', label: '본인부담금' },
  { id: 'risk', label: '위험도 평가' },
  { id: 'eval', label: '평가 준비' },
];

const TOOL_KEY = 'carev.lab.tool';

function isTool(value: string | null): value is LabTool {
  return TOOLS.some((t) => t.id === value);
}

export default function LabHome() {
  const [tool, setTool] = useState<LabTool>('care');

  // 저장된 값은 브라우저에서만 읽을 수 있으므로 첫 그림 뒤에 반영한다
  useEffect(() => {
    const stored = readStored(TOOL_KEY);
    if (isTool(stored)) setTool(stored);
  }, []);

  const choose = (value: string) => {
    if (!isTool(value)) return;
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

      <SegmentedControl label="실험실 도구" value={tool} onChange={choose}>
        {TOOLS.map((t) => (
          <SegmentedControlItem key={t.id} value={t.id} label={t.label} />
        ))}
      </SegmentedControl>

      {tool === 'care' && <CareRecordLab />}
      {tool === 'copay' && <CopayLab />}
      {tool === 'risk' && <RiskAssessmentLab />}
      {tool === 'eval' && <EvalReadinessLab />}
    </div>
  );
}
