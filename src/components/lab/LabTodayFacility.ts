/**
 * 오늘 확인할 것 카드의 12차 줄 둘 — 시설 관리(법정 점검 기한)와 인지활동형(오늘 출석한 5등급·인지지원의 프로그램 제공 여부).
 * 규칙은 lib/lab의 facilityLedgerRules·cognitiveProgramRules를 그대로 쓴다. 줄이 실패하면 카드가 그 줄만 숨긴다(throw).
 */
import { getElderAttendanceList } from '@/lib/apiService';
import { getFacilityProfile, listFacilityLogs, listPrograms } from '@/lib/lab/labApi';
import { COGNITIVE_STATE_LABEL, cognitiveCoverage } from '@/lib/lab/cognitiveProgramRules';
import { facilityItem, ledgerSummary } from '@/lib/lab/facilityLedgerRules';
import type { LedgerRow } from '@/lib/lab/facilityLedgerRules';
import { dayStatusesOf } from './CareRecordLabAttendance';
import { dotDate } from './labFormat';
import { fetchLabElders } from './useLabElders';
import type { TodayLine } from './LabTodayData';

const none = (): TodayLine => ({ count: 0, text: '확인할 것 없음', preview: null, danger: false });

export async function loadFacilityLine(today: string): Promise<TodayLine> {
  // 기한이 해를 넘겨 이어지는 항목(보험 만기 등)이 있어 올해와 작년 기록을 함께 본다
  const year = Number(today.slice(0, 4));
  const [profile, thisYear, lastYear] = await Promise.all([getFacilityProfile(), listFacilityLogs({ year }), listFacilityLogs({ year: year - 1 })]);
  const summary = ledgerSummary(profile, [...thisYear, ...lastYear], today);
  const count = summary.overdue + summary.soon;
  if (count === 0) return none();
  const live = summary.rows.filter((r) => r.applies === 'YES');
  const overdueRows = live.filter((r) => r.status === 'OVERDUE');
  const soonRows = live
    .filter((r): r is LedgerRow & { daysLeft: number } => (r.status === 'DUE' || r.status === 'IN_WINDOW') && r.daysLeft !== null && r.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const first = overdueRows[0] ?? soonRows[0];
  const name = first ? (facilityItem(first.code)?.name ?? first.code) : '';
  const detail = !first ? '' : first.status === 'OVERDUE' ? `기한 ${dotDate(first.dueYmd)} 지남` : `기한 ${dotDate(first.dueYmd)}까지 ${first.daysLeft}일 남음`;
  return {
    count,
    text: [summary.overdue > 0 ? `기한 지남 ${summary.overdue}건` : '', summary.soon > 0 ? `30일 안 ${summary.soon}건` : ''].filter(Boolean).join(' · '),
    preview: first ? `${name} — ${detail}` : null,
    danger: summary.overdue > 0,
  };
}

export async function loadCognitiveLine(today: string): Promise<TodayLine> {
  const [attendance, elders, programs] = await Promise.all([getElderAttendanceList(today), fetchLabElders(), listPrograms(today.slice(0, 7))]);
  const statuses = dayStatusesOf(attendance);
  const attendees = elders.filter((e) => statuses.get(e.id) === 'PRESENT').map((e) => ({ elderlyId: e.id, careGrade: e.careGrade }));
  const gaps = cognitiveCoverage(today, attendees, programs).filter((r) => r.state !== 'OK');
  if (gaps.length === 0) return none();
  // 프로그램은 했는데 조건을 못 채운 경우(60분 미만·제공자 불인정)는 오늘 안에 고치기 어렵다 — 위험. 아직 참여 기록이 없는 분은 주의
  const failed = gaps.filter((g) => g.state !== 'NO_SESSION');
  const first = failed[0] ?? gaps[0];
  const name = elders.find((e) => e.id === first.elderlyId)?.name ?? '';
  return {
    count: gaps.length,
    text: [failed.length > 0 ? `조건 미달 ${failed.length}명` : '', gaps.length > failed.length ? `참여 기록 없음 ${gaps.length - failed.length}명` : ''].filter(Boolean).join(' · '),
    preview: `${name ? `${name} — ` : ''}${COGNITIVE_STATE_LABEL[first.state]}`,
    danger: failed.length > 0,
  };
}
