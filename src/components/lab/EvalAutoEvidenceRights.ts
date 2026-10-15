/**
 * 평가 지표 자동 근거 중 11차에 더한 셋 — 욕구사정(NEEDS_ASSESSMENT, SVC-03), 급여제공계획 변경(PLAN_CHANGES, SVC-07), 직원권익향상 다섯 기준(STAFF_RIGHTS, OPS-05).
 * EvalAutoEvidence의 collect가 이 함수를 불러 같은 모양({lines})의 근거를 받는다. 규칙은 lib/lab의 needsRules·welfareRules·policyDocRules가 맡는다.
 * 일부 조회가 실패하면 그 부분만 "계산하지 못했습니다"로 두고, 전부 실패하면 던진다. 고충은 건수만 센다(내용은 실험실로 오지 않는다).
 */
import { getGrievanceSummary, listBonusFunds, listCareEvents, listCarePlanChanges, listCarePlans, listElderContracts, listPayrollProfiles, listPolicyDocs, listStaffWelfare } from '@/lib/lab/labApi';
import { CHANGE_GAP_LABEL, NEEDS_ITEMS, assessmentCoverage, changeRecordCheck, eventPlanReflection, needsComplete } from '@/lib/lab/needsRules';
import type { NeedsItemKey } from '@/lib/lab/needsRules';
import { bonusFundStatus, welfareQuarters } from '@/lib/lab/welfareRules';
import { docStatus } from '@/lib/lab/policyDocRules';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import type { StaffWelfare } from '@/lib/lab/labTypes';
import { FAILED, attempt, linesOrThrow } from './EvalAutoEvidenceShared';

export interface RightsEvidence {
  lines: string[];
}

const SOURCES: readonly EvalAutoSource[] = ['NEEDS_ASSESSMENT', 'PLAN_CHANGES', 'STAFF_RIGHTS'];

/** 이 파일이 맡는 자동 근거인가 */
export function isRightsEvidenceSource(source: EvalAutoSource): boolean {
  return SOURCES.includes(source);
}

/** 제공대장은 2026년 1분기부터 센다 */
const WELFARE_FROM_YEAR = 2026;
const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

async function needsAssessment(asOf: string): Promise<RightsEvidence> {
  const year = Number(asOf.slice(0, 4));
  const [contracts, plans] = await Promise.all([listElderContracts(), listCarePlans(year)]);
  const cov = assessmentCoverage(contracts, plans, year, asOf);
  if (cov.total === 0) return { lines: [`진행 중인 계약 어르신이 없어 욕구사정 현황을 셀 수 없습니다 (${asOf} 기준)`] };
  // 올해 가장 늦은 사정에서 어느 칸이 비었는지 센다 — 올해 사정이 없는 어르신은 따로 센다
  const missingCount = new Map<NeedsItemKey, number>();
  let noAvoid = 0;
  for (const row of cov.rows) {
    const mine = plans.filter((p) => p.elderlyId === row.elderlyId && p.assessedOn.slice(0, 4) === String(year));
    if (mine.length === 0) continue;
    const latest = mine.reduce((a, b) => (b.assessedOn.slice(0, 10) > a.assessedOn.slice(0, 10) ? b : a));
    const check = needsComplete(latest.needs);
    for (const key of check.missing) missingCount.set(key, (missingCount.get(key) ?? 0) + 1);
    if (!check.avoidFoodsRecorded) noAvoid += 1;
  }
  const labelOf = (key: NeedsItemKey) => NEEDS_ITEMS.find((i) => i.key === key)?.label ?? key;
  const top = [...missingCount.entries()].sort((a, b) => b[1] - a[1] || NEEDS_ITEMS.findIndex((i) => i.key === a[0]) - NEEDS_ITEMS.findIndex((i) => i.key === b[0])).slice(0, 3);
  const gaps = [...top.map(([key, n]) => `${labelOf(key)} ${n}명`), ...(noAvoid > 0 ? [`기피식품 ${noAvoid}명`] : [])];
  return {
    lines: [
      `${year}년 욕구사정 대상(진행 중 계약) ${cov.total}명 중 연 1회 사정을 한 어르신: ${cov.annual}/${cov.total}명 · 열 칸+기피식품까지 갖춘 어르신: ${cov.complete}/${cov.total}명 (${asOf} 기준)`,
      cov.newTotal === 0 ? `올해 새로 계약한 수급자는 없습니다` : `올해 신규 수급자 ${cov.newTotal}명 중 급여제공 시작일까지(시작 전 90일~시작일) 사정을 한 어르신: ${cov.newOk}/${cov.newTotal}명`,
      `모두 충족(연 1회 + 신규 시점 + 열 칸 완결)한 어르신: ${cov.ok}/${cov.total}명`,
      cov.complete < cov.total ? `빠진 칸이 많은 항목: ${gaps.length > 0 ? gaps.join(' · ') : '올해 사정 기록 자체가 없는 어르신이 대부분입니다'}${cov.annual < cov.total ? ` (올해 사정 없음 ${cov.total - cov.annual}명은 칸 수에 넣지 않음)` : ''}` : '열 칸과 기피식품이 모두 채워져 있습니다',
      '연 1회는 회계연도가 아니라 달력연도로 셌습니다(대조 필요). 신규 사정의 90일 범위는 기관 기준입니다',
      '체크리스트식 한 단어가 아니라 판단 근거를 서술했는지는 사람이 확인해 주세요. 구강상태·기피식품은 2026년 1월부터 기준입니다',
    ],
  };
}

