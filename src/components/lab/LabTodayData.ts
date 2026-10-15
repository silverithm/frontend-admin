/**
 * 실험실 첫 화면 "오늘 확인할 것" 카드의 여덟 줄 계산 — 계약 알림, 오늘 투약 대기, 약품 사용기한, 입소 상담 연락, 진료 후속 확인, 건강검진 기한, 사례관리 기한, 차량 보험.
 * 줄마다 따로 불러온다(한 줄이 실패해도 나머지는 보인다). 규칙은 lib/lab의 contractAlerts·dosesDue·doseStatus·expiringStock을 그대로 쓴다.
 */
import { listCaseMeetings, listElderContracts, listIntake, listMedicalVisits, listMedicationDoses, listMedicationRequests, listMedicineStock, listStaffCerts, listStaffProfiles, listTransportVehicles } from '@/lib/lab/labApi';
import { followUpAlerts } from '@/lib/lab/caseMeetingRules';
import { insuranceStatus } from '@/lib/lab/transportRules';
import { contractAlerts } from '@/lib/lab/contractRules';
import { followUpsDue } from '@/lib/lab/medicalVisitRules';
import { inquiryAlerts } from '@/lib/lab/intakeRules';
import { doseStatus, dosesDue, expiringStock, slotLabel } from '@/lib/lab/medicationRules';
import { healthCheckStatus } from '@/lib/lab/staffHrRules';
import { dotDate } from './labFormat';

export type TodayLineId = 'contract' | 'dose' | 'stock' | 'intake' | 'visit' | 'health' | 'caseMeeting' | 'vehicle';

/** 줄을 눌렀을 때 여는 도구 */
export type TodayTarget = 'contract' | 'medication' | 'intake' | 'medicalVisit' | 'staffHr' | 'caseMeeting' | 'transport';

export interface TodayLine {
  /** 확인이 필요한 건수(0이면 "확인할 것 없음") */
  count: number;
  /** 한 줄 요약. count가 0이면 항상 '확인할 것 없음' */
  text: string;
  /** 가장 급한 것 하나 */
  preview: string | null;
  /** 위험(빨강)이 있는가 — 없으면 주의(노랑) */
  danger: boolean;
}

export const NOTHING_TO_CHECK = '확인할 것 없음';

const none = (): TodayLine => ({ count: 0, text: NOTHING_TO_CHECK, preview: null, danger: false });

export async function loadContractLine(today: string): Promise<TodayLine> {
  const contracts = await listElderContracts({ status: 'ACTIVE' });
  const alerts = contractAlerts(contracts, today).filter((a) => a.level !== 'INFO');
  if (alerts.length === 0) return none();
  const danger = alerts.filter((a) => a.level === 'DANGER').length;
  const warn = alerts.length - danger;
  const first = alerts[0];
  const name = contracts.find((c) => c.id === first.contractId)?.elderlyName ?? '';
  return {
    count: alerts.length,
    text: [danger > 0 ? `위험 ${danger}건` : '', warn > 0 ? `주의 ${warn}건` : ''].filter(Boolean).join(' · '),
    preview: name ? `${name} — ${first.message}` : first.message,
    danger: danger > 0,
  };
}

export async function loadDoseLine(today: string): Promise<TodayLine> {
  const [requests, doses] = await Promise.all([listMedicationRequests({ status: 'ACTIVE' }), listMedicationDoses({ date: today })]);
  const pending = doseStatus(dosesDue(requests, today), doses).filter((d) => d.state === 'PENDING');
  if (pending.length === 0) return none();
  const elders = new Set(pending.map((d) => d.elderlyId)).size;
  const first = pending[0];
  const name = requests.find((r) => r.id === first.requestId)?.elderlyName ?? '';
  return {
    count: pending.length,
    text: `대기 ${pending.length}건 (어르신 ${elders}명)`,
    preview: `${name ? `${name} · ` : ''}${slotLabel(first.slot)} ${first.medicines.map((m) => m.name).join(', ')}`,
    danger: false,
  };
}

export async function loadStockLine(today: string): Promise<TodayLine> {
  const { expired, soon } = expiringStock(await listMedicineStock(), today);
  const count = expired.length + soon.length;
  if (count === 0) return none();
  const first = expired[0] ?? soon[0];
  return {
    count,
    text: [expired.length > 0 ? `사용기한 지남 ${expired.length}건` : '', soon.length > 0 ? `30일 안 임박 ${soon.length}건` : ''].filter(Boolean).join(' · '),
    preview: `${first.name} — ${dotDate(first.expiresOn)}${expired.length > 0 ? ' 지남' : '까지'}`,
    danger: expired.length > 0,
  };
}

export async function loadIntakeLine(today: string): Promise<TodayLine> {
  const inquiries = await listIntake();
  const due = inquiryAlerts(inquiries, today).filter((a) => a.code === 'FOLLOW_UP_DUE');
  if (due.length === 0) return none();
  // 연락 예정일이 가장 오래 지난 문의를 미리 보여 준다
  const dueOf = (id: number) => inquiries.find((q) => q.id === id)?.nextContactOn?.slice(0, 10) ?? '';
  const oldest = [...due].sort((a, b) => dueOf(a.inquiryId).localeCompare(dueOf(b.inquiryId)) || a.inquiryId - b.inquiryId)[0];
  const name = inquiries.find((q) => q.id === oldest.inquiryId)?.applicantName ?? '';
  return {
    count: due.length,
    text: `연락 예정 ${due.length}건`,
    preview: name ? `${name} — ${oldest.message}` : oldest.message,
    danger: false,
  };
}

