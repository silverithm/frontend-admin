/**
 * 퇴소 연계기록지 규칙 — 작성 대상, 요건 점검, 올해 현황, AI 초안에 쓸 사실 묶음.
 *
 * 근거(research-6.md 4절, 2026 평가 주야간보호 '외부기관연계' 기준②): 계약 종료일까지 수급자(보호자)에게 연계기록지를 작성해 제공하고
 * 연계기록지 사본(작성일자·수급자명·등급·심신기능 상태·제공한 급여·퇴소 후 서비스 이용계획)과 제공대장(수급자명·제공일자·제공방법·제공자명·수령자명)으로 확인한다.
 * 퇴소일보다 작성일·제공일이 늦으면 상담기록지 등 관련 서류로 예외 인정될 수 있다. 사망, 퇴소 없이 입원만 한 경우는 작성하지 않는다.
 * 공개 법령에는 연계기록지 서식 번호가 없다(기관 자체 서식, 대조 필요). 지표 적용 기간에 퇴소자가 없으면 기준②는 충족으로 본다.
 */
import type { BathLog, DischargeFacts, DischargeReferral, DischargeReason } from './labTypes.ts';
import { collectPeriodFacts, type FactSources } from './guardianNotice.ts';
import { isValidYmd } from './labDate.ts';

export const DISCHARGE_REASONS: ReadonlyArray<{ value: DischargeReason; label: string }> = [
  { value: 'TRANSFER', label: '다른 기관·시설로 옮김(전원)' },
  { value: 'HOSPITAL', label: '입원 후 퇴소(계약 해지)' },
  { value: 'SELF', label: '본인·보호자 희망으로 종료' },
  { value: 'OTHER', label: '그 밖의 사유' },
];

export const PROVIDED_METHODS: ReadonlyArray<{ value: NonNullable<DischargeReferral['providedMethod']>; label: string }> = [
  { value: 'VISIT', label: '방문(직접 전달)' },
  { value: 'MAIL', label: '우편' },
  { value: 'FAX', label: '모사전송(팩스)' },
  { value: 'ELECTRONIC', label: '전자(문자·앱 등)' },
  { value: 'OTHER', label: '그 밖' },
];

