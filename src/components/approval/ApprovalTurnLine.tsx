'use client';

import { Text } from '@astryxdesign/core/Text';
import type { ApprovalStep, ApprovalStatus } from '@/types/approval';
import '@/styles/staff.css';

interface ApprovalTurnLineProps {
  status: ApprovalStatus;
  approvalLine?: ApprovalStep[];
}

/**
 * 결재 목록 행의 '○○ 차례 · 2/3' 한 줄 + 단계 점.
 * 진행중 문서만, 결재선이 있을 때만 그린다(결재선 없는 옛 문서는 아무것도 그리지 않는다).
 * 점: 끝난(승인·건너뜀) 단계는 채움, 지금 단계는 테두리, 남은 단계는 빈 점.
 */
export function ApprovalTurnLine({ status, approvalLine }: ApprovalTurnLineProps) {
  if (status !== 'PENDING' || !approvalLine || approvalLine.length === 0) return null;
  const steps = [...approvalLine].sort((a, b) => a.stepOrder - b.stepOrder);
  const currentIndex = steps.findIndex((step) => step.status === 'PENDING');
  if (currentIndex < 0) return null;
  const current = steps[currentIndex];
  const text = `${current.approverName} 차례 · ${currentIndex + 1}/${steps.length}`;

  return (
    <span className="carev-turn" aria-label={text}>
      <span className="carev-turn-dots" aria-hidden>
        {steps.map((step, index) => (
          <span
            key={step.id ?? index}
            className="carev-turn-dot"
            data-state={index === currentIndex ? 'current' : step.status === 'PENDING' ? 'todo' : 'done'}
          />
        ))}
      </span>
      <Text type="supporting" color="secondary">{text}</Text>
    </span>
  );
}
