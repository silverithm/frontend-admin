'use client';

/**
 * 평가 지표의 자동 근거 — 케어브이에 이미 쌓인 기록으로 지표가 얼마나 채워졌는지 센다.
 * 지표 칸을 열었을 때만 불러온다(기록 조회가 여러 번 나가므로 목록을 열자마자 돌리지 않는다).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { listCareDeliveries, listCareEvents, listCarePlans, listCareRecordsByDate, listGuardianNotices, listLabStaff, listPrograms, listResourceLinks, listRiskLatest, listSafetyChecks, listSafetyChecksByYear, listStaffTrainings } from '@/lib/lab/labApi';
import { eventChecklist } from '@/lib/lab/careEventRules';
import { resourceSummary, resourceTypeLabel } from '@/lib/lab/communityRules';
import { noticeCoverage } from '@/lib/lab/guardianNotice';
import { summarizeQuality } from '@/lib/lab/careRecordQuality';
import { EVAL_AUTO_SOURCE_LABEL } from '@/lib/lab/evalIndicators';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import { carePlanCoverage } from '@/lib/lab/carePlanRules';
import { EVAL_SAFETY_KINDS, monthlySafetySummary, safetyCoverage } from '@/lib/lab/safetyRules';
import type { SafetyKind } from '@/lib/lab/labTypes';
import { recentWeeklyStatuses, weeksMet } from '@/lib/lab/programRules';
import { currentHalfLabel, halfYearSummary } from '@/lib/lab/riskScales';
import { LEGAL_TRAINING_CATEGORIES, summarizeCoverage, trainingCategoryLabel, trainingCoverage } from '@/lib/lab/trainingRules';
import { collectContractEvidence, isContractEvidenceSource } from './EvalAutoEvidenceContract';
import { collectProgramEvidence, isProgramEvidenceSource } from './EvalAutoEvidenceProgram';
import { collectStaffHrEvidence, isStaffHrEvidenceSource } from './EvalAutoEvidenceStaffHr';
import { collectGapsEvidence, isGapsEvidenceSource } from './EvalAutoEvidenceGaps';
import { collectRightsEvidence, isRightsEvidenceSource } from './EvalAutoEvidenceRights';
import { collectTransportEvidence, isTransportEvidenceSource } from './EvalAutoEvidenceTransport';
import { collectStaffingEvidence, isStaffingEvidenceSource } from './EvalAutoEvidenceStaffing';
import { careWriterLines, fireOperationLines, infectionDisinfectLines } from './EvalAutoEvidenceForm';
import { recallEvidence, rememberEvidence } from './evalEvidenceCache';
import { ErrorBanner } from './LabUi';
import { careFieldsOf, currentMonth, dotDate, errorText, monthLabel, operatingDaysOf, readClosedDates, readNoVehicle, recentDates, shiftMonth, todayString } from './labFormat';
import { fetchLabElders } from './useLabElders';
import styles from './lab.module.css';

interface Evidence {
  lines: string[];
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

export async function collect(source: EvalAutoSource, indicatorCode?: string): Promise<Evidence> {
  const asOf = todayString();
  if (isContractEvidenceSource(source)) return collectContractEvidence(source, asOf);
  if (isProgramEvidenceSource(source)) return collectProgramEvidence(source, asOf);
  if (isStaffingEvidenceSource(source)) return collectStaffingEvidence(source, asOf);
  if (isStaffHrEvidenceSource(source)) return collectStaffHrEvidence(source, asOf);
  if (isGapsEvidenceSource(source)) return collectGapsEvidence(source, asOf);
  if (isTransportEvidenceSource(source)) return collectTransportEvidence(source, asOf);
  if (isRightsEvidenceSource(source)) return collectRightsEvidence(source, asOf);
  // [12차] 감염 일상 점검(SAFE-04의 점검 종류) 줄에 분기별 전문소독 줄을 이어 붙인다 — 모르는 source가 마지막 기본 분기로 새지 않게 따로 받는다
  if (source === 'INFECTION_CONTROL') {
    const base = await collect('SAFETY_CHECKS', indicatorCode ?? 'SAFE-04');
    return { lines: [...base.lines, ...(await infectionDisinfectLines(asOf))] };
  }
  if (source === 'SAFETY_CHECKS') {
    const month = currentMonth();
    const noVehicle = readNoVehicle();
    const closed = readClosedDates();
    const allKinds: readonly SafetyKind[] = indicatorCode ? (EVAL_SAFETY_KINDS[indicatorCode] ?? []) : Object.values(EVAL_SAFETY_KINDS).flat();
    const kinds = [...new Set(allKinds)].filter((k) => !(noVehicle && k === 'VEHICLE'));
    if (kinds.length === 0) return { lines: ['이 지표에 맞는 점검 종류가 없어 이번 달 점검 현황을 셀 수 없습니다'] };
    const checks = await listSafetyChecks(month);
    const days = operatingDaysOf(month, closed);
    const summary = monthlySafetySummary(checks, month, days, kinds);
    const perKind = summary.perKind.map((k) => `${k.label} ${k.done}/${k.required}`).join(' · ');
    const basis = `운영일 ${days.length}일(평일${closed.length > 0 ? '에서 기억해 둔 휴원일 제외' : ''}${noVehicle ? ', 차량 운행 안 함' : ''})`;
    return {
      lines: [
        `${monthLabel(month)} 필수 점검 완료율: ${summary.done}/${summary.required}회 (${summary.percent}%)`,
        `종류별: ${perKind} (${asOf} 기준)`,
        `계산 기준: ${basis}`,
      ],
    };
  }
  if (source === 'DRILL_TWICE') {
    const year = Number(asOf.slice(0, 4));
    const drills = await listSafetyChecksByYear(year, 'DRILL');
    const cov = safetyCoverage(drills, 'DRILL', { year });
    const half = (h: 1 | 2) => (cov.missing.includes(`${year}-H${h}`) ? '아직 없음' : '실시함');
    return {
      lines: [
        `${year}년 재난 대응 훈련: 상반기(1~6월) ${half(1)} · 하반기(7~12월) ${half(2)}`,
        `반기별 실시 ${cov.done}/${cov.required}회 (${asOf} 기준)`,
        ...(await fireOperationLines(asOf)),
      ],
    };
  }
  if (source === 'RISK_HALF_YEAR') {
    const latest = await listRiskLatest();
    const summary = halfYearSummary(latest, new Date());
    const half = currentHalfLabel(new Date());
    return {
      lines: [
        `${half} 욕창·낙상·인지기능 세 평가를 모두 마친 어르신: ${summary.allDone}/${summary.total}명 (${pct(summary.allDone, summary.total)}%)`,
        `욕창(Braden) ${summary.done.BRADEN}/${summary.total}명 · 낙상(Morse) ${summary.done.MORSE}/${summary.total}명 · 인지기능 ${summary.done.COGNITIVE}/${summary.total}명 (${asOf} 기준)`,
      ],
    };
  }
  if (source === 'PROGRAM_COGNITIVE_WEEKLY') {
    // 끝난 최근 4주가 두세 달에 걸칠 수 있어, 그 주들이 닿는 달을 모두 불러온다
    const weeks = recentWeeklyStatuses([], asOf, 4);
    const months = [...new Set(weeks.flatMap((w) => [w.weekStart.slice(0, 7), w.weekEnd.slice(0, 7)]))];
    const programs = (await Promise.all(months.map((m) => listPrograms(m)))).flat();
    const statuses = recentWeeklyStatuses(programs, asOf, 4);
    const { met, total } = weeksMet(statuses);
    const first = statuses[0];
    const last = statuses[statuses.length - 1];
    return {
      lines: [
        `최근 ${total}주(${dotDate(first.weekStart)} ~ ${dotDate(last.weekEnd)}) 중 인지기능 프로그램을 주 3회 이상 운영한 주: ${met}/${total}주`,
        ...statuses.map((w) => `· ${dotDate(w.weekStart)} ~ ${dotDate(w.weekEnd)} 주: 인지기능 프로그램 ${w.count}회 (${w.met ? '충족' : '미충족'})`),
        `진행 중인 이번 주는 제외했습니다 (${asOf} 기준)`,
      ],
    };
  }
  if (source === 'TRAINING_COVERAGE') {
    const year = Number(asOf.slice(0, 4));
    const [trainings, staff] = await Promise.all([listStaffTrainings(year), listLabStaff()]);
    if (staff.length === 0) return { lines: ['등록된 직원이 없어 법정 교육 이수 현황을 셀 수 없습니다'] };
    const summary = summarizeCoverage(trainingCoverage(trainings, staff, year));
    const categories = LEGAL_TRAINING_CATEGORIES.map((c) => `${trainingCategoryLabel(c)} ${summary.byCategory[c]}/${summary.total}명`).join(' · ');
    return {
      lines: [
        `${year}년 법정 교육 다섯 범주를 모두 이수한 직원: ${summary.complete}/${summary.total}명 (${summary.percent}%)`,
        `범주별 이수: ${categories} (${asOf} 기준)`,
      ],
    };
  }
  if (source === 'CARE_PLAN_AGREEMENT') {
    const year = Number(asOf.slice(0, 4));
    const [plans, elders] = await Promise.all([listCarePlans(year), fetchLabElders()]);
    if (elders.length === 0) return { lines: ['등록된 어르신이 없어 급여제공계획 현황을 셀 수 없습니다'] };
    const cov = carePlanCoverage(plans, elders.map((e) => e.id), year);
    return {
      lines: [
        `${year}년 급여제공계획과 보호자 동의를 모두 갖춘 어르신: ${cov.ok}/${cov.total}명 (${cov.percent}%)`,
        `보호자 동의 필요 ${cov.needsAgreement}명 · 올해 계획 없음 ${cov.missing}명 (${asOf} 기준)`,
      ],
    };
  }
  if (source === 'CARE_RECORD_DELIVERY') {
    const month = currentMonth();
    const [deliveries, elders] = await Promise.all([listCareDeliveries(month), fetchLabElders()]);
    const delivered = new Set(deliveries.map((d) => d.elderlyId)).size;
    return {
      lines: [`${monthLabel(month)} 급여제공기록 제공대장: ${delivered}/${elders.length}명 제공 기록 있음 (${pct(delivered, elders.length)}%, ${asOf} 기준)`],
    };
  }
  if (source === 'CARE_EVENT_FOLLOWUP') {
    // 사고 기록은 월 단위로만 읽을 수 있어 올해 1월부터 이번 달까지 나란히 받는다
    const year = asOf.slice(0, 4);
    const thisMonth = currentMonth();
    const months = Array.from({ length: Number(thisMonth.slice(5)) }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const events = (await Promise.all(months.map((m) => listCareEvents({ month: m })))).flat();
    if (events.length === 0) return { lines: [`${year}년에 기록된 상태변화·사고가 없습니다 (${asOf} 기준). 사고가 없었다면 자동 근거로 채울 내용도 없습니다`] };
    // 즉시 조치가 있고, 보호자 연락이 필요한 사고는 연락 기록까지 있어야 "갖춘" 것으로 센다
    let ready = 0;
    let noAction = 0;
    let noGuardian = 0;
    for (const e of events) {
      const items = eventChecklist(e);
      const actionOk = items.find((i) => i.code === 'ACTION')?.ok ?? false;
      const guardian = items.find((i) => i.code === 'GUARDIAN');
      const guardianOk = guardian ? guardian.ok : true;
      if (!actionOk) noAction += 1;
      if (!guardianOk) noGuardian += 1;
      if (actionOk && guardianOk) ready += 1;
    }
    return {
      lines: [
        `${year}년 상태변화·사고 ${events.length}건 중 즉시 조치와 필요한 보호자 연락을 갖춘 기록: ${ready}/${events.length}건 (${pct(ready, events.length)}%)`,
        `즉시 조치 빠짐 ${noAction}건 · 보호자 연락이 필요한데 기록 없음 ${noGuardian}건 (${asOf} 기준)`,
        '2026 지표에 이 기록의 서식·필수 항목은 정해져 있지 않아 기관 자체 기록입니다 (대조 필요)',
      ],
    };
  }
  if (source === 'GUARDIAN_NOTICE_MONTHLY') {
    const month = shiftMonth(currentMonth(), -1);
    const [notices, elders] = await Promise.all([listGuardianNotices(month), fetchLabElders()]);
    if (elders.length === 0) return { lines: ['등록된 어르신이 없어 보호자 안내 현황을 셀 수 없습니다'] };
    const cov = noticeCoverage(notices, elders, month);
    return {
      lines: [
        `${monthLabel(month)} 보호자 월간 안내를 보낸 어르신: ${cov.sent}/${elders.length}명 (${pct(cov.sent, elders.length)}%)`,
        `초안만 있음 ${cov.draft}명 · 안내 없음 ${cov.missing}명 (${asOf} 기준)`,
        '기관 소식 월 1회 제공의 근거일 뿐입니다. 보호자 상담은 분기 1회 이상이 따로 있어야 하고, 문자·소식 같은 일방향 안내만으로는 소통노력으로 인정되지 않습니다 (대조 필요)',
      ],
    };
  }
  if (source === 'RESOURCE_LINKS') {
    const year = Number(asOf.slice(0, 4));
    const links = await listResourceLinks({ year });
    if (links.length === 0) return { lines: [`${year}년에 기록된 외부기관·지역자원 연계가 없습니다 (${asOf} 기준)`] };
    const sum = resourceSummary(links, year, asOf);
    // 기준①은 직원이 동행한 의료기관 진료 기록이다 — 의료기관 연계만 따로 센다. 퇴소 연계기록지(기준②)는 이 기록으로 증명되지 않는다
    const medical = sum.byType.MEDICAL ?? 0;
    const kinds = Object.entries(sum.byType)
      .filter(([, n]) => n > 0)
      .map(([type, n]) => `${resourceTypeLabel(type)} ${n}건`)
      .join(' · ');
    return {
      lines: [
        `${year}년 외부기관·지역자원 연계 ${sum.total}건, 연계한 어르신 ${sum.eldersLinked}명 (${asOf} 기준)`,
        `의료기관 진료 연계 ${medical}건 — 진료 내용은 각 기록의 내용 칸${kinds ? ` · 종류별: ${kinds}` : ''}`,
        '퇴소(계약 종료) 때 주는 연계기록지와 제공대장은 이 기록에 포함되지 않습니다 — 따로 확인해 주세요',
        ...(sum.followUpsDue.length > 0 ? [`후속 확인일이 지났는데 결과가 비어 있는 연계 ${sum.followUpsDue.length}건`] : []),
      ],
    };
  }
  const dates = recentDates(7);
  const days = await Promise.all(dates.map((d) => listCareRecordsByDate(d)));
  const records = days.flat();
  const summary = summarizeQuality(
    records.map(careFieldsOf),
  );
  const writerLines = await careWriterLines(asOf);
  if (summary.total === 0) return { lines: [`최근 7일(${dates[0]} ~ ${dates[dates.length - 1]}) 저장된 급여제공기록이 없습니다`, ...writerLines] };
  return {
    lines: [
      `최근 7일 급여제공기록 ${summary.total}건 중 형식적 문구가 있는 기록 ${summary.vague}건, 빈 기록 ${summary.empty}건`,
      `형식적 문구가 없는 기록 비율: ${summary.goodPercent === null ? '-' : `${summary.goodPercent}%`} (${asOf} 기준)`,
      ...writerLines,
    ],
  };
}

/** 묶음 인쇄용 — 최근 10분 안에 계산해 둔 근거가 있으면 그것을, 없으면 새로 계산해 기억해 둔다 */
export async function collectEvidenceCached(source: EvalAutoSource, indicatorCode?: string): Promise<string[]> {
  const hit = recallEvidence(source, indicatorCode);
  if (hit) return hit;
  const { lines } = await collect(source, indicatorCode);
  rememberEvidence(source, indicatorCode, lines);
  return lines;
}