export function dischargeReasonLabel(reason: string): string {
  return DISCHARGE_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function providedMethodLabel(method: string): string {
  return PROVIDED_METHODS.find((m) => m.value === method)?.label ?? method;
}

/** 서버와 같은 한도 */
export const MAX_REFERRAL_FUNCTIONAL = 2000;
export const MAX_REFERRAL_SERVICES = 2000;
export const MAX_REFERRAL_PLAN = 1000;
export const MAX_REFERRAL_COUNSEL = 1000;

/** 연계기록지를 써야 하는 사유인가. 전원·입원 후 퇴소·본인 희망·그 밖은 쓰고, 사망이나 알 수 없는 사유는 작성 대상이 아니다. */
export function referralRequired(reason: string): boolean {
  return reason === 'TRANSFER' || reason === 'HOSPITAL' || reason === 'SELF' || reason === 'OTHER';
}

export interface ComplianceItem {
  code: 'FIELDS' | 'WRITTEN_BY_DISCHARGE' | 'PROVIDED' | 'PROVIDED_BY_DISCHARGE';
  ok: boolean;
  message: string;
}

type ReferralForCompliance = Pick<
  DischargeReferral,
  'writtenOn' | 'dischargeOn' | 'careGrade' | 'functionalStatus' | 'servicesProvided' | 'afterPlan' | 'providedOn' | 'providedMethod' | 'providerName' | 'recipientName'
>;

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function day(value: string | null | undefined): string | null {
  return typeof value === 'string' && isValidYmd(value) ? value.slice(0, 10) : null;
}

/** 제공대장 네 칸(제공일자·방법·제공자·수령자)이 모두 있는가 */
export function hasProvidedLedger(r: Pick<DischargeReferral, 'providedOn' | 'providedMethod' | 'providerName' | 'recipientName'>): boolean {
  return day(r.providedOn) !== null && filled(r.providedMethod) && filled(r.providerName) && filled(r.recipientName);
}

/** 제공대장 네 칸 중 일부만 적은 상태(서버도 400) */
export function ledgerPartlyFilled(r: Pick<DischargeReferral, 'providedOn' | 'providedMethod' | 'providerName' | 'recipientName'>): boolean {
  const count = [day(r.providedOn) !== null, filled(r.providedMethod), filled(r.providerName), filled(r.recipientName)].filter(Boolean).length;
  return count > 0 && count < 4;
}

/**
 * 평가 확인 항목 네 가지. 늦은 작성·제공은 "예외 인정 가능" 안내를 붙이되 ok는 false로 둔다(그냥 통과로 보이면 안 된다).
 *  FIELDS: 작성일·등급·심신기능 상태·제공한 급여·퇴소 후 이용계획이 모두 있는가(수급자명은 어르신 정보로 붙는다)
 *  WRITTEN_BY_DISCHARGE: 작성일이 퇴소일 이전(같은 날 포함)인가
 *  PROVIDED: 제공대장 네 칸이 있는가
 *  PROVIDED_BY_DISCHARGE: 제공일이 퇴소일 이전(같은 날 포함)인가 — 제공 기록이 없으면 false
 */
export function referralCompliance(referral: ReferralForCompliance): ComplianceItem[] {
  const written = day(referral.writtenOn);
  const discharge = day(referral.dischargeOn);
  const provided = day(referral.providedOn);
  const missing: string[] = [];
  if (written === null) missing.push('작성일자');
  if (!filled(referral.careGrade)) missing.push('등급');
  if (!filled(referral.functionalStatus)) missing.push('심신기능 상태');
  if (!filled(referral.servicesProvided)) missing.push('제공한 급여');
  if (!filled(referral.afterPlan)) missing.push('퇴소 후 서비스 이용계획');

  const writtenOk = written !== null && discharge !== null && written <= discharge;
  const hasLedger = hasProvidedLedger(referral);
  const providedOk = hasLedger && provided !== null && discharge !== null && provided <= discharge;

  return [
    {
      code: 'FIELDS',
      ok: missing.length === 0,
      message: missing.length === 0 ? '작성일자·등급·심신기능 상태·제공한 급여·퇴소 후 이용계획이 모두 있습니다' : `빠진 항목: ${missing.join(', ')}`,
    },
    {
      code: 'WRITTEN_BY_DISCHARGE',
      ok: writtenOk,
      message: writtenOk
        ? '퇴소일까지 작성했습니다'
        : '작성일이 퇴소일보다 늦거나 없습니다. 상담기록지 등 관련 서류로 예외 인정될 수 있으니 그 서류를 함께 보관하세요',
    },
    {
      code: 'PROVIDED',
      ok: hasLedger,
      message: hasLedger ? '제공대장(제공일자·방법·제공자·수령자)이 있습니다' : '제공대장 네 칸(제공일자·방법·제공자·수령자)을 모두 적어 주세요',
    },
    {
      code: 'PROVIDED_BY_DISCHARGE',
      ok: providedOk,
      message: providedOk
        ? '퇴소일까지 수급자(보호자)에게 제공했습니다'
        : hasLedger
          ? '제공일이 퇴소일보다 늦습니다. 상담기록지 등 관련 서류로 예외 인정될 수 있으니 그 서류를 함께 보관하세요'
          : '아직 제공한 기록이 없습니다. 계약 종료일까지 수급자(보호자)에게 제공해야 합니다',
    },
  ];
}

export interface ReferralSummary {
  /** 퇴소일이 그 해인 연계기록지 수 */
  total: number;
  /** 그중 제공대장 네 칸이 있는 것 */
  provided: number;
  /** 그중 제공일이 퇴소일 이전(같은 날 포함)인 것 */
  onTime: number;
}

/** 그 해 퇴소한 수급자의 연계기록지 현황. 퇴소자가 없으면 모두 0 — 평가에서는 퇴소자가 없으면 기준을 충족한 것으로 본다. */
export function referralSummary(
  referrals: ReadonlyArray<Pick<DischargeReferral, 'dischargeOn' | 'providedOn' | 'providedMethod' | 'providerName' | 'recipientName'>>,
  year: number,
): ReferralSummary {
  let total = 0;
  let provided = 0;
  let onTime = 0;
  for (const r of referrals) {
    const discharge = day(r.dischargeOn);
    if (discharge === null || Number(discharge.slice(0, 4)) !== year) continue;
    total += 1;
    if (!hasProvidedLedger(r)) continue;
    provided += 1;
    if ((day(r.providedOn) as string) <= discharge) onTime += 1;
  }
  return { total, provided, onTime };
}

export interface DischargeFactsInput extends FactSources {
  /** 'YYYY-MM-DD' — 기간 시작(포함) */
  from: string;
  /** 'YYYY-MM-DD' — 기간 끝(포함, 보통 퇴소일) */
  to: string;
  bathLogs: ReadonlyArray<Pick<BathLog, 'elderlyId' | 'bathDate'>>;
  /** 출석 일수를 아는 경우만 */
  attendanceDays?: number | null;
}

/**
 * 퇴소 연계기록지 초안의 근거가 되는 사실 묶음 — 이름이 없다. 기간(from~to, 양 끝 포함) 안의 그 어르신 기록만 모은다.
 * 활력징후·프로그램·훈련·사고·특이사항은 보호자 월간 안내와 같은 규칙(guardianNotice.collectPeriodFacts)이다. 목욕은 서로 다른 날 수.
 * 기간이 올바르지 않으면(날짜 형식 오류·from > to) 모든 칸이 빈 묶음이다.
 */
export function buildDischargeFacts(input: DischargeFactsInput): DischargeFacts {
  const from = day(input.from);
  const to = day(input.to);
  const valid = from !== null && to !== null && from <= to;
  const within = (date: string) => valid && date >= (from as string) && date <= (to as string);
  const facts = collectPeriodFacts(input, within);
  const bathDays = new Set<string>();
  for (const log of input.bathLogs) {
    const d = day(log.bathDate);
    if (log.elderlyId === input.elderlyId && d !== null && within(d)) bathDays.add(d);
  }
  return {
    period: { from: input.from, to: input.to },
    attendanceDays: typeof input.attendanceDays === 'number' && Number.isFinite(input.attendanceDays) ? input.attendanceDays : null,
    vitals: facts.vitals,
    programs: facts.programs,
    rehab: facts.rehab,
    bath: { count: bathDays.size },
    events: facts.events,
    specialNotes: facts.specialNotes,
  };
}
