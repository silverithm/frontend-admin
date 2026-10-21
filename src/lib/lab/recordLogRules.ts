/**
 * 종류별 기록 규칙 — 업무수행일지(프로그램 관리자·선임 요양보호사), 시설운영일지, 수급자 안전관리 설명(연 1회), 현금영수증 발행.
 *
 * 출처: 케어포 공개 사이트의 주야간보호급여 메뉴 목차(프로그램관리자 업무수행일지, 선임 요양보호사 업무수행일지,
 * 시설운영일지, 수급자 안전관리 설명 연 1회, 현금영수증 발행). 칸 구성은 기관 자체 서식이며 고시·평가 매뉴얼의
 * 필수 항목은 확인하지 못했다(대조 필요). 서버 규칙(LabRecordLogService.KINDS)과 같은 항목·필수 조건을 쓴다.
 */
import { isValidYmd } from './labDate.ts';
import type { RecordLog, RecordLogInput, RecordLogKind } from './labTypes.ts';

export const MAX_LOG_BODY = 2000;
export const MAX_LOG_ACTION = 1000;
export const MAX_LOG_EXTRA = 100;
export const MAX_LOG_AUTHOR = 50;
export const MAX_LOG_AMOUNT = 1_000_000_000;

export interface LogCheck {
  value: string;
  label: string;
}

export interface RecordLogKindRule {
  kind: RecordLogKind;
  /** 도구·표 제목 */
  label: string;
  /** 수급자별 기록인가(어르신을 고른다) */
  perElder: boolean;
  bodyRequired: boolean;
  bodyLabel: string;
  bodyPlaceholder: string;
  hasAmount: boolean;
  hasExtra: boolean;
  /** 허용 확인 항목 — 화면에 보이는 순서이며 서버도 이 순서로 정리해 저장한다 */
  checks: LogCheck[];
  checksLabel: string;
  /** 항목 묶음 중 하나 이상(예: 안전관리 설명의 설명 항목·대상). 묶음 이름은 오류 문장에 쓴다 */
  requiredGroups: Array<{ name: string; values: string[] }>;
  /** 항목을 정확히 하나만 골라야 하는가(현금영수증 구분) */
  exactlyOne: boolean;
  /** 인쇄본 제목 */
  printTitle: string;
}

