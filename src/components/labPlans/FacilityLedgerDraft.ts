/** 시설 정보·실시 기록 입력 상태와 저장 전 확인. */
import { isValidYmd } from '@/lib/lab/labDate';
import type {
  FacilityApplies, FacilityDoneBy, FacilityElevator, FacilityGasKind, FacilityItemCode, FacilityLog, FacilityLogInput, FacilityLogResult,
  FacilityPowerKind, FacilityProfile, FacilityProfileInput, FacilitySeptic, FacilitySprinkler, FacilityWaterTank,
} from '@/lib/lab/labTypes';
import { MAX_AREA, MAX_LPG_KG, orNull } from './FacilityLedgerFormat';

export interface ProfileDraft {
  approvedOn: string;
  grossAreaM2: number | null;
  sprinkler: FacilitySprinkler;
  powerKind: FacilityPowerKind;
  gasKind: FacilityGasKind;
  lpgCapacityKg: number | null;
  elevator: FacilityElevator;
  waterTank: FacilityWaterTank;
  septic: FacilitySeptic;
  fireManagerName: string;
  note: string;
}

export const profileToDraft = (p: FacilityProfile | null): ProfileDraft => ({
  approvedOn: p?.approvedOn ?? '',
  grossAreaM2: p?.grossAreaM2 ?? null,
  sprinkler: p?.sprinkler ?? 'UNKNOWN',
  powerKind: p?.powerKind ?? 'UNKNOWN',
  gasKind: p?.gasKind ?? 'UNKNOWN',
  lpgCapacityKg: p?.lpgCapacityKg ?? null,
  elevator: p?.elevator ?? 'UNKNOWN',
  waterTank: p?.waterTank ?? 'UNKNOWN',
  septic: p?.septic ?? 'UNKNOWN',
  fireManagerName: p?.fireManagerName ?? '',
  note: p?.note ?? '',
});

/** 직접 지정(appliesOverride)은 입력 칸이 아니라 항목 표에서 바꾸므로 저장돼 있는 값을 그대로 가져간다 */
export function profileInput(d: ProfileDraft, saved: FacilityProfile | null): FacilityProfileInput {
  return {
    approvedOn: d.approvedOn === '' ? null : d.approvedOn,
    grossAreaM2: d.grossAreaM2,
    sprinkler: d.sprinkler,
    powerKind: d.powerKind,
    gasKind: d.gasKind,
    lpgCapacityKg: d.gasKind === 'LPG' ? d.lpgCapacityKg : null,
    elevator: d.elevator,
    waterTank: d.waterTank,
    septic: d.septic,
    appliesOverride: saved?.appliesOverride ?? {},
    fireManagerName: orNull(d.fireManagerName),
    note: orNull(d.note),
  };
}

/** 저장된 시설 정보에 직접 지정 하나만 바꾼 저장 값 */
export function overrideInput(saved: FacilityProfile, code: FacilityItemCode, value: FacilityApplies | null): FacilityProfileInput {
  const next = { ...saved.appliesOverride };
  if (value === null) delete next[code];
  else next[code] = value;
  return { ...profileInput(profileToDraft(saved), saved), appliesOverride: next };
}

export function profileBlockers(d: ProfileDraft, today: string): string[] {
  const out: string[] = [];
  if (d.approvedOn !== '') {
    if (!isValidYmd(d.approvedOn)) out.push('사용승인일 날짜가 올바르지 않습니다');
    else if (d.approvedOn > today) out.push('사용승인일은 오늘보다 뒤일 수 없습니다');
  }
  if (d.grossAreaM2 !== null && (d.grossAreaM2 < 1 || d.grossAreaM2 > MAX_AREA)) out.push('연면적은 1 이상 1,000,000 이하로 적어 주세요');
  if (d.lpgCapacityKg !== null && d.lpgCapacityKg > MAX_LPG_KG) out.push('LPG 저장능력은 100,000kg 이하로 적어 주세요');
  return out;
}

export interface LogDraft {
  id: number | null;
  doneOn: string;
  doneBy: FacilityDoneBy;
  vendorName: string;
  result: FacilityLogResult;
  actionNote: string;
  reportedOn: string;
  validUntil: string;
  docLocation: string;
}

export const emptyLog = (): LogDraft => ({ id: null, doneOn: '', doneBy: 'VENDOR', vendorName: '', result: 'PASS', actionNote: '', reportedOn: '', validUntil: '', docLocation: '' });

export const logToDraft = (l: FacilityLog): LogDraft => ({
  id: l.id,
  doneOn: l.doneOn.slice(0, 10),
  doneBy: l.doneBy,
  vendorName: l.vendorName ?? '',
  result: l.result,
  actionNote: l.actionNote ?? '',
  reportedOn: l.reportedOn ?? '',
  validUntil: l.validUntil ?? '',
  docLocation: l.docLocation ?? '',
});

export const isFireCode = (code: FacilityItemCode) => code === 'FIRE_OPERATION' || code === 'FIRE_COMPREHENSIVE';
export const isInsuranceCode = (code: FacilityItemCode) => code === 'INSURANCE_FACILITY' || code === 'INSURANCE_PROFESSIONAL';

export function logInput(code: FacilityItemCode, d: LogDraft): FacilityLogInput {
  return {
    itemCode: code,
    doneOn: d.doneOn,
    doneBy: d.doneBy,
    vendorName: orNull(d.vendorName),
    result: d.result,
    actionNote: orNull(d.actionNote),
    reportedOn: isFireCode(code) && d.reportedOn !== '' ? d.reportedOn : null,
    validUntil: isInsuranceCode(code) && d.validUntil !== '' ? d.validUntil : null,
    docLocation: orNull(d.docLocation),
  };
}

/** 저장을 막는 빠진 칸·틀린 칸 */
export function logBlockers(code: FacilityItemCode, d: LogDraft, today: string): string[] {
  const out: string[] = [];
  if (!isValidYmd(d.doneOn)) out.push('실시일을 골라 주세요');
  else if (d.doneOn > today) out.push('실시일은 오늘보다 뒤일 수 없습니다');
  if (isFireCode(code) && d.reportedOn !== '' && isValidYmd(d.doneOn)) {
    if (d.reportedOn < d.doneOn) out.push('소방 결과 보고일은 실시일 이후여야 합니다');
    else if (d.reportedOn > today) out.push('소방 결과 보고일은 오늘보다 뒤일 수 없습니다');
  }
  if (isInsuranceCode(code)) {
    if (!isValidYmd(d.validUntil)) out.push('보험 만기일을 골라 주세요');
    else if (isValidYmd(d.doneOn) && d.validUntil <= d.doneOn) out.push('보험 만기일은 실시일(가입·갱신일)보다 뒤여야 합니다');
  }
  return out;
}
