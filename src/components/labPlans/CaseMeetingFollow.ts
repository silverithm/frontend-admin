/** 반영·평가 기한 칩 문구 — targetFollowUp 판정을 칩 하나하나로 옮긴다. */
import { dotDate } from '@/components/lab/labFormat';
import type { Tone } from '@/components/lab/LabUi';
import { targetFollowUp } from '@/lib/lab/caseMeetingRules';
import type { CaseFollowTarget, FollowUp } from '@/lib/lab/caseMeetingRules';

export interface FollowChip {
  tone: Tone;
  label: string;
}

/** 한 대상의 반영 칩과 평가 칩 */
export function followChips(f: FollowUp): FollowChip[] {
  const reflect: FollowChip =
    f.reflectState === 'DONE'
      ? { tone: 'ok', label: '반영 기한 안에 반영함' }
      : f.reflectState === 'LATE'
        ? { tone: 'danger', label: `반영이 기한(${dotDate(f.reflectDue)})보다 늦음` }
        : f.reflectState === 'PENDING'
          ? { tone: 'warn', label: `반영 기한 ${dotDate(f.reflectDue)}` }
          : { tone: 'danger', label: `반영 기한 지남 (${dotDate(f.reflectDue)})` };
  const due = f.evalDue ? dotDate(f.evalDue) : '';
  const evaluate: FollowChip =
    f.evalState === 'WAITING'
      ? { tone: 'neutral', label: '평가는 반영한 뒤 30일 안' }
      : f.evalState === 'PENDING'
        ? { tone: 'warn', label: `평가 기한 ${due}` }
        : f.evalState === 'OVERDUE'
          ? { tone: 'danger', label: `평가 기한 지남 (${due})` }
          : f.evalState === 'LATE'
            ? { tone: 'danger', label: `평가가 기한(${due})보다 늦음` }
            : f.evalState === 'INCOMPLETE'
              ? { tone: 'warn', label: '평가 칸 보완 필요' }
              : { tone: 'ok', label: '평가 완료' };
  return [reflect, evaluate];
}

/** 회의 한 건의 대상 전체를 한 줄 칩으로 줄인다(목록용) */
export function meetingFollowSummary(heldOn: string, targets: readonly CaseFollowTarget[], asOf: string): FollowChip[] {
  let overdue = 0;
  let incomplete = 0;
  let allDone = true;
  let nextDue: string | null = null;
  for (const t of targets) {
    const f = targetFollowUp(heldOn, t, asOf);
    if (f.reflectState === 'OVERDUE' || f.reflectState === 'LATE' || f.evalState === 'OVERDUE' || f.evalState === 'LATE') overdue += 1;
    if (f.evalState === 'INCOMPLETE') incomplete += 1;
    if (f.reflectState !== 'DONE' || f.evalState !== 'DONE') allDone = false;
    const pending = f.reflectState === 'PENDING' ? f.reflectDue : f.evalState === 'PENDING' ? f.evalDue : null;
    if (pending && (nextDue === null || pending < nextDue)) nextDue = pending;
  }
  const out: FollowChip[] = [];
  if (overdue > 0) out.push({ tone: 'danger', label: `기한 지난 대상 ${overdue}명` });
  if (incomplete > 0) out.push({ tone: 'warn', label: `평가 보완 ${incomplete}명` });
  if (nextDue) out.push({ tone: 'warn', label: `다음 기한 ${dotDate(nextDue)}` });
  if (out.length === 0 && allDone && targets.length > 0) out.push({ tone: 'ok', label: '반영·평가 완료' });
  return out;
}
