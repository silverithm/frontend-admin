/** 대장 한 줄의 상태 표시 문구 — docStatus 판정에 개정일·비치 장소 빠짐을 덧붙인다. */
import { docStatus } from '@/lib/lab/policyDocRules';
import type { DocStatus } from '@/lib/lab/policyDocRules';
import type { PolicyDoc } from '@/lib/lab/labTypes';

export interface StatusView {
  status: DocStatus;
  ready: boolean;
  /** 보완할 것(없으면 빈 목록) */
  gaps: string[];
}

export function statusView(doc: PolicyDoc, today: string): StatusView {
  const status = docStatus(doc, today);
  const gaps: string[] = [];
  if (status.itemsTotal > 0 && !status.complete) gaps.push(`항목 ${status.itemsChecked}/${status.itemsTotal}`);
  if (!doc.revisedOn) gaps.push('개정일 없음');
  if (!doc.location || doc.location.trim() === '') gaps.push('비치 장소 없음');
  return { status, ready: status.state === 'READY', gaps };
}
