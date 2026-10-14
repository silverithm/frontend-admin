/**
 * 평가 지표 자동 근거 중 6차에 더한 넷 — 약품 분기 점검, 퇴소 연계기록지, 급여제공계획 통보, 노인인권 지침 안내.
 * EvalAutoEvidence의 collect가 이 함수를 불러 같은 모양({lines})의 근거를 받는다. 규칙은 lib/lab의 medicationRules·dischargeRules·contractRules가 맡는다.
 */
import { listDischargeReferrals, listElderContracts, listMedicineChecks, listMedicineStock } from '@/lib/lab/labApi';
import { RIGHTS_GUIDE_DAYS } from '@/lib/lab/contractRules';
import { referralRequired, referralSummary } from '@/lib/lab/dischargeRules';
import { addDays } from '@/lib/lab/labDate';
import { expiringStock, missedQuarters, quarterChecks } from '@/lib/lab/medicationRules';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import { dotDate } from './labFormat';

export interface ContractEvidence {
  lines: string[];
}

/** 이 파일이 맡는 자동 근거인가 */
export function isContractEvidenceSource(source: EvalAutoSource): boolean {
  return source === 'MEDICINE_QUARTERLY' || source === 'DISCHARGE_REFERRAL' || source === 'PLAN_NOTIFIED_BY_START' || source === 'RIGHTS_GUIDE_14D';
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));
const day = (value: string | null | undefined) => (typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null);

async function medicineQuarterly(asOf: string): Promise<ContractEvidence> {
  const year = Number(asOf.slice(0, 4));
  const [checks, stockRes] = await Promise.all([listMedicineChecks(year), listMedicineStock().then((s) => ({ ok: true as const, s }), () => ({ ok: false as const }))]);
  const quarters = quarterChecks(checks, year);
  const missed = missedQuarters(checks, asOf);
  const current = Math.floor((Number(asOf.slice(5, 7)) - 1) / 3) + 1;
  const past = quarters.filter((q) => q.quarter < current);
  const done = past.filter((q) => q.done).length;
  const unlocked = past.filter((q) => q.done && q.lockedOk === false).map((q) => `${q.quarter}분기`);
  const lines = [
    past.length === 0
      ? `${year}년은 아직 끝난 분기가 없어 점검 현황을 셀 수 없습니다 (${asOf} 기준)`
      : `${year}년 지난 ${past.length}분기 중 약품 보관 점검을 한 분기: ${done}/${past.length}분기 (${pct(done, past.length)}%, ${asOf} 기준)`,
    quarters
      .map((q) => `${q.quarter}분기 ${q.done ? `${dotDate(q.checkedOn)} 점검${q.lockedOk === false ? '(잠금 확인 안 됨)' : ''}` : q.quarter < current ? '점검 없음' : q.quarter === current ? '진행 중' : '아직 아님'}`)
      .join(' · '),
  ];
  if (missed.length > 0) lines.push(`점검이 빠진 분기: ${missed.map((q) => `${q}분기`).join('·')}`);
  if (unlocked.length > 0) lines.push(`보관함(냉장고 포함) 잠금 확인이 안 된 분기: ${unlocked.join('·')}`);
  if (stockRes.ok) {
    const expired = expiringStock(stockRes.s, asOf).expired.length;
    lines.push(expired > 0 ? `사용기한이 지난 약 ${expired}건이 보관 중입니다 — 지난 약을 보관하면 인정되지 않으니 폐기해 주세요` : '사용기한이 지난 채 보관 중인 약 없음');
  } else lines.push('약품 관리대장을 불러오지 못해 사용기한 지난 약은 세지 못했습니다');
  return { lines };
}

async function dischargeReferral(asOf: string): Promise<ContractEvidence> {
  const year = Number(asOf.slice(0, 4));
  const [referrals, endedRes] = await Promise.all([listDischargeReferrals({ year }), listElderContracts({ status: 'ENDED' }).then((c) => ({ ok: true as const, c }), () => ({ ok: false as const }))]);
  const sum = referralSummary(referrals, year);
  const writtenElders = new Set(referrals.map((r) => r.elderlyId));
  // 연계기록지를 써야 하는 사유로 올해 끝난 계약인데 기록지가 없는 어르신 — 기록지만 보면 이런 퇴소자는 보이지 않는다
  const noReferral = endedRes.ok
    ? endedRes.c.filter((c) => day(c.contractEnd)?.startsWith(`${year}-`) && c.endReason !== null && referralRequired(c.endReason) && !writtenElders.has(c.elderlyId)).length
    : null;
  if (sum.total === 0 && noReferral === 0) return { lines: [`${year}년 퇴소자가 없어 기준 충족(퇴소자 없음) (${asOf} 기준)`, '퇴소(계약 종료) 사유가 사망인 수급자는 연계기록지 작성 대상이 아닙니다'] };
  const lines: string[] = [];
  if (sum.total > 0) {
    lines.push(`${year}년 퇴소 연계기록지 ${sum.total}건 중 제공대장(제공일·방법·제공자·수령자)까지 쓴 것: ${sum.provided}/${sum.total}건 (${pct(sum.provided, sum.total)}%)`);
    lines.push(`퇴소일까지 제공한 것 ${sum.onTime}/${sum.total}건 (${asOf} 기준)`);
  } else lines.push(`${year}년에 작성한 퇴소 연계기록지가 없습니다 (${asOf} 기준)`);
  if (noReferral === null) lines.push('계약 정보를 불러오지 못해 기록지 없는 퇴소자는 세지 못했습니다 — 퇴소자가 없었다면 기준 충족(퇴소자 없음)');
  else if (noReferral > 0) lines.push(`올해 계약이 끝났는데(사망 제외) 연계기록지가 없는 수급자 ${noReferral}명 — '계약·인정'의 퇴소 연계기록지에서 작성해 주세요`);
  return { lines };
}

