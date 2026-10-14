/** 어르신 한 명의 서류 갖춤 계산 — 서류 기록과 자동 근거(계약·급여계획·위험도·인권 안내)를 elderDocStatus에 넘긴다. */
import { elderDocStatus } from '@/lib/lab/elderDocRules';
import type { ElderDocAuto, ElderDocStatusKind, ElderDocStatusRow } from '@/lib/lab/elderDocRules';
import type { CarePlan, ElderContract, ElderDocument, RiskLatest } from '@/lib/lab/labTypes';
import { expiryState } from './ElderDocsDraft';

export interface ElderDocsSource {
  docs: ElderDocument[];
  contracts: ElderContract[];
  plans: CarePlan[];
  risk: RiskLatest[];
}

export function statusRowsOf(elderId: number, src: ElderDocsSource, today: string): Array<ElderDocStatusRow<ElderDocument>> {
  const active = src.contracts.filter((c) => c.elderlyId === elderId && c.status === 'ACTIVE');
  const risk = src.risk.find((r) => r.elderlyId === elderId);
  return elderDocStatus(
    {
      docs: src.docs.filter((d) => d.elderlyId === elderId),
      hasContract: active.length > 0,
      hasCarePlan: src.plans.some((p) => p.elderlyId === elderId),
      hasRisk: !!risk && (risk.braden !== null || risk.morse !== null || (risk.cognitive ?? null) !== null),
      rightsGuided: active.some((c) => !!c.rightsGuidedOn),
    },
    today,
  );
}

export const STATUS_LABEL: Record<ElderDocStatusKind, string> = { OK: '갖춤', AUTO: '자동', EXPIRED: '만료', MISSING: '없음' };

export const AUTO_LABEL: Record<ElderDocAuto, string> = {
  contract: '급여 계약 기록이 있어 갖춘 것으로 봅니다',
  carePlan: '올해 급여계획 기록이 있어 갖춘 것으로 봅니다',
  risk: '위험도 평가 기록이 있어 갖춘 것으로 봅니다',
  rightsGuide: '계약에 노인인권 지침 안내일이 있어 갖춘 것으로 봅니다',
};

/** 인쇄 점검표 '제목·근거' 칸에 적는 짧은 근거 이름 */
export const AUTO_SHORT: Record<ElderDocAuto, string> = {
  contract: '급여 계약 기록',
  carePlan: '올해 급여계획 기록',
  risk: '위험도 평가 기록',
  rightsGuide: '계약의 인권 안내일',
};

export interface StatusSummary {
  ok: number;
  auto: number;
  expired: number;
  missing: number;
  soon: number;
}

export function summarize(rows: Array<ElderDocStatusRow<ElderDocument>>, today: string): StatusSummary {
  const s: StatusSummary = { ok: 0, auto: 0, expired: 0, missing: 0, soon: 0 };
  for (const r of rows) {
    if (r.status === 'OK') {
      s.ok += 1;
      if (expiryState(r.doc?.expiresOn, today)?.kind === 'SOON') s.soon += 1;
    } else if (r.status === 'AUTO') s.auto += 1;
    else if (r.status === 'EXPIRED') s.expired += 1;
    else s.missing += 1;
  }
  return s;
}
