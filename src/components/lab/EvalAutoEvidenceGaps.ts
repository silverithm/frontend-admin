/**
 * 평가 지표 자동 근거 중 10차에 더한 다섯 — 운영규정(POLICY_OPERATING_RULES), 개인정보 보호(PRIVACY_BASICS), 감염병 대응 체계(INFECTION_RESPONSE),
 * 투약 기록(MEDICATION_RECORDS), 수급자 건강·안전 관리(HEALTH_SAFETY).
 * EvalAutoEvidence의 collect가 이 함수를 불러 같은 모양({lines})의 근거를 받는다. 규칙은 lib/lab의 policyDocRules·evalGapRules가 맡는다.
 * 일부 조회가 실패하면 그 부분만 "계산하지 못했습니다"로 두고, 전부 실패하면 던진다.
 */
import { listCareEvents, listCareRecordsByDate, listElderContracts, listElderDocuments, listNursingLogsByDate, listOutbreaks, listPolicyDocs, listStaffTrainings } from '@/lib/lab/labApi';
import { eventFollowUpRates, medicationRecordCompleteness, privacyConsentRate, vitalsCompleteness } from '@/lib/lab/evalGapRules';
import { outbreakSummary } from '@/lib/lab/outbreakRules';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import { POLICY_ITEMS, PRIVACY_GUIDE_NO, docStatus, infectionResponseEvidence, operatingRulesEvidence } from '@/lib/lab/policyDocRules';
import type { PolicyDoc } from '@/lib/lab/labTypes';
import { dotDate, shiftMonth } from './labFormat';
import { FAILED, activeElderIds, attempt, briefly, lastDays, linesOrThrow, perDate } from './EvalAutoEvidenceShared';

export interface GapsEvidence {
  lines: string[];
}

const SOURCES: readonly EvalAutoSource[] = ['POLICY_OPERATING_RULES', 'PRIVACY_BASICS', 'INFECTION_RESPONSE', 'MEDICATION_RECORDS', 'HEALTH_SAFETY'];

/** 이 파일이 맡는 자동 근거인가 */
export function isGapsEvidenceSource(source: EvalAutoSource): boolean {
  return SOURCES.includes(source);
}

const STATE_LABEL = { READY: '갖춤', PARTIAL: '일부', MISSING: '없음' } as const;
const fmt = (rate: number | null) => (rate === null ? '-' : `${rate}%`);
const docOf = (docs: readonly PolicyDoc[], kind: PolicyDoc['kind'], guideNo: number | null = null) => docs.find((d) => d.kind === kind && (kind !== 'CARE_GUIDE' || d.guideNo === guideNo)) ?? null;

async function operatingRules(asOf: string): Promise<GapsEvidence> {
  const docs = await listPolicyDocs();
  const r = operatingRulesEvidence(docs, asOf);
  const doc = docOf(docs, 'OPERATING_RULES');
  if (r.state === 'MISSING' || !doc) {
    return { lines: [`규정·지침 대장에 운영규정이 없습니다 (${asOf} 기준)`, '실험실 > 운영 > 규정·지침에서 운영규정을 등록하고 평가 매뉴얼의 11개 항목을 체크해 주세요', '직원 연 1회 운영규정 교육은 기관 기준 안내입니다(평가 문구에 없음)'] };
  }
  const total = POLICY_ITEMS.OPERATING_RULES.length;
  const lines = [
    r.state === 'READY' ? `운영규정: 매뉴얼 11개 항목이 모두 있고 최근 개정일·비치 장소도 있습니다 (${asOf} 기준)` : `운영규정은 대장에 있으나 갖추지 못한 것이 있습니다 — 항목 ${total - r.missingItems.length}/${total}개 체크 (${asOf} 기준)`,
    r.missingItems.length > 0 ? `빠진 항목: ${r.missingItems.join(' · ')}` : r.state === 'PARTIAL' ? '개정일 또는 비치 장소가 비어 있습니다' : `최근 개정일 ${dotDate(doc.revisedOn)} · 비치 장소 ${doc.location ?? '-'}`,
    `직원 연 1회 운영규정 교육 안내(기관 기준, 평가 문구 아님): ${doc.trainedOn ? `직원 교육일 ${dotDate(doc.trainedOn)}` : '대장에 직원 교육일이 없습니다'}`,
    '내용이 충실한지는 사람이 확인합니다. 노인복지법 별표 10 제3호 항목과 시장·군수·구청장 제출은 평가 항목과 별도입니다',
  ];
  return { lines };
}

