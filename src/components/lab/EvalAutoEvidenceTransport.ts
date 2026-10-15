/**
 * 평가 지표 자동 근거 중 10차에 더한 다섯 — 이동서비스 수칙(TRANSPORT_RULES), 이동서비스 제공 기록(TRANSPORT_RECORDS), 사례관리(CASE_MANAGEMENT),
 * 등급·이용 현황 자체 점검(GRADE_SELF_CHECK), 수급자 인플루엔자 예방접종(FLU_VACCINE).
 * EvalAutoEvidence의 collect가 이 함수를 불러 같은 모양({lines})의 근거를 받는다. 규칙은 lib/lab의 transportRules·caseMeetingRules·vaccineRules·contractRules·evalGapRules가 맡는다.
 * 일부 조회가 실패하면 그 부분만 "계산하지 못했습니다"로 두고, 전부 실패하면 던진다.
 */
import { getElderAttendanceRange } from '@/lib/apiService';
import { listCaseMeetings, listElderContracts, listGuideDeliveries, listPolicyDocs, listStaffProfiles, listTransportLogs, listTransportVehicles, listVaccinations } from '@/lib/lab/labApi';
import { followUpAlerts, halfYearStatus } from '@/lib/lab/caseMeetingRules';
import { renewalWindow } from '@/lib/lab/contractRules';
import { gradeChange } from '@/lib/lab/evalGapRules';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import { docStatus } from '@/lib/lab/policyDocRules';
import { insuranceStatus, recentMonths, ridersBetween, ruleDeliveryCoverage, timetableMonths, transportLogCoverage } from '@/lib/lab/transportRules';
import { evalVaccineRate, seasonProgress, vaccineBaseDate } from '@/lib/lab/vaccineRules';
import { presentDatesOf } from '@/components/labRecords/useElderAttendance';
import { dotDate, monthLabel, monthRange, shiftMonth } from './labFormat';
import { FAILED, activeElderIds, attempt, linesOrThrow } from './EvalAutoEvidenceShared';

export interface TransportEvidence {
  lines: string[];
}

const SOURCES: readonly EvalAutoSource[] = ['TRANSPORT_RULES', 'TRANSPORT_RECORDS', 'CASE_MANAGEMENT', 'GRADE_SELF_CHECK', 'FLU_VACCINE'];

/** 이 파일이 맡는 자동 근거인가 */
export function isTransportEvidenceSource(source: EvalAutoSource): boolean {
  return SOURCES.includes(source);
}

const fmt = (rate: number | null) => (rate === null ? '-' : `${rate}%`);

