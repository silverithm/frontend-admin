/** 송영 일지 입력 초안 — 이름표, 운행일지·차량 입력 검사, 저장 입력 만들기 */
import type { GuideMethod, TransportDirection, TransportLog, TransportLogInput, TransportRiderInput, TransportVehicle, TransportVehicleInput } from '@/lib/lab/labTypes';
import type { InsuranceStatus } from '@/lib/lab/transportRules';
import type { Tone } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { TIME_PATTERN, orNull } from './recordsFormat';

export const DIRECTION_LABEL: Record<TransportDirection, string> = { PICKUP: '등원', DROPOFF: '하원' };
export const METHOD_LABEL: Record<GuideMethod, string> = { FACE: '대면', PAPER: '서면', SMS: '문자', SNS: 'SNS', OTHER: '기타' };
export const METHOD_OPTIONS = (Object.keys(METHOD_LABEL) as GuideMethod[]).map((value) => ({ value, label: METHOD_LABEL[value] }));

export const INSURANCE_LABEL: Record<InsuranceStatus, string> = {
  MISSING: '보험 정보 없음',
  NOT_COMPREHENSIVE: '종합보험 아님',
  NOT_STARTED: '보험 시작 전',
  EXPIRED: '보험 만료',
  EXPIRING: '곧 만료',
  OK: '정상',
};
export const INSURANCE_TONE: Record<InsuranceStatus, Tone> = {
  MISSING: 'warn',
  NOT_COMPREHENSIVE: 'danger',
  NOT_STARTED: 'warn',
  EXPIRED: 'danger',
  EXPIRING: 'warn',
  OK: 'ok',
};

export const MAX_RIDERS = 30;
export const RIDER_NOTE_MAX = 100;
export const LOG_NOTE_MAX = 300;
export const VEHICLE_NO_MAX = 20;
export const DRIVER_KEY = 'carev.lab.transport.driver';
export const ESCORT_KEY = 'carev.lab.transport.escort';

export interface RiderDraft {
  elderlyId: number;
  name: string;
  boarded: boolean;
  boardTime: string;
  alightTime: string;
  note: string;
}

export interface LogDraft {
  driverId: number | null;
  escortId: number | null;
  departTime: string;
  arriveTime: string;
  riders: RiderDraft[];
  note: string;
}

export function newRider(elderlyId: number, name: string): RiderDraft {
  return { elderlyId, name, boarded: true, boardTime: '', alightTime: '', note: '' };
}

export function draftFromLog(log: TransportLog): LogDraft {
  return {
    driverId: log.driverMemberId,
    escortId: log.escortMemberId,
    departTime: log.departTime ?? '',
    arriveTime: log.arriveTime ?? '',
    riders: log.riders.map((r) => ({ elderlyId: r.elderlyId, name: r.elderlyName, boarded: r.boarded, boardTime: r.boardTime ?? '', alightTime: r.alightTime ?? '', note: r.note ?? '' })),
    note: log.note ?? '',
  };
}

export function validateLog(d: LogDraft, date: string, vehicleNo: string): string | null {
  if (date === '') return '운행 날짜를 골라 주세요';
  if (date > todayString()) return '오늘 이후 날짜는 기록할 수 없습니다';
  if (vehicleNo.trim() === '') return '차량을 골라 주세요';
  if (d.driverId === null) return '운전원을 골라 주세요';
  if (d.escortId !== null && d.escortId === d.driverId) return '운전원과 동승자는 다른 직원이어야 합니다';
  for (const [label, value] of [['출발', d.departTime], ['도착', d.arriveTime]] as const) {
    if (value !== '' && !TIME_PATTERN.test(value)) return `${label} 시각은 14:30처럼 24시간제로 적어 주세요`;
  }
  if (d.departTime !== '' && d.arriveTime !== '' && d.arriveTime < d.departTime) return '도착 시각은 출발 시각보다 빠를 수 없습니다';
  if (d.riders.length === 0) return '탑승자를 한 명 이상 골라 주세요';
  if (d.riders.length > MAX_RIDERS) return `탑승자는 ${MAX_RIDERS}명까지 적을 수 있습니다`;
  for (const r of d.riders) {
    if (!r.boarded) continue;
    for (const v of [r.boardTime, r.alightTime]) {
      if (v !== '' && !TIME_PATTERN.test(v)) return `${r.name}님의 승하차 시각은 14:30처럼 24시간제로 적어 주세요`;
    }
  }
  return null;
}

export function logInput(d: LogDraft, date: string, direction: TransportDirection, vehicleNo: string): TransportLogInput {
  const riders: TransportRiderInput[] = d.riders.map((r) => ({
    elderlyId: r.elderlyId,
    boarded: r.boarded,
    // 타지 않은 분의 시각은 남기지 않는다
    boardTime: r.boarded ? orNull(r.boardTime) : null,
    alightTime: r.boarded ? orNull(r.alightTime) : null,
    note: orNull(r.note),
  }));
  return {
    runDate: date,
    direction,
    vehicleNo: vehicleNo.trim(),
    driverMemberId: d.driverId as number,
    escortMemberId: d.escortId,
    departTime: orNull(d.departTime),
    arriveTime: orNull(d.arriveTime),
    riders,
    note: orNull(d.note),
  };
}

export interface VehicleDraft {
  vehicleNo: string;
  label: string;
  insurer: string;
  policyNo: string;
  insuranceFrom: string;
  insuranceTo: string;
  comprehensive: boolean;
  active: boolean;
  note: string;
}

export function emptyVehicleDraft(): VehicleDraft {
  return { vehicleNo: '', label: '', insurer: '', policyNo: '', insuranceFrom: '', insuranceTo: '', comprehensive: true, active: true, note: '' };
}

export function vehicleDraftOf(v: TransportVehicle): VehicleDraft {
  return {
    vehicleNo: v.vehicleNo,
    label: v.label ?? '',
    insurer: v.insurer ?? '',
    policyNo: v.policyNo ?? '',
    insuranceFrom: v.insuranceFrom ? v.insuranceFrom.slice(0, 10) : '',
    insuranceTo: v.insuranceTo ? v.insuranceTo.slice(0, 10) : '',
    comprehensive: v.comprehensive,
    active: v.active,
    note: v.note ?? '',
  };
}

export function validateVehicle(d: VehicleDraft, others: ReadonlyArray<TransportVehicle>, editingId: number | null): string | null {
  if (d.vehicleNo.trim() === '') return '차량 번호를 적어 주세요';
  if (others.some((v) => v.id !== editingId && v.vehicleNo.replace(/\s/g, '') === d.vehicleNo.replace(/\s/g, ''))) return '이미 등록된 차량 번호입니다';
  if ((d.insuranceFrom === '') !== (d.insuranceTo === '') ) return '보험 시작일과 만기일을 함께 넣어 주세요';
  if (d.insuranceFrom !== '' && d.insuranceTo < d.insuranceFrom) return '보험 만기일은 시작일보다 빠를 수 없습니다';
  return null;
}

export function vehicleInput(d: VehicleDraft): TransportVehicleInput {
  return {
    vehicleNo: d.vehicleNo.trim(),
    label: orNull(d.label),
    insurer: orNull(d.insurer),
    policyNo: orNull(d.policyNo),
    insuranceFrom: orNull(d.insuranceFrom),
    insuranceTo: orNull(d.insuranceTo),
    comprehensive: d.comprehensive,
    active: d.active,
    note: orNull(d.note),
  };
}
