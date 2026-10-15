/**
 * 직원 복지(포상) 제공대장·평가 가산금 — 2026 직원권익향상 기준②③(research-10 §2). 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 기준③: 직원에게 분기별 1회 이상 복지를 제공하고 제공대장(제공일·수령인 서명·포상품)과 이체내역·영수증이 있다.
 * 회식·상장만 수여·후원품 증정은 불인정. 대표자 본인에게 준 것은 세지 않는다.
 * 기준②: 가산금을 받았다면 직원 처우개선에 쓴다. 80% 이상 사용 비율은 2026 평가종료월 다음 해부터라 참고로만 보인다(대조 필요).
 * 확인 못 한 것(대조 필요): 'OTHER 기타'의 인정 여부, 분기를 회계연도로 보는지(달력 분기로 셈).
 */
import { parseYmd } from './labDate.ts';
import { percentOneDecimal } from './percentRound.ts';
import type { BonusFund, StaffWelfare, WelfareKind } from './labTypes.ts';

export interface WelfareKindInfo {
  key: WelfareKind;
  label: string;
  recognized: boolean;
  /** 인정 여부를 원문과 대조해야 하는 종류 */
  check?: boolean;
}

export const WELFARE_KINDS: readonly WelfareKindInfo[] = [
  { key: 'GIFT_CARD', label: '상품권·현물', recognized: true },
  { key: 'BOOKS', label: '서적', recognized: true },
  { key: 'TRAINING', label: '교육·훈련비', recognized: true },
  { key: 'CLUB', label: '동호회', recognized: true },
  { key: 'MEDICAL', label: '의료비', recognized: true },
  { key: 'VACATION_PAY', label: '휴가비', recognized: true },
  { key: 'TRANSPORT', label: '교통비', recognized: true },
  { key: 'CLOTHING', label: '피복비', recognized: true },
  { key: 'VACCINE', label: '예방접종비', recognized: true },
  { key: 'INSURANCE', label: '단체(상해)보험', recognized: true },
  { key: 'REWARD_LEAVE', label: '포상휴가', recognized: true },
  { key: 'BONUS', label: '포상금', recognized: true },
  { key: 'HOLIDAY_GIFT', label: '명절선물', recognized: true },
  { key: 'SPECIAL_ALLOWANCE', label: '특별수당', recognized: true },
  { key: 'OTHER', label: '기타', recognized: true, check: true },
  { key: 'DINNER', label: '회식·간식', recognized: false },
  { key: 'PLAQUE_ONLY', label: '상장·상패만', recognized: false },
  { key: 'DONATED_GOODS', label: '후원품 증정', recognized: false },
];

export function welfareKindLabel(kind: string): string {
  return WELFARE_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

const isRecognized = (kind: string): boolean => WELFARE_KINDS.some((k) => k.key === kind && k.recognized);

type WelfareLike = Pick<StaffWelfare, 'givenOn' | 'kind' | 'signed' | 'recipientIsOwner' | 'evidenceLedgerId' | 'evidenceNote'>;

/** 인정 종류이고 수령인 서명이 있고 증빙(장부 기록 또는 보관 위치 글)이 있고 대표자 본인이 아니어야 분기 1회로 센다 */
export function welfareEntryOk(e: WelfareLike): boolean {
  const hasEvidence = (typeof e.evidenceLedgerId === 'number' && e.evidenceLedgerId > 0) || (typeof e.evidenceNote === 'string' && e.evidenceNote.trim() !== '');
  return isRecognized(e.kind) && e.signed === true && hasEvidence && e.recipientIsOwner !== true;
}

/** 'YYYY-MM-DD' → 'YYYY-Qn'. 올바른 날짜가 아니면 null */
export function quarterOf(date: string): string | null {
  const p = parseYmd(date);
  return p ? `${String(p.year).padStart(4, '0')}-Q${Math.floor((p.month - 1) / 3) + 1}` : null;
}

export type WelfareQuarterState = 'MET' | 'NOT_MET' | 'IN_PROGRESS';

export interface WelfareQuarter {
  quarter: string;
  entries: number;
  ok: number;
  state: WelfareQuarterState;
}

export interface WelfareQuarters {
  quarters: WelfareQuarter[];
  met: number;
  allMet: boolean;
}

/** 'YYYY-Qn' → 연속 번호(연×4+분기). 형식이 틀리면 null */
function quarterIndex(q: string | null): number | null {
  const m = q ? /^(\d{4})-Q([1-4])$/.exec(q) : null;
  return m ? Number(m[1]) * 4 + Number(m[2]) - 1 : null;
}

function quarterName(index: number): string {
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`.replace(/^(\d+)-/, (_, y: string) => `${y.padStart(4, '0')}-`);
}

/**
 * fromQuarter(기본 2026-Q1)부터 asOf가 든 분기까지 분기별 판정. 끝난 분기는 인정 제공 1건 이상이면 MET 아니면 NOT_MET,
 * asOf가 든 분기는 1건 이상이면 MET 아니면 IN_PROGRESS(아직 끝나지 않음). 그 범위 밖 제공은 세지 않는다.
 */
export function welfareQuarters(entries: readonly WelfareLike[], fromQuarter: string = '2026-Q1', asOf: string): WelfareQuarters {
  const from = quarterIndex(fromQuarter);
  const to = quarterIndex(quarterOf(asOf));
  if (from === null || to === null || to < from) return { quarters: [], met: 0, allMet: true };
  const quarters: WelfareQuarter[] = [];
  for (let i = from; i <= to; i += 1) {
    const name = quarterName(i);
    const inQuarter = entries.filter((e) => quarterOf(e.givenOn) === name);
    const ok = inQuarter.filter(welfareEntryOk).length;
    const state: WelfareQuarterState = ok >= 1 ? 'MET' : i < to ? 'NOT_MET' : 'IN_PROGRESS';
    quarters.push({ quarter: name, entries: inQuarter.length, ok, state });
  }
  return { quarters, met: quarters.filter((q) => q.state === 'MET').length, allMet: !quarters.some((q) => q.state === 'NOT_MET') };
}

export type BonusFundState = 'NOT_RECEIVED' | 'USED' | 'NOT_USED';

export interface BonusFundStatus {
  received: number;
  spent: number;
  ownerSpent: number;
  /** spent − ownerSpent */
  countedSpent: number;
  /** countedSpent / received × 100, 소수 첫째 자리. received 0이면 null — 80% 기준은 참고(대조 필요) */
  ratio: number | null;
  state: BonusFundState;
}

type FundLike = Pick<BonusFund, 'kind' | 'amount' | 'ownerUse'>;

const money = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/** 가산금 수령·사용 요약. 받은 적이 없으면 기준 충족 처리(NOT_RECEIVED), 받았으면 직원에게 쓴 금액(대표자 몫 제외)이 있는지 본다. */
export function bonusFundStatus(funds: readonly FundLike[]): BonusFundStatus {
  let received = 0;
  let spent = 0;
  let ownerSpent = 0;
  for (const f of funds) {
    if (f.kind === 'RECEIVED') received += money(f.amount);
    else if (f.kind === 'SPENT') {
      spent += money(f.amount);
      if (f.ownerUse) ownerSpent += money(f.amount);
    }
  }
  const countedSpent = spent - ownerSpent;
  const state: BonusFundState = received === 0 ? 'NOT_RECEIVED' : countedSpent > 0 ? 'USED' : 'NOT_USED';
  return { received, spent, ownerSpent, countedSpent, ratio: percentOneDecimal(countedSpent, received), state };
}