async function transportRules(asOf: string): Promise<TransportEvidence> {
  const months = recentMonths(asOf, 3);
  const [docs, logs, deliveries, vehicles] = await Promise.all([
    attempt(() => listPolicyDocs()),
    attempt(async () => (await Promise.all(months.map((m) => listTransportLogs({ month: m })))).flat()),
    attempt(() => listGuideDeliveries('TRANSPORT_RULES')),
    attempt(() => listTransportVehicles()),
  ]);
  const lines: string[] = [];
  const doc = docs?.find((d) => d.kind === 'TRANSPORT_RULES') ?? null;
  if (docs) {
    if (!doc) lines.push(`규정·지침 대장에 이동서비스 수칙이 없습니다 (${asOf} 기준)`);
    else {
      const s = docStatus(doc, asOf);
      lines.push(`이동서비스 수칙 네 가지 내용(운전자 자격요건·동승자의 역할·차량안전수칙·사고 시 조치사항): ${s.itemsChecked}/${s.itemsTotal}개 체크${s.missingItems.length > 0 ? ` (빠진 항목: ${s.missingItems.join(' · ')})` : ''} · 개정일 ${dotDate(doc.revisedOn)} (${asOf} 기준)`);
    }
  } else lines.push(`이동서비스 수칙 대장: ${FAILED}`);
  if (logs && deliveries && docs) {
    const riders = ridersBetween(logs, `${months[0]}-01`, asOf);
    if (riders.length === 0) lines.push('최근 3개월 송영 운행일지에 탑승한 어르신이 없어 수칙 제공 현황을 셀 수 없습니다 (일지를 쓰지 않았다면 송영 일지에서 먼저 기록해 주세요)');
    else {
      const r = ruleDeliveryCoverage(riders, deliveries, doc?.revisedOn ?? null);
      lines.push(`최근 3개월 탑승 어르신 ${r.total}명 중 수칙을 제공한 어르신${doc?.revisedOn ? `(개정일 ${dotDate(doc.revisedOn)} 이후)` : ''}: ${r.delivered}/${r.total}명 · 미제공 ${r.missing.length}명`);
      lines.push('수칙이 바뀌면 다시 제공해야 합니다');
    }
  } else lines.push(`수칙 제공 현황: ${FAILED}`);
  if (vehicles) {
    const used = vehicles.filter((v) => v.active);
    if (used.length === 0) lines.push('쓰는 송영 차량이 등록돼 있지 않습니다 (송영 차량을 쓰지 않으면 해당 없음)');
    else {
      const st = used.map((v) => insuranceStatus(v, asOf));
      const ok = st.filter((s) => s === 'OK').length;
      const expiring = st.filter((s) => s === 'EXPIRING').length;
      const expired = st.filter((s) => s === 'EXPIRED').length;
      const plain = st.filter((s) => s === 'NOT_COMPREHENSIVE').length;
      const other = used.length - ok - expiring - expired - plain;
      lines.push(`쓰는 차량 ${used.length}대 중 종합보험 유효 ${ok}대 · 만기 30일 안 ${expiring}대 · 만기 지남 ${expired}대 · 종합보험 아님 ${plain}대${other > 0 ? ` · 보험 기록 없음·시작 전 ${other}대` : ''}`);
      lines.push('책임보험만으로는 인정되지 않습니다');
    }
  } else lines.push(`차량 보험 현황: ${FAILED}`);
  return linesOrThrow([docs, logs && deliveries && docs, vehicles], lines);
}

async function transportRecords(asOf: string): Promise<TransportEvidence> {
  const months = recentMonths(asOf, 3);
  const last = shiftMonth(asOf.slice(0, 7), -1);
  const { start, end } = monthRange(last);
  const [deliveries, logs, attendance] = await Promise.all([
    attempt(() => listGuideDeliveries('TIMETABLE')),
    attempt(() => listTransportLogs({ month: last })),
    attempt(async () => presentDatesOf(await getElderAttendanceRange(start, end))),
  ]);
  const lines: string[] = [];
  if (deliveries) {
    const t = timetableMonths(deliveries, months);
    lines.push(`최근 3개월 중 차량운행표를 제공한 달: ${t.covered}/${months.length}개월 (${t.byMonth.map((m) => `${Number(m.month.slice(5, 7))}월 ${m.count}건`).join(' · ')}) (${asOf} 기준)`);
    lines.push('운행표는 송영 시간 안내를 문자·SNS로 보낸 기록이며, 운행표나 수칙이 바뀌면 다시 제공해야 합니다(월 1회는 기관 기준)');
  } else lines.push(`운행표 제공 현황: ${FAILED}`);
  if (logs && attendance) {
    const dates = [...new Set(Object.values(attendance).flat())];
    const c = transportLogCoverage(logs, dates, last);
    lines.push(
      c.days === 0
        ? `${monthLabel(last)} 출석한 날이 없어 운행일지 작성률을 셀 수 없습니다`
        : `${monthLabel(last)} 출석한 ${c.days}일 중 운행일지가 있는 날: ${c.logged}/${c.days}일 (${fmt(c.rate)}) · 운전원과 탑승 어르신까지 갖춘 날 ${c.complete}일`,
    );
    lines.push('출석 날은 출결 기록으로 셉니다. 일지의 공단 정식 서식은 정해지지 않아 기관 서식입니다(대조 필요)');
  } else lines.push(`지난달 운행일지 작성률: ${FAILED}`);
  return linesOrThrow([deliveries, logs && attendance], lines);
}