async function privacy(asOf: string): Promise<GapsEvidence> {
  const [contracts, documents, docs] = await Promise.all([attempt(() => listElderContracts()), attempt(() => listElderDocuments()), attempt(() => listPolicyDocs())]);
  const lines: string[] = [];
  if (contracts && documents) {
    const ids = activeElderIds(contracts, asOf);
    if (ids.length === 0) lines.push(`진행 중인 어르신이 없어 동의서 현황을 셀 수 없습니다 (${asOf} 기준)`);
    else {
      const r = privacyConsentRate(ids, documents);
      lines.push(`진행 중 어르신 ${r.total}명 중 개인정보 수집·이용 동의서(서류함)에 발급일이 있는 어르신: ${r.withConsent}/${r.total}명 (${fmt(r.rate)}) (${asOf} 기준)`);
      lines.push('동의 근거는 법정 의무이며 평가 점수와 별개입니다');
    }
  } else lines.push(`수급자 동의서 현황: ${FAILED}`);
  if (docs) {
    const guide = docOf(docs, 'CARE_GUIDE', PRIVACY_GUIDE_NO);
    if (!guide) lines.push('급여제공지침 ⑩ 개인정보보호지침이 규정·지침 대장에 없습니다');
    else {
      const s = docStatus(guide, asOf);
      lines.push(`급여제공지침 ⑩ 개인정보보호지침: 필수 내용 ${s.itemsChecked}/${s.itemsTotal}개 체크${s.missingItems.length > 0 ? ` (빠진 항목: ${s.missingItems.join(' · ')})` : ''} · 개정일 ${dotDate(guide.revisedOn)} · 비치 장소 ${guide.location ?? '-'}`);
    }
  } else lines.push(`개인정보보호지침 대장: ${FAILED}`);
  lines.push('평가는 개인정보 자료 보관함 잠금과 지침 비치를 현장에서 봅니다 — 기록으로 셀 수 없으니 보관함 잠금·보관함 밖에 개인정보 자료가 없는지 직접 확인해 주세요');
  return linesOrThrow([contracts && documents, docs], lines);
}

async function infection(asOf: string): Promise<GapsEvidence> {
  const year = Number(asOf.slice(0, 4));
  // 최근 12개월 교육은 작년 일부를 포함할 수 있어 올해와 작년을 함께 받는다
  const [docs, trainings, outbreaks] = await Promise.all([attempt(() => listPolicyDocs()), attempt(async () => (await Promise.all([listStaffTrainings(year), listStaffTrainings(year - 1)])).flat()), attempt(() => listOutbreaks(year))]);
  if (!docs || !trainings) {
    if (!docs && !trainings) throw new Error('근거를 계산하지 못했습니다');
    return { lines: [docs ? `감염병 대응계획: 대장에서 확인했으나 교육 기록을 ${FAILED}` : `감염병 대응계획 대장을 ${FAILED}`] };
  }
  const r = infectionResponseEvidence(docs, trainings, asOf);
  const doc = docOf(docs, 'INFECTION_PLAN');
  const missing = doc ? docStatus(doc, asOf).missingItems : [];
  const o = outbreaks ? outbreakSummary(outbreaks, `${year}-01-01`, asOf.slice(0, 10), asOf) : null;
  return {
    lines: [
      `감염병 대응 체계: ${STATE_LABEL[r.state]} — 계획 ${r.plan ? '있음(두 체계 체크)' : '미비'} · 최근 12개월 감염 교육 ${r.trainings12m}건 (${asOf} 기준)`,
      !doc ? '규정·지침 대장에 감염병 대응계획이 없습니다' : `국가 위기상황 대응체계와 기관 내 환자 발생·확산 대응체계${missing.length > 0 ? `: 빠진 항목 ${missing.join(' · ')}` : ' 모두 체크'} · 개정일 ${dotDate(doc.revisedOn)}${r.revisedWithin12m ? '(12개월 안)' : '(12개월 넘음 또는 없음)'}`,
      o === null
        ? `${year}년 유행·발생 기록: ${FAILED}`
        : o.total === 0
          ? `${year}년 유행·발생 대응 기록이 없습니다 — 유행·발생이 없었다면 채울 내용도 없습니다`
          : `${year}년 유행·발생 기록 ${o.total}건 중 진행 중 ${o.open}건 · 보호자 안내·보건소 신고·공단 보고를 갖춘 기록 ${o.complete}건 · 조치를 기록한 건 ${o.withActions}건`,
      '교육·개정 주기는 평가 문구에 없어 기관 기준입니다(대조 필요). 직원이 유행·발생 때 한 조치는 면담에서 설명할 수 있어야 하고, 훈련·비축은 권고입니다',
    ],
  };
}

