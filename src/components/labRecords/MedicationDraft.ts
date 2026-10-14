/** 투약 관리 입력 초안 — 투약의뢰서 칸·투약 기록 칸·약품 대장 칸의 모양과 검사 */
import type {
  MedicationDoseInput,
  MedicationDoseStatus,
  MedicationItem,
  MedicationRequest,
  MedicationRequestInput,
  MedicationSlot,
  MedicineStock,
  MedicineStockInput,
  RequesterRelation,
} from '@/lib/lab/labTypes';
import { MAX_MEDICINES, MAX_MEDICINE_DOSE, MAX_MEDICINE_NAME, MAX_MEDICINE_NOTE } from '@/lib/lab/medicationRules';
import { defaultPersonName, todayString } from '@/components/lab/labFormat';
import { orNull } from './recordsFormat';

export const REQUEST_NOTE_MAX = 500;
export const OBSERVATION_MAX = 500;
export const REQUESTER_MAX = 50;

/** 지금 시각 'HH:MM'(서울) */
export function nowHm(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${h === '24' ? '00' : h}:${m}`;
  } catch {
    return '';
  }
}

// ---------- 투약 기록 ----------

export interface DoseDraft {
  status: MedicationDoseStatus;
  givenAt: string;
  giver: string;
  observation: string;
}

export function newDoseDraft(status: MedicationDoseStatus): DoseDraft {
  return { status, givenAt: status === 'GIVEN' ? nowHm() : '', giver: defaultPersonName(), observation: '' };
}

export function validateDose(d: DoseDraft): string | null {
  if (d.status === 'GIVEN' && d.givenAt === '') return '투약한 시각을 14:30처럼 적어 주세요';
  if (d.giver.trim() === '') return d.status === 'GIVEN' ? '투약한 사람 이름을 적어 주세요' : '처리한 사람 이름을 적어 주세요';
  return null;
}

export function doseInput(base: { elderlyId: number; requestId: number; givenOn: string; slot: MedicationSlot }, d: DoseDraft): MedicationDoseInput {
  return {
    ...base,
    status: d.status,
    givenAt: d.status === 'GIVEN' ? d.givenAt : null,
    giverName: d.giver.trim(),
    observation: orNull(d.observation),
  };
}

// ---------- 투약의뢰서 ----------

let itemKey = 0;

export interface ItemDraft extends MedicationItem {
  key: number;
  /** AI가 제안한 약 — 직원이 고치면 표시가 사라진다 */
  ai: boolean;
}

export function blankItem(): ItemDraft {
  itemKey += 1;
  return { key: itemKey, name: '', dose: '', route: 'ORAL', slots: [], timing: 'AFTER_MEAL', note: '', ai: false };
}

export function itemFrom(item: MedicationItem, ai = false): ItemDraft {
  itemKey += 1;
  return { key: itemKey, name: item.name, dose: item.dose ?? '', route: item.route, slots: [...item.slots], timing: item.timing, note: item.note ?? '', ai };
}

export interface RequestDraft {
  elderId: number | null;
  requestedOn: string;
  requester: string;
  relation: RequesterRelation;
  startDate: string;
  endDate: string;
  prescriptionChecked: boolean;
  note: string;
  writer: string;
  items: ItemDraft[];
  memo: string;
  aiUsed: boolean;
}

export function newRequestDraft(elderId: number | null): RequestDraft {
  const today = todayString();
  return {
    elderId,
    requestedOn: today,
    requester: '',
    relation: 'CHILD',
    startDate: today,
    endDate: '',
    prescriptionChecked: false,
    note: '',
    writer: defaultPersonName(),
    items: [blankItem()],
    memo: '',
    aiUsed: false,
  };
}

export function draftFromRequest(r: MedicationRequest): RequestDraft {
  return {
    elderId: r.elderlyId,
    requestedOn: r.requestedOn.slice(0, 10),
    requester: r.requesterName,
    relation: r.requesterRelation,
    startDate: r.startDate.slice(0, 10),
    endDate: r.endDate ? r.endDate.slice(0, 10) : '',
    prescriptionChecked: r.prescriptionChecked,
    note: r.note ?? '',
    writer: r.writerName,
    items: r.medicines.map((m) => itemFrom(m)),
    memo: '',
    aiUsed: false,
  };
}

/** 저장 전에 고쳐야 할 점(문장 목록). 비어 있으면 저장할 수 있다. */
export function requestProblems(d: RequestDraft): string[] {
  const out: string[] = [];
  if (d.elderId === null) out.push('어르신을 골라 주세요');
  if (d.requester.trim() === '') out.push('의뢰한 사람 이름을 적어 주세요');
  if (d.requestedOn === '') out.push('의뢰한 날을 골라 주세요');
  if (d.startDate === '') out.push('투약을 시작하는 날을 골라 주세요');
  if (d.endDate !== '' && d.startDate !== '' && d.endDate < d.startDate) out.push('끝나는 날은 시작하는 날과 같거나 그 뒤여야 합니다');
  if (d.writer.trim() === '') out.push('받은 직원 이름을 적어 주세요');
  if (d.items.length === 0) out.push('약을 한 가지 이상 적어 주세요');
  if (d.items.length > MAX_MEDICINES) out.push(`약은 ${MAX_MEDICINES}가지까지 적을 수 있습니다`);
  d.items.forEach((m, i) => {
    const at = `${i + 1}번째 약`;
    if (m.name.trim() === '') out.push(`${at}: 약 이름을 적어 주세요`);
    else if (Array.from(m.name.trim()).length > MAX_MEDICINE_NAME) out.push(`${at}: 이름은 ${MAX_MEDICINE_NAME}자까지입니다`);
    if (m.slots.length === 0) out.push(`${at}: 먹는 시간대를 하나 이상 골라 주세요`);
  });
  return out;
}

export function requestInput(d: RequestDraft, status: MedicationRequest['status'], aiAssisted: boolean): MedicationRequestInput {
  return {
    elderlyId: d.elderId as number,
    requestedOn: d.requestedOn,
    requesterName: d.requester.trim(),
    requesterRelation: d.relation,
    medicines: d.items.map((m) => ({
      name: m.name.trim().slice(0, MAX_MEDICINE_NAME),
      dose: m.dose.trim().slice(0, MAX_MEDICINE_DOSE),
      route: m.route,
      slots: m.slots,
      timing: m.timing,
      note: m.note.trim().slice(0, MAX_MEDICINE_NOTE),
    })),
    startDate: d.startDate,
    endDate: d.endDate === '' ? null : d.endDate,
    prescriptionChecked: d.prescriptionChecked,
    status,
    note: orNull(d.note),
    writerName: d.writer.trim(),
    aiAssisted,
  };
}

/** 의뢰서를 끝낼 때의 입력 — 끝나는 날이 없거나 오늘보다 뒤면 오늘(시작일보다 앞서지 않게)로 맞춘다 */
export function endedInput(r: MedicationRequest, today: string): MedicationRequestInput {
  const start = r.startDate.slice(0, 10);
  const end = r.endDate ? r.endDate.slice(0, 10) : null;
  const finish = end !== null && end <= today ? end : today < start ? start : today;
  return {
    elderlyId: r.elderlyId,
    requestedOn: r.requestedOn.slice(0, 10),
    requesterName: r.requesterName,
    requesterRelation: r.requesterRelation,
    medicines: r.medicines,
    startDate: start,
    endDate: finish,
    prescriptionChecked: r.prescriptionChecked,
    status: 'ENDED',
    note: r.note,
    writerName: r.writerName,
    aiAssisted: r.aiAssisted,
  };
}

// ---------- 약품 대장 ----------

export interface StockDraft {
  name: string;
  efficacy: string;
  quantity: number | null;
  unit: string;
  storage: MedicineStock['storage'];
  expiresOn: string;
  openedOn: string;
  disposedOn: string;
  note: string;
}

export function newStockDraft(): StockDraft {
  return { name: '', efficacy: '', quantity: null, unit: '개', storage: 'ROOM', expiresOn: '', openedOn: '', disposedOn: '', note: '' };
}

export function draftFromStock(s: MedicineStock): StockDraft {
  return {
    name: s.name,
    efficacy: s.efficacy,
    quantity: s.quantity,
    unit: s.unit,
    storage: s.storage,
    expiresOn: s.expiresOn.slice(0, 10),
    openedOn: s.openedOn ? s.openedOn.slice(0, 10) : '',
    disposedOn: s.disposedOn ? s.disposedOn.slice(0, 10) : '',
    note: s.note ?? '',
  };
}

export function stockProblems(d: StockDraft): string[] {
  const out: string[] = [];
  if (d.name.trim() === '') out.push('약품 이름을 적어 주세요');
  if (d.efficacy.trim() === '') out.push('효능을 적어 주세요(예: 해열진통)');
  if (d.quantity === null) out.push('수량을 적어 주세요');
  if (d.unit.trim() === '') out.push('단위를 적어 주세요(예: 정, 개, 병)');
  if (d.expiresOn === '') out.push('사용기한을 골라 주세요');
  if (d.openedOn !== '' && d.expiresOn !== '' && d.openedOn > d.expiresOn) out.push('개봉일이 사용기한보다 늦습니다');
  return out;
}

export function stockInput(d: StockDraft): MedicineStockInput {
  return {
    name: d.name.trim(),
    efficacy: d.efficacy.trim(),
    quantity: d.quantity ?? 0,
    unit: d.unit.trim(),
    storage: d.storage,
    expiresOn: d.expiresOn,
    openedOn: d.openedOn === '' ? null : d.openedOn,
    disposedOn: d.disposedOn === '' ? null : d.disposedOn,
    note: orNull(d.note),
  };
}