const C2_LABEL = { NA: '갖춘 회의에 사례관리 대상 없음', NOT_MET: '반영·평가 기한을 넘긴 대상 있음', MET: '반영·평가 모두 기한 안에 마침', IN_PROGRESS: '반영·평가 진행 중' } as const;

async function caseManagement(asOf: string): Promise<TransportEvidence> {
  const year = Number(asOf.slice(0, 4));
  const half: 1 | 2 = Number(asOf.slice(5, 7)) <= 6 ? 1 : 2;
  const prev = half === 2 ? { year, half: 1 as const } : { year: year - 1, half: 2 as const };
  const [meetings, profiles] = await Promise.all([attempt(async () => (await Promise.all([listCaseMeetings(year), listCaseMeetings(year - 1)])).flat()), attempt(() => listStaffProfiles())]);
  if (!meetings || !profiles) throw new Error('근거를 계산하지 못했습니다');
  const lines: string[] = [];
  if (profiles.length === 0) lines.push('직원 인사에 등록된 직원 기준이 없어 참석 직종을 판정할 수 없습니다 — 직원 인사에서 직원별 직종·입사일을 먼저 입력해 주세요');
  for (const target of [{ year, half }, prev]) {
    const s = halfYearStatus(meetings, profiles, target.year, target.half, asOf);
    const current = target.year === year && target.half === half;
    lines.push(
      `${target.year}년 ${target.half === 1 ? '상반기' : '하반기'}${current ? '(진행 중)' : ''}: 사례관리 회의 ${s.count}건 중 참석·기록 칸을 갖춘 회의 ${s.okCount}건 — 기준① ${s.c1 ? '충족' : current ? '아직 없음' : '미충족'} · 기준② ${C2_LABEL[s.c2]}`,
    );
  }
  const alerts = followUpAlerts(meetings, asOf);
  const overdue = alerts.filter((a) => a.daysLeft < 0).length;
  lines.push(`반영·평가 기한이 지났거나 5일 안인 사례관리 대상: 지남 ${overdue}건 · 임박 ${alerts.length - overdue}건 (${asOf} 기준)`);
  lines.push('갖춘 회의 = 시설장 포함 3인 이상·직종별 참석에 참석자별 의견과 대상별 선정 사유·계획이 있는 회의. 반영과 평가는 회의 다음날부터 30일 안에 해야 합니다');
  return { lines };
}

async function gradeSelfCheck(asOf: string): Promise<TransportEvidence> {
  const contracts = await listElderContracts();
  const active = contracts.filter((c) => c.status === 'ACTIVE');
  if (active.length === 0) return { lines: [`진행 중인 계약이 없어 갱신 시기를 셀 수 없습니다 (${asOf} 기준)`, '장기요양 등급은 공단 전산에서 산정하는 지표입니다'] };
  let open = 0;
  let late = 0;
  let expired = 0;
  for (const c of active) {
    const w = renewalWindow(c.validTo);
    if (!w) continue;
    const to = c.validTo.slice(0, 10);
    if (asOf > to) expired += 1;
    else if (asOf > w.closesOn) late += 1;
    else if (asOf >= w.opensOn) open += 1;
  }
  // 갱신 계약(renewalCount 1 이상)을 같은 어르신의 바로 앞 인정 기간과 견준다
  let keep = 0;
  let better = 0;
  let worse = 0;
  let unknown = 0;
  for (const c of active) {
    if (!(c.renewalCount >= 1)) continue;
    const before = contracts.filter((x) => x.elderlyId === c.elderlyId && x.id !== c.id && x.validFrom.slice(0, 10) < c.validFrom.slice(0, 10)).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    const change = before ? gradeChange(before.careGrade, c.careGrade) : null;
    if (change === 'KEEP') keep += 1;
    else if (change === 'BETTER') better += 1;
    else if (change === 'WORSE') worse += 1;
    else unknown += 1;
  }
  const renewed = keep + better + worse + unknown;
  return {
    lines: [
      '등급·이용 현황은 공단 전산으로 산정하는 지표라 케어브이에는 평가 기록이 없습니다 — 아래는 기관이 자체 관리하는 점검입니다',
      `진행 중 계약 ${active.length}건: 갱신 신청 시기(유효기간 끝 90~30일 전) ${open}건 · 신청 기한은 지났으나 유효기간 안 ${late}건 · 유효기간 지남 ${expired}건 (${asOf} 기준)`,
      renewed === 0 ? '갱신으로 이어진 계약이 아직 없어 직전 대비 등급 변화를 셀 수 없습니다' : `갱신 계약 ${renewed}건의 직전 대비 등급 변화(참고): 유지 ${keep}건 · 호전 ${better}건 · 악화 ${worse}건${unknown > 0 ? ` · 비교할 직전 계약 없음 ${unknown}건` : ''}`,
      '호전 방향과 인지지원등급 비교는 정해진 기준이 없어 대조 필요입니다',
    ],
  };
}

