/**
 * 송영(이동서비스) 규칙 — 차량 보험 상태·수칙 제공 범위·운행표 제공·운행일지 작성률. 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-10, 2026 지표 28·고시 제34조④): 이동서비스 수칙에는 운전자 자격요건·동승자의 역할·차량안전수칙·사고 시 조치사항이 들어가고,
 * 수칙을 수급자·보호자에게 제공하며 수칙이 바뀌면 다시 제공한다. 차량은 자동차종합보험이어야 하고 책임보험만으로는 인정되지 않는다.
 * 확인 못 한 것(대조 필요): 이동서비스 일지의 공단 정식 서식, 운행표 제공 주기(월 1회는 기관 기준), 송영을 쓰지 않는 수급자에게 수칙을 줘야 하는지.
 */
import { addDays, daysBetween, isValidYmd } from './labDate.ts';
import { percentOneDecimal } from './percentRound.ts';
import type { GuideKind } from './labTypes.ts';

export const TRANSPORT_RULE_ITEMS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'driverQualification', label: '운전자 자격요건' },
  { key: 'escortRole', label: '동승자의 역할' },
  { key: 'vehicleSafety', label: '차량안전수칙' },
  { key: 'accidentResponse', label: '사고 시 조치사항' },
];

/** 만기가 이 일수 안으로 다가오면 '곧 만료' */
export const INSURANCE_EXPIRING_DAYS = 30;

export type InsuranceStatus = 'MISSING' | 'NOT_COMPREHENSIVE' | 'NOT_STARTED' | 'EXPIRED' | 'EXPIRING' | 'OK';

export interface InsuranceVehicle {
  insuranceFrom: string | null;
  insuranceTo: string | null;
  comprehensive: boolean;
}

/** 이 순서로 판정한다: 기록 없음 → 종합보험 아님 → 시작 전 → 만료 → 곧 만료(만기까지 30일 이하, 당일 포함) → 정상 */
export function insuranceStatus(vehicle: InsuranceVehicle, asOf: string): InsuranceStatus {
  const day = asOf.slice(0, 10);
  if (!vehicle.insuranceFrom || !vehicle.insuranceTo || !isValidYmd(vehicle.insuranceFrom) || !isValidYmd(vehicle.insuranceTo)) return 'MISSING';
  if (!vehicle.comprehensive) return 'NOT_COMPREHENSIVE';
  const from = vehicle.insuranceFrom.slice(0, 10);
  const to = vehicle.insuranceTo.slice(0, 10);
  if (day < from) return 'NOT_STARTED';
  if (day > to) return 'EXPIRED';
  const left = daysBetween(day, to);
  return left !== null && left <= INSURANCE_EXPIRING_DAYS ? 'EXPIRING' : 'OK';
}

export interface DeliveryShape {
  elderlyId: number;
  kind: GuideKind;
  deliveredOn: string;
}

export interface RuleDeliveryCoverage {
  total: number;
  delivered: number;
  /** 입력 순서대로 */
  missing: number[];
}

/** 수칙 제공 범위: 수칙 제공일이 rulesRevisedOn 이상이면(개정일이 없으면 아무 때나) 제공된 것 — 수칙이 바뀌면 다시 제공해야 한다 */
export function ruleDeliveryCoverage(riderElderIds: readonly number[], deliveries: readonly DeliveryShape[], rulesRevisedOn: string | null): RuleDeliveryCoverage {
  const ids = [...new Set(riderElderIds)];
  const since = rulesRevisedOn && isValidYmd(rulesRevisedOn) ? rulesRevisedOn.slice(0, 10) : null;
  const got = new Set<number>();
  for (const d of deliveries) {
    if (d.kind !== 'TRANSPORT_RULES' || !isValidYmd(d.deliveredOn)) continue;
    if (since === null || d.deliveredOn.slice(0, 10) >= since) got.add(d.elderlyId);
  }
  const missing = ids.filter((id) => !got.has(id));
  return { total: ids.length, delivered: ids.length - missing.length, missing };
}