async function planNotified(asOf: string): Promise<ContractEvidence> {
  const contracts = await listElderContracts({ status: 'ACTIVE' });
  if (contracts.length === 0) return { lines: ['진행 중인 계약이 없어 급여제공계획 통보 현황을 셀 수 없습니다'] };
  let ok = 0;
  let late = 0;
  let none = 0;
  let notDue = 0;
  for (const c of contracts) {
    const start = day(c.contractStart);
    const notified = day(c.planNotifiedOn);
    if (start === null) continue;
    if (notified !== null) {
      if (notified <= start) ok += 1;
      else late += 1;
    } else if (asOf < start) notDue += 1;
    else none += 1;
  }
  const counted = ok + late + none;
  return {
    lines: [
      counted === 0
        ? `진행 중 계약 ${contracts.length}건은 모두 급여제공 시작일 전이라 아직 통보 기한이 오지 않았습니다 (${asOf} 기준)`
        : `진행 중 계약 ${counted}건 중 급여제공계획을 시작일까지 공단에 통보한 것: ${ok}/${counted}건 (${pct(ok, counted)}%, ${asOf} 기준)`,
      `통보 기록 없음 ${none}건 · 시작일보다 늦게 통보 ${late}건${notDue > 0 ? ` · 시작 전이라 기한 안 ${notDue}건(위 비율에서 제외)` : ''}`,
      '통보 기록만 센 것입니다. 급여제공계획의 설명과 수급자·보호자 확인 서명은 따로 확인해 주세요 (대조 필요)',
    ],
  };
}

async function rightsGuide(asOf: string): Promise<ContractEvidence> {
  const year = Number(asOf.slice(0, 4));
  const contracts = (await listElderContracts()).filter((c) => day(c.contractStart)?.startsWith(`${year}-`));
  if (contracts.length === 0) return { lines: [`${year}년에 시작한 계약이 없어 신규 수급자 인권 지침 안내 현황을 셀 수 없습니다 (신규 수급자가 없으면 해당 없음)`] };
  let ok = 0;
  let late = 0;
  let none = 0;
  let notDue = 0;
  for (const c of contracts) {
    const start = day(c.contractStart) as string;
    const due = addDays(start, RIGHTS_GUIDE_DAYS);
    const guided = day(c.rightsGuidedOn);
    if (due === null) continue;
    if (guided !== null) {
      if (guided <= due) ok += 1;
      else late += 1;
    } else if (asOf <= due) notDue += 1;
    else none += 1;
  }
  const counted = ok + late + none;
  return {
    lines: [
      counted === 0
        ? `${year}년 시작한 계약 ${contracts.length}건은 모두 안내 기한(시작일부터 14일) 안이라 아직 판단하지 않습니다 (${asOf} 기준)`
        : `${year}년 시작한 계약 ${counted}건 중 시작일부터 14일 안에 노인인권 지침을 안내한 것: ${ok}/${counted}건 (${pct(ok, counted)}%, ${asOf} 기준)`,
      `안내 기록 없음 ${none}건 · 14일 넘겨 안내 ${late}건${notDue > 0 ? ` · 기한이 남아 있는 ${notDue}건(위 비율에서 제외)` : ''}`,
      '신규 수급자 기준입니다. 안내 방법과 수급자 확인은 따로 남겨 두세요 (대조 필요)',
    ],
  };
}

export async function collectContractEvidence(source: EvalAutoSource, asOf: string): Promise<ContractEvidence> {
  if (source === 'MEDICINE_QUARTERLY') return medicineQuarterly(asOf);
  if (source === 'DISCHARGE_REFERRAL') return dischargeReferral(asOf);
  if (source === 'PLAN_NOTIFIED_BY_START') return planNotified(asOf);
  return rightsGuide(asOf);
}
