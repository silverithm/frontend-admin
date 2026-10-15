/**
 * 평가 지표 자동 근거 중 12차에 더한 셋 — 감염 예방·관리(INFECTION_CONTROL)의 분기별 전문소독 줄, 재난 대응(DRILL_TWICE)의 소방 작동점검 줄,
 * 급여제공기록 품질(CARE_RECORD_QUALITY)의 영역 제공 직원 서명 줄. EvalAutoEvidence의 collect가 이 줄들을 기존 근거 뒤에 붙인다.
 * 규칙은 lib/lab의 facilityLedgerRules·careRecordFormRules가 맡는다. 일부 조회가 실패하면 그 줄만 "계산하지 못했습니다"로 둔다.
 */
import { getFacilityProfile, listCareRecordsByDate, listFacilityLogs } from '@/lib/lab/labApi';
import { writersMissing } from '@/lib/lab/careRecordFormRules';
import { CARE_FORM_SECTIONS } from '@/lib/lab/careRecordFormRules';
import { nextDue } from '@/lib/lab/facilityLedgerRules';
import type { DueStatus } from '@/lib/lab/facilityLedgerRules';
import { dotDate, monthDates } from './labFormat';
import { FAILED, attempt, perDate } from './EvalAutoEvidenceShared';

const STATUS_LABEL: Readonly<Record<DueStatus, string>> = {
  OK: '이번 기한 이행',
  DUE: '기한이 가까움',
  IN_WINDOW: '점검 시기(기한 안)',
  OVERDUE: '기한 지남',
  NEVER: '실시 기록 없음',
  NEED_INFO: '시설 정보(사용승인일) 입력 필요',
};

const dueText = (daysLeft: number | null, dueYmd: string | null): string => {
  if (dueYmd === null || daysLeft === null) return '';
  if (daysLeft < 0) return ` · 기한 ${dotDate(dueYmd)}(${-daysLeft}일 지남)`;
  if (daysLeft === 0) return ` · 기한 ${dotDate(dueYmd)}(오늘)`;
  return ` · 기한 ${dotDate(dueYmd)}(${daysLeft}일 남음)`;
};

/** 분기별 전문소독(평가 지표 16②) — 다음 기한과 올해 1~4분기 실시 여부 */
export async function infectionDisinfectLines(asOf: string): Promise<string[]> {
  const logs = await attempt(() => listFacilityLogs({ itemCode: 'DISINFECT_QUARTERLY' }));
  if (logs === null) return [`분기별 전문소독: ${FAILED}`];
  const year = Number(asOf.slice(0, 4));
  const thisQuarter = Math.floor((Number(asOf.slice(5, 7)) - 1) / 3) + 1;
  const chips = [1, 2, 3, 4].map((q) => {
    const done = logs.some((l) => l.doneOn.slice(0, 4) === String(year) && Math.floor((Number(l.doneOn.slice(5, 7)) - 1) / 3) + 1 === q);
    return `${q}분기 ${done ? '실시함' : q > thisQuarter ? '아직 때 아님' : '기록 없음'}`;
  });
  const due = nextDue('DISINFECT_QUARTERLY', logs, null, asOf);
  return [
    `${year}년 분기별 전문소독(시설 관리 대장): ${chips.join(' · ')}`,
    `이번 분기 상태: ${STATUS_LABEL[due.status]}${dueText(due.daysLeft, due.dueYmd)} (${asOf} 기준)`,
    '살균·살충·살서를 모두 했는지와 계약서·소독증명서·지출내역은 서류로 확인해 주세요',
  ];
}

/** 법정 소방시설 작동점검(소방시설법) — 다음 기한 한 줄 */
export async function fireOperationLines(asOf: string): Promise<string[]> {
  const [profile, logs] = await Promise.all([attempt(() => getFacilityProfile()), attempt(() => listFacilityLogs({ itemCode: 'FIRE_OPERATION' }))]);
  if (profile === null || logs === null) return [`법정 소방시설 작동점검: ${FAILED}`];
  const due = nextDue('FIRE_OPERATION', logs, profile, asOf);
  const last = logs.length > 0 ? logs.map((l) => l.doneOn.slice(0, 10)).sort().at(-1) : null;
  return [`법정 소방시설 작동점검(시설 관리 대장): ${STATUS_LABEL[due.status]}${dueText(due.daysLeft, due.dueYmd)}${last ? ` · 마지막 실시 ${dotDate(last)}` : ''} (${asOf} 기준)`];
}

/** 이번 달 급여제공기록 중 영역 제공 직원 서명이 빠진 기록 수(별지 제15호 유의사항 7) */
export async function careWriterLines(asOf: string): Promise<string[]> {
  const month = asOf.slice(0, 7);
  const dates = monthDates(month).filter((d) => d <= asOf);
  const records = await attempt(() => perDate(dates, (d) => listCareRecordsByDate(d)));
  if (records === null) return [`영역 제공 직원 서명 점검: ${FAILED}`];
  if (records.length === 0) return [`이번 달(${month}) 저장된 급여제공기록이 없어 영역 서명을 점검할 수 없습니다`];
  const withForm = records.filter((r) => r.form !== null);
  const missing = withForm.filter((r) => r.form && writersMissing(r.form, r).length > 0);
  const perSection = CARE_FORM_SECTIONS.map((s) => `${s.label} ${withForm.filter((r) => r.form && writersMissing(r.form, r).includes(s.key)).length}건`).join(' · ');
  const lines = [`이번 달 서식 칸이 있는 기록 ${withForm.length}건 중 영역 제공 직원 서명이 빠진 기록: ${missing.length}건 (${asOf} 기준)`];
  if (missing.length > 0) lines.push(`영역별 빠진 기록: ${perSection}`);
  if (withForm.length < records.length) lines.push(`서식 칸 없이 저장된 기록 ${records.length - withForm.length}건은 서명 점검에 넣지 않았습니다`);
  return lines;
}