async function fluVaccine(asOf: string): Promise<TransportEvidence> {
  const year = Number(asOf.slice(0, 4));
  // 다음 평가 연도(내년)의 접종률은 올해 접종 기록으로 센다(평가 연도 − 1년 접종)
  const evalYear = year + 1;
  const [contracts, thisYear] = await Promise.all([listElderContracts(), listVaccinations({ year })]);
  const r = evalVaccineRate(contracts, thisYear, evalYear);
  const p = seasonProgress(activeElderIds(contracts, asOf), thisYear, year);
  const lines = [
    r.rate === null
      ? `${evalYear}년 평가 기준(${vaccineBaseDate(evalYear)} 급여 유지자): 대상 어르신이 없어 접종률을 셀 수 없습니다`
      : `${evalYear}년 평가 기준 접종률(${vaccineBaseDate(evalYear)} 급여 유지 ${r.eligible}명 중 ${year}년 접종 ${r.vaccinated}명, 거부·제외 ${r.excluded}명은 뺌): ${r.vaccinated}/${r.denominator}명 (${fmt(r.rate)}) — 추정 ${r.score}점`,
    r.autoMet ? `${evalYear}년 평가는 접종률과 관계없이 충족 처리됩니다(2026·2027 재가 정기평가, 평가시행세칙 대조 필요)` : `2026·2027 재가 정기평가는 충족 처리지만 ${evalYear}년은 해당하지 않아 접종률로 점수를 매깁니다 — 80% 미만 점수는 매뉴얼에 없어 0점은 대조 필요입니다`,
    p.total === 0
      ? `${year}년 진행 중인 어르신이 없어 올해 접종 진행을 셀 수 없습니다`
      : `${year}년 올해 인플루엔자 접종(진행 중 어르신 ${p.total}명): 접종 ${p.done}명 · 거부 ${p.refused}명 · 제외 ${p.excluded}명 · 미확인 ${p.unknown}명 (접종률 ${fmt(p.rate)}) (${asOf} 기준)`,
    '거부는 사유를 꼭 적어 접종률 계산에서 빼야 하고, 제외 사유의 인정 범위는 대조 필요입니다',
  ];
  return { lines };
}

export async function collectTransportEvidence(source: EvalAutoSource, asOf: string): Promise<TransportEvidence> {
  if (source === 'TRANSPORT_RULES') return transportRules(asOf);
  if (source === 'TRANSPORT_RECORDS') return transportRecords(asOf);
  if (source === 'CASE_MANAGEMENT') return caseManagement(asOf);
  if (source === 'GRADE_SELF_CHECK') return gradeSelfCheck(asOf);
  return fluVaccine(asOf);
}