export interface TimetableMonths {
  covered: number;
  byMonth: Array<{ month: string; count: number }>;
}

/** 운행표(TIMETABLE) 제공이 1건 이상 있는 달 수. months는 'YYYY-MM' */
export function timetableMonths(deliveries: readonly DeliveryShape[], months: readonly string[]): TimetableMonths {
  const counts = new Map<string, number>();
  for (const d of deliveries) {
    if (d.kind !== 'TIMETABLE' || !isValidYmd(d.deliveredOn)) continue;
    const m = d.deliveredOn.slice(0, 7);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  const byMonth = [...new Set(months)].map((month) => ({ month, count: counts.get(month) ?? 0 }));
  return { covered: byMonth.filter((m) => m.count > 0).length, byMonth };
}

export interface LogShape {
  runDate: string;
  driverMemberId: number | null;
  riders: ReadonlyArray<{ elderlyId: number; boarded: boolean }>;
}

export interface TransportLogCoverage {
  /** 그 달 출석 날 수 */
  days: number;
  /** 일지가 1건 이상인 날 */
  logged: number;
  /** 그날 일지가 모두 운전원이 있고 탑승자가 1명 이상인 날 */
  complete: number;
  /** logged / days, 소수 첫째 자리. days 0이면 null */
  rate: number | null;
}

/** 운행일지 작성률. attendanceDates는 어르신 한 명이 아니라 '출석이 있었던 날짜'(중복은 한 번으로 센다), month는 'YYYY-MM' */
export function transportLogCoverage(logs: readonly LogShape[], attendanceDates: readonly string[], month: string): TransportLogCoverage {
  const days = [...new Set(attendanceDates.filter((d) => isValidYmd(d) && d.slice(0, 7) === month).map((d) => d.slice(0, 10)))];
  const byDate = new Map<string, LogShape[]>();
  for (const l of logs) {
    if (!isValidYmd(l.runDate)) continue;
    const d = l.runDate.slice(0, 10);
    const list = byDate.get(d);
    if (list) list.push(l);
    else byDate.set(d, [l]);
  }
  let logged = 0;
  let complete = 0;
  for (const d of days) {
    const list = byDate.get(d);
    if (!list || list.length === 0) continue;
    logged += 1;
    if (list.every((l) => l.driverMemberId !== null && l.driverMemberId > 0 && l.riders.some((r) => r.boarded))) complete += 1;
  }
  return { days: days.length, logged, complete, rate: percentOneDecimal(logged, days.length) };
}

/** from~to(양 끝 포함) 사이에 한 번이라도 탑승(boarded=true)한 어르신 id — 중복 없이 오름차순 */
export function ridersBetween(logs: readonly LogShape[], from: string, to: string): number[] {
  const ids = new Set<number>();
  for (const l of logs) {
    if (!isValidYmd(l.runDate)) continue;
    const d = l.runDate.slice(0, 10);
    if (d < from.slice(0, 10) || d > to.slice(0, 10)) continue;
    for (const r of l.riders) if (r.boarded) ids.add(r.elderlyId);
  }
  return [...ids].sort((a, b) => a - b);
}

/** asOf가 속한 달부터 거슬러 올라간 'YYYY-MM' count개를 오래된 달부터 돌려준다 — 화면이 운행표 제공 달 목록(최근 3개월)을 만들 때 쓴다. 날짜가 올바르지 않으면 빈 목록 */
export function recentMonths(asOf: string, count: number): string[] {
  if (!isValidYmd(asOf)) return [];
  const first = `${asOf.slice(0, 7)}-01`;
  const out: string[] = [];
  let cursor = first;
  for (let i = 0; i < count; i += 1) {
    out.push(cursor.slice(0, 7));
    const prev = addDays(cursor, -1);
    if (prev === null) break;
    cursor = `${prev.slice(0, 7)}-01`;
  }
  return out.reverse();
}
