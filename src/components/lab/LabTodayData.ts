/**
 * 실험실 첫 화면 "오늘 확인할 것" 카드의 다섯 줄 계산 — 계약 알림, 오늘 투약 대기, 약품 사용기한, 입소 상담 연락, 진료 후속 확인.
 * 줄마다 따로 불러온다(한 줄이 실패해도 나머지는 보인다). 규칙은 lib/lab의 contractAlerts·dosesDue·doseStatus·expiringStock을 그대로 쓴다.
 */
import { listElderContracts, listIntake, listMedicalVisits, listMedicationDoses, listMedicationRequests, listMedicineStock } from '@/lib/lab/labApi';
import { contractAlerts } from '@/lib/lab/contractRules';
import { followUpsDue } from '@/lib/lab/medicalVisitRules';
import { inquiryAlerts } from '@/lib/lab/intakeRules';
import { doseStatus, dosesDue, expiringStock, slotLabel } from '@/lib/lab/medicationRules';
import { dotDate } from './labFormat';

export type TodayLineId = 'contract' | 'dose' | 'stock' | 'intake' | 'visit';

/** 줄을 눌렀을 때 여는 도구 */
export type TodayTarget = 'contract' | 'medication' | 'intake' | 'medicalVisit';

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
