/**
 * 수급자 서류함 규칙(순수 함수).
 *
 * 근거(research-8.md 3절)
 *  - 노인장기요양보험법 시행규칙 제27조제4항: 급여계약 서류·청구서·급여제공기록지 등 급여비용 산정에 필요한 서류는 급여가 끝난 날부터 5년간 보존한다.
 *  - 2026 평가는 "서류 구비 목록" 지표가 따로 없고 지표 17·19·20·21·22·23·28·30·34에 흩어져 있다.
 *
 * ⚠ 대조 필요: REQUIRED_DOCS는 법정 목록이 아니라 평가·운영 기준을 묶은 기관 점검표다. 인정서·이용계획서 사본 보관 의무와
 * 개인정보 동의서의 서식·보존기간은 규정에서 못 찾았다. 보존 기산점이 서류별로 다른지도 공단 지침 대조가 필요하다.
 */
import type { ElderDocType } from './labTypes.ts';
import { daysInMonth, formatYmd, isValidYmd, parseYmd } from './labDate.ts';

/** 다른 기록(계약·급여제공계획·위험도·인권 안내)이 있으면 서류를 올리지 않아도 갖춘 것으로 보는 근거 */
export type ElderDocAuto = 'contract' | 'carePlan' | 'risk' | 'rightsGuide';

export interface RequiredDoc {
  docType: ElderDocType;
  label: string;
  auto: ElderDocAuto | null;
}

export const REQUIRED_DOCS: readonly RequiredDoc[] = [
  { docType: 'CONTRACT', label: '급여계약서', auto: 'contract' },
  { docType: 'RECOGNITION', label: '장기요양인정서 사본', auto: null },
  { docType: 'USE_PLAN', label: '개인별장기요양이용계획서 사본', auto: null },
  { docType: 'NEEDS_ASSESSMENT', label: '욕구사정 기록', auto: 'carePlan' },
  { docType: 'CARE_PLAN', label: '급여제공계획서', auto: 'carePlan' },
  { docType: 'PRIVACY_CONSENT', label: '개인정보 수집·이용 동의서', auto: null },
  { docType: 'RIGHTS_GUIDE', label: '노인인권 지침 안내', auto: 'rightsGuide' },
  { docType: 'RISK_ASSESSMENT', label: '위험도 평가', auto: 'risk' },
];

export const ELDER_DOC_TYPES: ReadonlyArray<{ value: ElderDocType; label: string }> = [
  ...REQUIRED_DOCS.map((d) => ({ value: d.docType, label: d.label })),
  { value: 'OTHER', label: '기타 서류' },
];

export function elderDocTypeLabel(docType: string): string {
  return ELDER_DOC_TYPES.find((d) => d.value === docType)?.label ?? docType;
}

export const MAX_DOC_TITLE = 100;
export const MAX_DOC_LOCATION = 100;
export const MAX_DOC_NOTE = 500;

/** 급여가 끝난 날부터 보존해야 하는 햇수 (시행규칙 제27조제4항) */
export const RETENTION_YEARS = 5;

export type ElderDocStatusKind = 'OK' | 'AUTO' | 'EXPIRED' | 'MISSING';

export interface ElderDocLike {
  docType: string;
  expiresOn?: string | null;
}

export interface ElderDocStatusRow<T extends ElderDocLike = ElderDocLike> {
  docType: ElderDocType;
  label: string;
  status: ElderDocStatusKind;
  /** OK이면 유효한 기록(만료일이 가장 먼 것), EXPIRED이면 가장 최근에 만료된 기록, 그 밖에는 null */
  doc: T | null;
}

export interface ElderDocBasis {
  hasContract: boolean;
  hasCarePlan: boolean;
  hasRisk: boolean;
  rightsGuided: boolean;
}

function autoBasis(auto: ElderDocAuto | null, basis: ElderDocBasis): boolean {
  if (auto === 'contract') return basis.hasContract;
  if (auto === 'carePlan') return basis.hasCarePlan;
  if (auto === 'risk') return basis.hasRisk;
  if (auto === 'rightsGuide') return basis.rightsGuided;
  return false;
}

/** 만료일이 오늘보다 앞이면 만료(만료일 당일까지는 유효). 만료일이 없거나 날짜가 아니면 만료 없음 */
export function isDocExpired(expiresOn: string | null | undefined, today: string): boolean {
  if (!isValidYmd(expiresOn)) return false;
  const p = parseYmd(expiresOn)!;
  return formatYmd(p.year, p.month, p.day) < today;
}

function expiryKey(doc: ElderDocLike): string {
  const p = parseYmd(doc.expiresOn ?? null);
  return p ? formatYmd(p.year, p.month, p.day) : '9999-12-31';
}

/**
 * 어르신 한 명의 서류 갖춤 현황. 서류 기록이 있고 만료 전이면 OK, 기록은 있는데 모두 만료면 EXPIRED,
 * 기록이 없어도 다른 기록(계약·급여제공계획·위험도·인권 안내)이 있으면 AUTO, 둘 다 없으면 MISSING.
 */
export function elderDocStatus<T extends ElderDocLike>(
  input: ElderDocBasis & { docs: readonly T[] },
  today: string,
): Array<ElderDocStatusRow<T>> {
  return REQUIRED_DOCS.map((req) => {
    const records = input.docs.filter((d) => d.docType === req.docType);
    const valid = records.filter((d) => !isDocExpired(d.expiresOn, today)).sort((a, b) => (expiryKey(b) < expiryKey(a) ? -1 : expiryKey(b) > expiryKey(a) ? 1 : 0));
    if (valid.length > 0) return { docType: req.docType, label: req.label, status: 'OK' as const, doc: valid[0] };
    if (records.length > 0) {
      const latest = [...records].sort((a, b) => (expiryKey(b) < expiryKey(a) ? -1 : expiryKey(b) > expiryKey(a) ? 1 : 0))[0];
      return { docType: req.docType, label: req.label, status: 'EXPIRED' as const, doc: latest };
    }
    if (autoBasis(req.auto, input)) return { docType: req.docType, label: req.label, status: 'AUTO' as const, doc: null };
    return { docType: req.docType, label: req.label, status: 'MISSING' as const, doc: null };
  });
}

/** 보존 기한 = 급여 종료일 + 5년 (2월 29일은 평년으로 가면 2월 28일). 날짜가 올바르지 않으면 null */
export function retentionUntil(endDate: string): string | null {
  const p = parseYmd(endDate);
  if (!p) return null;
  const year = p.year + RETENTION_YEARS;
  return formatYmd(year, p.month, Math.min(p.day, daysInMonth(year, p.month)));
}

export interface EndedContractLike {
  status: string;
  contractEnd: string | null;
}

/** 보존 기한이 지난(파기 대상) 종료 계약, 오래된 것부터. 보존 기한 당일까지는 보존한다 */
export function destroyCandidates<T extends EndedContractLike>(contracts: readonly T[], today: string): T[] {
  return contracts
    .filter((c) => {
      if (c.status !== 'ENDED' || !c.contractEnd) return false;
      const until = retentionUntil(c.contractEnd);
      return until !== null && until < today;
    })
    .sort((a, b) => (a.contractEnd! < b.contractEnd! ? -1 : a.contractEnd! > b.contractEnd! ? 1 : 0));
}