async function planChanges(asOf: string): Promise<RightsEvidence> {
  const year = Number(asOf.slice(0, 4));
  const month = Number(asOf.slice(5, 7));
  const months = Array.from({ length: month }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  // 사고·상태변화는 월 단위로만 읽을 수 있어 올해 1월부터 이번 달까지 받는다
  const [events, changes] = await Promise.all([attempt(async () => (await Promise.all(months.map((m) => listCareEvents({ month: m })))).flat()), attempt(() => listCarePlanChanges({ year }))]);
  const lines: string[] = [];
  if (events && changes) {
    const r = eventPlanReflection(events, changes, asOf);
    lines.push(
      r.total === 0
        ? `${year}년 계획 반영이 필요한 상태변화(상태 변화·낙상·부상·입원·응급 중 보통 이상)가 없습니다 (${asOf} 기준)`
        : `${year}년 계획 반영이 필요한 상태변화 ${r.total}건 중 계획 변경 ${r.planChange}건 · 건별 사유만 ${r.followUpOnly}건 · 기한(30일) 안 진행 ${r.pending}건 · 미반영 ${r.none}건 (${asOf} 기준)`,
    );
    if (r.followUpOnly > 0) lines.push('건별 사유만 있는 건은 후속 조치 글만 있는 것입니다 — 일시 변경이면 건별 사유로 인정되나 장기 변경이면 계획 변경이 필요합니다');
  } else lines.push(`상태변화의 계획 반영: ${FAILED}`);
  if (changes) {
    const checks = changes.map(changeRecordCheck);
    const count = (gap: 'REASON' | 'ITEMS' | 'GUARDIAN' | 'NOTIFIED') => checks.filter((m) => m.includes(gap)).length;
    lines.push(
      changes.length === 0
        ? `${year}년에 기록된 급여제공계획 변경 이력이 없습니다`
        : `${year}년 계획 변경 이력 ${changes.length}건 중 ${CHANGE_GAP_LABEL.GUARDIAN} 빠짐 ${count('GUARDIAN')}건 · ${CHANGE_GAP_LABEL.NOTIFIED} 빠짐 ${count('NOTIFIED')}건${count('REASON') + count('ITEMS') > 0 ? ` · 사유·항목 빠짐 ${count('REASON') + count('ITEMS')}건` : ''}`,
    );
  } else lines.push(`계획 변경 이력: ${FAILED}`);
  lines.push('주 1회 상태변화 기록은 \'급여제공기록 품질\' 근거도 함께 보세요. 보호자 확인서명과 공단 통보는 변경 이력 칸의 날짜로만 셉니다');
  return linesOrThrow([events && changes, changes], lines);
}

async function staffRights(asOf: string): Promise<RightsEvidence> {
  const year = Number(asOf.slice(0, 4));
  const years = Array.from({ length: Math.max(1, year - WELFARE_FROM_YEAR + 1) }, (_, i) => WELFARE_FROM_YEAR + i);
  const [profiles, funds, welfare, grievance, docs] = await Promise.all([
    attempt(() => listPayrollProfiles()),
    attempt(() => listBonusFunds(year)),
    attempt(async () => (await Promise.all(years.map((y) => listStaffWelfare(y)))).flat() as StaffWelfare[]),
    attempt(() => getGrievanceSummary(year)),
    attempt(() => listPolicyDocs()),
  ]);
  const lines: string[] = [];
  if (profiles) {
    const insured = profiles.filter((p) => p.npsEnrolled && p.healthEnrolled && p.employmentEnrolled).length;
    lines.push(
      profiles.length === 0
        ? '① 등록된 직원 급여 기준이 없어 3대 보험 가입 직원을 셀 수 없습니다 — 완납증명서는 서류로 확인해 주세요'
        : `① 급여 기준 국민연금·건강·고용보험을 모두 가입한 직원: ${insured}/${profiles.length}명 — 보험료 완납(평가일 이후 완납은 불인정)은 사회보험통합징수포털 완납증명서로 서류 확인`,
    );
  } else lines.push(`① 보험 가입 현황: ${FAILED}`);
  if (funds) {
    const f = bonusFundStatus(funds);
    lines.push(
      f.state === 'NOT_RECEIVED'
        ? `② ${year}년 받은 가산금이 없어 기준 충족으로 봅니다`
        : `② ${year}년 가산금 ${won(f.received)} 수령 · 직원에게 쓴 금액 ${won(f.countedSpent)}${f.ownerSpent > 0 ? `(대표자 몫 ${won(f.ownerSpent)} 제외)` : ''} · ${f.state === 'USED' ? `사용 비율 ${f.ratio}% (80% 기준은 참고, 대조 필요)` : '직원에게 쓴 기록 없음'}`,
    );
  } else lines.push(`② 가산금 사용: ${FAILED}`);
  if (welfare) {
    const q = welfareQuarters(welfare, `${WELFARE_FROM_YEAR}-Q1`, asOf);
    const notMet = q.quarters.filter((x) => x.state === 'NOT_MET').map((x) => x.quarter);
    lines.push(
      q.quarters.length === 0
        ? '③ 복지 제공대장 분기를 셀 수 없습니다'
        : `③ 분기별 복지 제공(인정 종류·서명·증빙 갖춘 건이 1건 이상): ${q.quarters.map((x) => `${x.quarter} ${x.state === 'MET' ? '충족' : x.state === 'IN_PROGRESS' ? '진행 중' : '미충족'}`).join(' · ')}${notMet.length > 0 ? ` — 미충족 ${notMet.length}분기` : ''}`,
    );
  } else lines.push(`③ 복지 제공대장: ${FAILED}`);
  if (grievance || docs) {
    const guide = docs?.find((d) => d.kind === 'GRIEVANCE_GUIDE') ?? null;
    const guideText = !docs ? `고충처리지침 대장을 ${FAILED}` : !guide ? '고충처리지침이 규정·지침 대장에 없습니다' : (() => {
      const s = docStatus(guide, asOf);
      return `고충처리지침 세 요소(접수 방법·처리 과정·처리 기한) ${s.itemsChecked}/${s.itemsTotal}개 체크${s.missingItems.length > 0 ? ` (빠진 것: ${s.missingItems.join(' · ')})` : ''}`;
    })();
    const countText = !grievance ? `고충 처리 현황 ${FAILED}` : `${year}년 고충 ${grievance.total}건(처리완료 ${grievance.resolved}건${grievance.oldestOpenDays !== null ? ` · 가장 오래 열린 건 ${grievance.oldestOpenDays}일` : ''})`;
    lines.push(`④ ${guideText} · ${countText}`);
  } else lines.push(`④ 고충처리: ${FAILED}`);
  lines.push('⑤ 퇴직금 제도 운영은 \'퇴직금 추계\'와 퇴직금 추계 지표(OPS-07) 근거를 참고해 주세요');
  lines.push(`제공대장은 현금 인출 후 서명부만 있으면 불인정이니 이체내역·영수증을 함께 두세요 (${asOf} 기준)`);
  return linesOrThrow([profiles, funds, welfare, grievance && docs], lines);
}

export async function collectRightsEvidence(source: EvalAutoSource, asOf: string): Promise<RightsEvidence> {
  if (source === 'NEEDS_ASSESSMENT') return needsAssessment(asOf);
  if (source === 'PLAN_CHANGES') return planChanges(asOf);
  return staffRights(asOf);
}