export const RECORD_LOG_KINDS: Record<RecordLogKind, RecordLogKindRule> = {
  PROGRAM_MANAGER_LOG: {
    kind: 'PROGRAM_MANAGER_LOG',
    label: '프로그램 관리자 업무수행일지',
    perElder: false,
    bodyRequired: true,
    bodyLabel: '수행한 업무',
    bodyPlaceholder: '예: 오늘 인지활동형 프로그램 제공 현황을 확인하고, 5등급 수급자 3명의 참여 여부를 점검함',
    hasAmount: false,
    hasExtra: false,
    checks: [
      { value: 'PROGRAM_PLAN', label: '프로그램 계획·일정 확인' },
      { value: 'COGNITIVE_CHECK', label: '인지활동형 제공 확인(5등급·인지지원)' },
      { value: 'PROVIDER_CHECK', label: '제공자·자격 확인' },
      { value: 'OPINION', label: '의견수렴·반영 점검' },
      { value: 'RECORD_REVIEW', label: '제공기록 검토' },
    ],
    checksLabel: '오늘 한 일',
    requiredGroups: [],
    exactlyOne: false,
    printTitle: '프로그램 관리자 업무수행일지',
  },
  SENIOR_CAREGIVER_LOG: {
    kind: 'SENIOR_CAREGIVER_LOG',
    label: '선임 요양보호사 업무수행일지',
    perElder: false,
    bodyRequired: true,
    bodyLabel: '수행한 업무',
    bodyPlaceholder: '예: 오전 요양보호사 4명의 이동·식사 도움 방법을 현장에서 지도하고 낙상 위험 수급자를 점검함',
    hasAmount: false,
    hasExtra: false,
    checks: [
      { value: 'FIELD_GUIDE', label: '요양보호사 현장 지도' },
      { value: 'STATUS_CHECK', label: '수급자 상태 점검' },
      { value: 'NOTICE', label: '전달 사항 안내' },
      { value: 'EDUCATION', label: '업무 교육' },
      { value: 'RECORD_REVIEW', label: '기록 점검' },
    ],
    checksLabel: '오늘 한 일',
    requiredGroups: [],
    exactlyOne: false,
    printTitle: '선임 요양보호사 업무수행일지',
  },
  FACILITY_DIARY: {
    kind: 'FACILITY_DIARY',
    label: '시설운영일지',
    perElder: false,
    bodyRequired: true,
    bodyLabel: '운영 내용·특이사항',
    bodyPlaceholder: '예: 정상 운영. 오후 2시 소방 점검업체 방문, 비상구 표지 교체 일정 협의',
    hasAmount: false,
    hasExtra: false,
    checks: [
      { value: 'OPENING', label: '개소·시설 점검' },
      { value: 'SANITATION', label: '소독·위생' },
      { value: 'FIRE_SAFETY', label: '소방·안전' },
      { value: 'MEAL', label: '급식·식단' },
      { value: 'VISITOR', label: '방문·민원 있음' },
      { value: 'TRANSPORT', label: '송영 운행' },
    ],
    checksLabel: '오늘 확인한 것',
    requiredGroups: [],
    exactlyOne: false,
    printTitle: '시설운영일지',
  },
  SAFETY_BRIEFING: {
    kind: 'SAFETY_BRIEFING',
    label: '수급자 안전관리 설명',
    perElder: true,
    bodyRequired: false,
    bodyLabel: '설명한 내용 (선택)',
    bodyPlaceholder: '예: 미끄러운 바닥과 화장실 이용 때 낙상 주의, 차량 승하차 시 안전벨트 착용을 설명드림',
    hasAmount: false,
    hasExtra: false,
    checks: [
      { value: 'FALL', label: '낙상 예방' },
      { value: 'BEDSORE', label: '욕창 예방' },
      { value: 'INFECTION', label: '감염 예방' },
      { value: 'EMERGENCY', label: '응급상황 대처' },
      { value: 'TRANSPORT', label: '이동서비스(차량) 수칙' },
      { value: 'MEDICATION', label: '투약 안전' },
      { value: 'TO_ELDER', label: '수급자에게 설명' },
      { value: 'TO_GUARDIAN', label: '보호자에게 설명' },
    ],
    checksLabel: '설명한 항목과 대상',
    requiredGroups: [
      { name: '설명한 안전 항목', values: ['FALL', 'BEDSORE', 'INFECTION', 'EMERGENCY', 'TRANSPORT', 'MEDICATION'] },
      { name: '설명한 대상(수급자·보호자)', values: ['TO_ELDER', 'TO_GUARDIAN'] },
    ],
    exactlyOne: false,
    printTitle: '수급자 안전관리 설명 확인서',
  },
  CASH_RECEIPT: {
    kind: 'CASH_RECEIPT',
    label: '현금영수증 발행',
    perElder: true,
    bodyRequired: false,
    bodyLabel: '비고 (선택)',
    bodyPlaceholder: '예: 10월분 본인부담금 현금영수증, 보호자 휴대폰번호로 발행',
    hasAmount: true,
    hasExtra: true,
    checks: [
      { value: 'INCOME_DEDUCTION', label: '소득공제용' },
      { value: 'EXPENSE_PROOF', label: '지출증빙용' },
    ],
    checksLabel: '발행 구분',
    requiredGroups: [],
    exactlyOne: true,
    printTitle: '현금영수증 발행 대장',
  },
};

/** 낱말 끝 글자의 받침에 맞춰 조사를 붙인다(괄호·기호는 건너뛰고 마지막 한글 글자를 본다). 예: 업무+을/를 → 업무를 */
export function josa(word: string, withBatchim: '을' | '이', withoutBatchim: '를' | '가'): string {
  // 괄호 안 설명은 건너뛰고 괄호 앞 낱말의 받침을 본다("대상(수급자·보호자)" → 대상)
  const bare = word.replace(/\([^)]*\)/g, '');
  for (let i = bare.length - 1; i >= 0; i -= 1) {
    const code = bare.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) return `${word}${(code - 0xac00) % 28 !== 0 ? withBatchim : withoutBatchim}`;
  }
  return `${word}${withoutBatchim}`;
}

export const SAFETY_TOPICS: readonly string[] = ['FALL', 'BEDSORE', 'INFECTION', 'EMERGENCY', 'TRANSPORT', 'MEDICATION'];

export function checkLabel(kind: RecordLogKind, code: string): string {
  return RECORD_LOG_KINDS[kind].checks.find((c) => c.value === code)?.label ?? code;
}

/** 허용 항목 순서로 정리(중복·허용 밖 값 제거) — 화면 상태를 서버가 저장할 모양으로 */
export function normalizeChecks(kind: RecordLogKind, chosen: ReadonlyArray<string>): string[] {
  const set = new Set(chosen);
  return RECORD_LOG_KINDS[kind].checks.map((c) => c.value).filter((v) => set.has(v));
}

export interface RecordLogDraft {
  entryDate: string;
  elderId: number | null;
  author: string;
  checks: string[];
  body: string;
  action: string;
  extra: string;
  /** 금액 칸 — 숫자 또는 비어 있음 */
  amount: number | null;
}

export function newRecordLogDraft(today: string, author = ''): RecordLogDraft {
  return { entryDate: today, elderId: null, author, checks: [], body: '', action: '', extra: '', amount: null };
}