export async function loadVisitLine(today: string): Promise<TodayLine> {
  // 서버가 후속 확인일이 오늘이거나 지났고 아직 확인하지 않은 기록만 주지만, 날짜 순서와 건수는 같은 규칙으로 다시 센다
  const visits = await listMedicalVisits({ followUpDue: true });
  const due = followUpsDue(visits, today);
  if (due.length === 0) return none();
  const first = due[0];
  return {
    count: due.length,
    text: `후속 확인 ${due.length}건`,
    preview: `${first.elderlyName ? `${first.elderlyName} · ` : ''}${first.hospital} — 확인일 ${dotDate(first.followUpOn!)}`,
    danger: false,
  };
}

export async function loadHealthLine(today: string): Promise<TodayLine> {
  const [profiles, certs] = await Promise.all([listStaffProfiles(), listStaffCerts()]);
  // 입사일이 오늘 뒤인 입사 예정자는 아직 검진 대상이 아니다
  const rows = profiles
    .filter((p) => p.hireDate.slice(0, 10) <= today)
    .map((p) => ({ name: p.memberName ?? '', ...healthCheckStatus(p, certs, today) }))
    .filter((r) => r.status === 'OVERDUE' || r.status === 'DUE_SOON');
  if (rows.length === 0) return none();
  const overdue = rows.filter((r) => r.status === 'OVERDUE').length;
  const soon = rows.length - overdue;
  // 기한이 지난 사람 중 가장 오래된 것, 없으면 가장 먼저 닥치는 것
  const first = [...rows].sort((a, b) => (a.status === b.status ? 0 : a.status === 'OVERDUE' ? -1 : 1) || (a.dueOn ?? '').localeCompare(b.dueOn ?? ''))[0];
  return {
    count: rows.length,
    text: [overdue > 0 ? `기한 지남 ${overdue}명` : '', soon > 0 ? `30일 안 임박 ${soon}명` : ''].filter(Boolean).join(' · '),
    preview: `${first.name ? `${first.name} — ` : ''}검진 기한 ${dotDate(first.dueOn)}${first.status === 'OVERDUE' ? ' 지남' : '까지'}`,
    danger: overdue > 0,
  };
}

export async function loadCaseMeetingLine(today: string): Promise<TodayLine> {
  // 반영·평가 기한은 회의 다음날부터 30일이라 작년 12월 회의가 올해 1월에 닿을 수 있다 — 올해와 작년 회의를 함께 본다
  const year = Number(today.slice(0, 4));
  const meetings = (await Promise.all([listCaseMeetings(year), listCaseMeetings(year - 1)])).flat();
  const alerts = followUpAlerts(meetings, today);
  if (alerts.length === 0) return none();
  const overdue = alerts.filter((a) => a.daysLeft < 0).length;
  const soon = alerts.length - overdue;
  // 가장 급한 것 = 기한이 가장 이른 것(지난 것이 먼저 온다)
  const first = [...alerts].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.elderlyId - b.elderlyId)[0];
  const meeting = meetings.find((m) => m.id === first.meetingId);
  const name = meeting?.targets.find((t) => t.elderlyId === first.elderlyId)?.elderlyName ?? '';
  const what = first.kind === 'REFLECT' ? '반영' : '평가';
  return {
    count: alerts.length,
    text: [overdue > 0 ? `기한 지남 ${overdue}건` : '', soon > 0 ? `5일 안 임박 ${soon}건` : ''].filter(Boolean).join(' · '),
    preview: `${name ? `${name} — ` : ''}${what} 기한 ${dotDate(first.dueOn)}${first.daysLeft < 0 ? ' 지남' : first.daysLeft === 0 ? ' (오늘)' : `까지 ${first.daysLeft}일 남음`}`,
    danger: overdue > 0,
  };
}

/** 위험 먼저(만기 지남 → 종합보험 아님), 그다음 임박 */
const INSURANCE_RANK = { EXPIRED: 0, NOT_COMPREHENSIVE: 1, EXPIRING: 2 } as const;

export async function loadVehicleLine(today: string): Promise<TodayLine> {
  const vehicles = await listTransportVehicles();
  const rows = vehicles
    .filter((v) => v.active)
    .map((v) => ({ v, status: insuranceStatus(v, today) }))
    .filter((r): r is { v: typeof r.v; status: keyof typeof INSURANCE_RANK } => r.status === 'EXPIRED' || r.status === 'NOT_COMPREHENSIVE' || r.status === 'EXPIRING');
  if (rows.length === 0) return none();
  const expired = rows.filter((r) => r.status === 'EXPIRED').length;
  const plain = rows.filter((r) => r.status === 'NOT_COMPREHENSIVE').length;
  const soon = rows.length - expired - plain;
  const first = [...rows].sort((a, b) => INSURANCE_RANK[a.status] - INSURANCE_RANK[b.status] || (a.v.insuranceTo ?? '').localeCompare(b.v.insuranceTo ?? '') || a.v.vehicleNo.localeCompare(b.v.vehicleNo))[0];
  const detail =
    first.status === 'EXPIRED' ? `보험 만기 ${dotDate(first.v.insuranceTo)} 지남` : first.status === 'NOT_COMPREHENSIVE' ? '종합보험이 아님 — 책임보험만으로는 인정 안 됨' : `보험 만기 ${dotDate(first.v.insuranceTo)}까지 30일 안`;
  return {
    count: rows.length,
    text: [expired > 0 ? `만기 지남 ${expired}대` : '', plain > 0 ? `종합보험 아님 ${plain}대` : '', soon > 0 ? `30일 안 임박 ${soon}대` : ''].filter(Boolean).join(' · '),
    preview: `${first.v.vehicleNo}${first.v.label ? `(${first.v.label})` : ''} — ${detail}`,
    danger: expired > 0 || plain > 0,
  };
}
