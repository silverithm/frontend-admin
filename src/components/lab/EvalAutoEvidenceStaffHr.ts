/**
 * 평가 지표 자동 근거 중 9차에 더한 셋 — 경력직 비율(EXPERIENCED_STAFF), 보수교육 이수율(CONTINUING_EDU), 직원 건강검진(HEALTH_CHECK).
 * EvalAutoEvidence의 collect가 이 함수를 불러 같은 모양({lines})의 근거를 받는다. 규칙은 lib/lab의 staffHrRules가 맡는다.
 * 직원 인사 화면에서 입력한 기준(입사일·출생연도·합격일·사무직)과 이수·검진 기록으로 센 "지금 기준 추정"이다.
 */
import { listStaffCerts, listStaffProfiles } from '@/lib/lab/labApi';
import { continuingEduRate, continuingEduStatus, experiencedRatio, healthCheckRate, healthCheckStatus } from '@/lib/lab/staffHrRules';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';

export interface StaffHrEvidence {
  lines: string[];
}

const SOURCES: readonly EvalAutoSource[] = ['EXPERIENCED_STAFF', 'CONTINUING_EDU', 'HEALTH_CHECK'];

/** 이 파일이 맡는 자동 근거인가 */
export function isStaffHrEvidenceSource(source: EvalAutoSource): boolean {
  return SOURCES.includes(source);
}

const EMPTY = (asOf: string): StaffHrEvidence => ({ lines: [`직원 인사에 등록된 직원 기준이 없어 셀 수 없습니다 (${asOf} 기준)`, '실험실 > 운영 > 직원 인사에서 직원별 입사일·직종 등을 먼저 입력해 주세요'] });

/** 이름 몇 명만 보여 주고 나머지는 "외 n명" */
function names(list: ReadonlyArray<string>): string {
  const shown = list.filter((n) => n !== '').slice(0, 5).join(', ');
  return list.length > 5 ? `${shown} 외 ${list.length - 5}명` : shown;
}

export async function collectStaffHrEvidence(source: EvalAutoSource, asOf: string): Promise<StaffHrEvidence> {
  const year = Number(asOf.slice(0, 4));
  const [profiles, certs] = await Promise.all([listStaffProfiles(), listStaffCerts()]);
  if (profiles.length === 0) return EMPTY(asOf);

  if (source === 'EXPERIENCED_STAFF') {
    const r = experiencedRatio(profiles, asOf);
    if (r.total === 0 || r.ratio === null) return { lines: [`근무 중인 직원이 없어(입사 예정자는 뺌) 비율을 셀 수 없습니다 (${asOf} 기준)`] };
    return {
      lines: [
        `기관에 연속 ${r.threshold}개월 이상 근무한 직원: ${r.eligible}/${r.total}명 (${r.ratio}%) — 추정 ${r.score}점/1점`,
        '입사일부터 지금까지 이어 근무한 것으로 센 "지금 기준 추정"입니다. 공단 전산 산정 기간 기준의 연속 근무·제외 사유(정년·사망 등)·법인 내 이동은 반영되지 않습니다',
        ...(r.score === 0 ? ['30% 미만의 점수는 매뉴얼 표에 없어 0점은 대조 필요입니다'] : []),
        `(${asOf} 기준)`,
      ],
    };
  }

  if (source === 'CONTINUING_EDU') {
    const r = continuingEduRate(profiles, certs, year, asOf);
    if (r.required === 0 || r.rate === null) return { lines: [`${year}년 보수교육 대상 요양보호사가 없어 해당 없음입니다 (${asOf} 기준)`, '출생연도·합격일이 비어 있는 요양보호사는 대상 여부를 알 수 없어 세지 않았습니다 — 직원 인사에서 확인해 주세요'] };
    const rows = profiles.map((p) => ({ name: p.memberName ?? '', status: continuingEduStatus(p, certs, year, asOf).status }));
    const missed = rows.filter((x) => x.status === 'MISSED').map((x) => x.name);
    const due = rows.filter((x) => x.status === 'DUE').map((x) => x.name);
    const unknown = rows.filter((x) => x.status === 'UNKNOWN').length;
    return {
      lines: [
        `${year}년 보수교육 대상 요양보호사 ${r.required}명 중 8시간 이상 이수: ${r.done}명 (이수율 ${r.rate}%) — 추정 ${r.score}점/1점`,
        `기한 지나 미이수 ${missed.length}명${missed.length > 0 ? ` (${names(missed)})` : ''} · 아직 올해 안 ${due.length}명${due.length > 0 ? ` (${names(due)})` : ''}${unknown > 0 ? ` · 출생연도 없어 대상 불명 ${unknown}명` : ''}`,
        '이수내역의 정본은 공단 전산입니다 — 이수증으로 현장에서 확인해 주세요. 75% 미만 점수는 매뉴얼에 없어 대조 필요입니다',
        `(${asOf} 기준)`,
      ],
    };
  }

  const r = healthCheckRate(profiles, certs, asOf);
  if (r.total === 0 || r.rate === null) return { lines: [`근무 중인 직원이 없어(입사 예정자는 뺌) 검진률을 셀 수 없습니다 (${asOf} 기준)`] };
  const rows = profiles.filter((p) => p.hireDate.slice(0, 10) <= asOf).map((p) => ({ name: p.memberName ?? '', status: healthCheckStatus(p, certs, asOf).status }));
  const overdue = rows.filter((x) => x.status === 'OVERDUE').map((x) => x.name);
  const missing = rows.filter((x) => x.status === 'MISSING').map((x) => x.name);
  const soon = rows.filter((x) => x.status === 'DUE_SOON').length;
  return {
    lines: [
      `유효한 건강검진이 있는 직원: ${r.ok}/${r.total}명 (검진률 ${r.rate}%) — 추정 ${r.score}점/3점`,
      `기한 지남 ${overdue.length}명${overdue.length > 0 ? ` (${names(overdue)})` : ''} · 기록 없음 ${missing.length}명${missing.length > 0 ? ` (${names(missing)})` : ''} · 30일 안 임박 ${soon}명`,
      '전체 직원 기준 참고 추정입니다(평가는 표본 직원으로 봅니다). 결핵 포함 5개 영역 충족은 결과통보서로 따로 확인하고, 75% 미만 점수는 대조 필요입니다',
      `(${asOf} 기준)`,
    ],
  };
}