async function nursingLogs30(asOf: string) {
  return briefly(`nursing30|${asOf}`, () => perDate(lastDays(asOf, 30), (d) => listNursingLogsByDate(d)));
}

async function medication(asOf: string): Promise<GapsEvidence> {
  const dates = lastDays(asOf, 30);
  const [logs, open] = await Promise.all([attempt(() => nursingLogs30(asOf)), attempt(() => listCareEvents({ status: 'OPEN' }))]);
  const lines: string[] = [];
  if (logs) {
    const r = medicationRecordCompleteness(logs, dates[0], asOf);
    lines.push(
      r.days === 0
        ? `최근 30일(${dotDate(dates[0])} ~ ${dotDate(asOf)}) 투약 칸에 값이 있는 간호일지가 없습니다`
        : `최근 30일 투약을 적은 간호일지 ${r.days}건 중 기록자 빈 칸 ${r.noRecorder}건 · 건너뜀(SKIPPED)인데 사유·처치가 없는 기록 ${r.skippedNoNote}건 (${asOf} 기준)`,
    );
  } else lines.push(`최근 30일 투약 기록 완결도: ${FAILED}`);
  if (open) lines.push(`아직 열려 있는 투약 사건(상태변화·사고 기록의 종류 투약) ${open.filter((e) => e.kind === 'MEDICATION').length}건`);
  else lines.push(`열려 있는 투약 사건: ${FAILED}`);
  lines.push('기록 품질 참고입니다. 평가 기준③(투약 6원칙)은 면담으로 확인하니 직원이 설명할 수 있게 준비해 주세요');
  return linesOrThrow([logs, open], lines);
}

async function health(asOf: string): Promise<GapsEvidence> {
  const dates = lastDays(asOf, 30);
  const months = [shiftMonth(asOf.slice(0, 7), -3), shiftMonth(asOf.slice(0, 7), -2), shiftMonth(asOf.slice(0, 7), -1), asOf.slice(0, 7)];
  const [careDays, logs, events] = await Promise.all([
    attempt(() => briefly(`care30|${asOf}`, () => perDate(dates, (d) => listCareRecordsByDate(d)))),
    attempt(() => nursingLogs30(asOf)),
    attempt(async () => (await Promise.all(months.map((m) => listCareEvents({ month: m })))).flat()),
  ]);
  const lines: string[] = [];
  if (careDays && logs) {
    const r = vitalsCompleteness(careDays.map((c) => ({ elderlyId: c.elderlyId, date: c.recordDate })), logs);
    lines.push(
      r.total === 0
        ? `최근 30일 급여제공기록이 있는 날이 없어 바이탈 완결률을 셀 수 없습니다 (${asOf} 기준)`
        : `최근 30일 급여제공기록이 있는 (어르신, 날) ${r.total}건 중 같은 날 간호일지에 혈압·체온이 모두 있는 건: ${r.complete}/${r.total} (${fmt(r.rate)}) (${asOf} 기준)`,
    );
  } else lines.push(`바이탈 완결률: ${FAILED}`);
  if (events) {
    const r = eventFollowUpRates(events, asOf);
    lines.push(
      r.total === 0
        ? '최근 90일 낙상·부상·응급·입원 사건이 없습니다'
        : `최근 90일 낙상·부상·응급·입원 ${r.total}건 중 보호자 연락 기록 ${r.notified}건 · 종결 ${r.closed}건(그중 후속 조치 기록 ${r.closedWithFollowUp}건)`,
    );
  } else lines.push(`사건 후속 현황: ${FAILED}`);
  lines.push('제품 기준입니다 — 평가 문구가 아닙니다. 평가는 이 지표에 정해진 문구가 없어 급여제공 매뉴얼과 연결된 지표(12·21·30·34)의 근거를 함께 봅니다');
  return linesOrThrow([careDays && logs, events], lines);
}

export async function collectGapsEvidence(source: EvalAutoSource, asOf: string): Promise<GapsEvidence> {
  if (source === 'POLICY_OPERATING_RULES') return operatingRules(asOf);
  if (source === 'PRIVACY_BASICS') return privacy(asOf);
  if (source === 'INFECTION_RESPONSE') return infection(asOf);
  if (source === 'MEDICATION_RECORDS') return medication(asOf);
  return health(asOf);
}