export function draftFromRecordLog(log: RecordLog): RecordLogDraft {
  return {
    entryDate: log.entryDate.slice(0, 10),
    elderId: log.elderlyId,
    author: log.authorName,
    checks: [...log.checks],
    body: log.body ?? '',
    action: log.action ?? '',
    extra: log.extra ?? '',
    amount: log.amount,
  };
}

/** 저장 전에 고쳐야 할 점(문장 목록). 서버가 400으로 돌려줄 것을 먼저 알려 준다 */
export function recordLogProblems(kind: RecordLogKind, d: RecordLogDraft, today: string): string[] {
  const rule = RECORD_LOG_KINDS[kind];
  const out: string[] = [];
  if (!isValidYmd(d.entryDate)) out.push('기록일을 골라 주세요');
  else if (d.entryDate > today) out.push('기록일은 오늘 이후일 수 없습니다');
  if (rule.perElder && d.elderId === null) out.push('어르신을 골라 주세요');
  if (d.author.trim() === '') out.push('작성자 이름을 적어 주세요');
  const checks = normalizeChecks(kind, d.checks);
  if (rule.exactlyOne && checks.length !== 1) out.push(`${josa(rule.checksLabel, '을', '를')} 하나 골라 주세요`);
  for (const group of rule.requiredGroups) {
    if (!group.values.some((v) => checks.includes(v))) out.push(`${josa(group.name, '을', '를')} 하나 이상 골라 주세요`);
  }
  if (rule.bodyRequired && d.body.trim() === '') out.push(`${josa(rule.bodyLabel, '을', '를')} 적어 주세요`);
  if (rule.hasAmount) {
    if (d.amount === null || d.amount < 1) out.push('금액을 1원 이상으로 적어 주세요');
    else if (d.amount > MAX_LOG_AMOUNT) out.push('금액이 너무 큽니다');
  }
  return out;
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export function recordLogInput(kind: RecordLogKind, d: RecordLogDraft): RecordLogInput {
  const rule = RECORD_LOG_KINDS[kind];
  return {
    kind,
    entryDate: d.entryDate,
    elderlyId: rule.perElder ? d.elderId : null,
    authorName: d.author.trim().slice(0, MAX_LOG_AUTHOR),
    checks: normalizeChecks(kind, d.checks),
    body: orNull(d.body)?.slice(0, MAX_LOG_BODY) ?? null,
    action: orNull(d.action)?.slice(0, MAX_LOG_ACTION) ?? null,
    extra: rule.hasExtra ? orNull(d.extra)?.slice(0, MAX_LOG_EXTRA) ?? null : null,
    amount: rule.hasAmount ? d.amount : null,
  };
}

/** 원 단위 금액을 "85,000원"으로 */
export function formatWon(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('ko-KR')}원` : '-';
}

// ---------- 수급자 안전관리 설명(연 1회) 현황 ----------

export interface BriefingStatusRow {
  elderlyId: number;
  elderlyName: string;
  /** 그 해의 가장 최근 설명 기록일. 없으면 null */
  lastOn: string | null;
  count: number;
}

/**
 * 수급자별로 그 해에 안전관리 설명을 했는지. 설명 안 한 수급자를 앞에, 이름순으로 둔다.
 * 기록은 그 해 것만 넘기면 되고, 다른 연도 기록이 섞여 있으면 거른다.
 */
export function briefingStatus(
  elders: ReadonlyArray<{ id: number; name: string }>,
  logs: ReadonlyArray<Pick<RecordLog, 'elderlyId' | 'entryDate'>>,
  year: number,
): BriefingStatusRow[] {
  const latest = new Map<number, { on: string; count: number }>();
  for (const log of logs) {
    if (log.elderlyId === null || Number(log.entryDate.slice(0, 4)) !== year) continue;
    const day = log.entryDate.slice(0, 10);
    const cur = latest.get(log.elderlyId);
    latest.set(log.elderlyId, { on: cur && cur.on > day ? cur.on : day, count: (cur?.count ?? 0) + 1 });
  }
  return elders
    .map((e) => ({ elderlyId: e.id, elderlyName: e.name, lastOn: latest.get(e.id)?.on ?? null, count: latest.get(e.id)?.count ?? 0 }))
    .sort((a, b) => Number(a.lastOn !== null) - Number(b.lastOn !== null) || a.elderlyName.localeCompare(b.elderlyName, 'ko'));
}

/** 설명을 안 한 수급자 수 */
export function briefingMissing(rows: ReadonlyArray<BriefingStatusRow>): number {
  return rows.filter((r) => r.lastOn === null).length;
}

// ---------- 현금영수증 월 합계 ----------

export function receiptTotal(logs: ReadonlyArray<Pick<RecordLog, 'amount'>>): number {
  return logs.reduce((sum, l) => sum + (typeof l.amount === 'number' ? l.amount : 0), 0);
}