interface EvalAutoEvidenceProps {
  source: EvalAutoSource;
  /** 지표 코드 — 지표마다 볼 점검 종류가 다를 때 쓴다 */
  indicatorCode?: string;
  /** 근거 글에 이 내용을 넣는다 */
  onUse: (text: string) => void;
}

export default function EvalAutoEvidence({ source, indicatorCode, onUse }: EvalAutoEvidenceProps) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await collect(source, indicatorCode);
      if (n !== seq.current) return;
      rememberEvidence(source, indicatorCode, result.lines);
      setEvidence(result);
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '자동 근거를 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [source, indicatorCode]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  return (
    <div className={styles.suggestBox}>
      <VStack gap={2}>
        <Text type="label">자동 근거 · {EVAL_AUTO_SOURCE_LABEL[source]}</Text>
        {loading ? (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" aria-label="자동 근거를 세는 중" />
            <Text type="supporting" color="secondary">
              케어브이 기록을 세는 중...
            </Text>
          </HStack>
        ) : error ? (
          <ErrorBanner message={error} onRetry={() => void load()} />
        ) : (
          evidence && (
            <>
              <VStack gap={1}>
                {evidence.lines.map((line) => (
                  <Text key={line} type="body">
                    {line}
                  </Text>
                ))}
              </VStack>
              <div>
                <Button label="근거 글에 넣기" size="sm" variant="secondary" onClick={() => onUse(evidence.lines.join('\n'))} />
              </div>
            </>
          )
        )}
      </VStack>
    </div>
  );
}
