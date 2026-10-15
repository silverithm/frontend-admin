/** 감염병 유행·발생 기록 입력 초안 — 칸 모양, 서버 입력으로 바꾸기, 검사 */
import type { Outbreak, OutbreakActionKey, OutbreakAlertLevel, OutbreakInput, OutbreakKind } from '@/lib/lab/labTypes';
import { isValidYmd } from '@/lib/lab/labDate';
import { OUTBREAK_ACTIONS } from '@/lib/lab/outbreakRules';
import { orNull } from './recordsFormat';

export const DISEASE_MAX = 50;
export const NOTE_MAX = 1000;
export const CASES_MAX = 500;

export const OUTBREAK_KINDS: ReadonlyArray<{ value: OutbreakKind; label: string }> = [
  { value: 'OUTBREAK', label: '기관 내 유행' },
  { value: 'CASE', label: '확진·의심 발생' },
  { value: 'NATIONAL', label: '국가 위기 경보' },
];

export const ALERT_LEVELS: ReadonlyArray<{ value: OutbreakAlertLevel; label: string }> = [
  { value: 'BLUE', label: '관심' },
  { value: 'YELLOW', label: '주의' },
  { value: 'ORANGE', label: '경계' },
  { value: 'RED', label: '심각' },
];

export const kindLabel = (k: string): string => OUTBREAK_KINDS.find((x) => x.value === k)?.label ?? k;
export const alertLabel = (l: string | null): string => ALERT_LEVELS.find((x) => x.value === l)?.label ?? '';
export const actionLabel = (a: string): string => OUTBREAK_ACTIONS.find((x) => x.key === a)?.label ?? a;

export interface OutbreakDraft {
  kind: OutbreakKind;
  disease: string;
  startedOn: string;
  /** 숫자 칸은 글자로 들고 있다가 저장할 때 숫자로 바꾼다 */
  elderCases: string;
  staffCases: string;
  guardianOn: string;
  healthCenterOn: string;
  authorityOn: string;
  alertLevel: OutbreakAlertLevel | '';
  actions: OutbreakActionKey[];
  endedOn: string;
  note: string;
}

export function newOutbreakDraft(today: string): OutbreakDraft {
  return { kind: 'OUTBREAK', disease: '', startedOn: today, elderCases: '0', staffCases: '0', guardianOn: '', healthCenterOn: '', authorityOn: '', alertLevel: '', actions: [], endedOn: '', note: '' };
}

export function draftFromOutbreak(o: Outbreak): OutbreakDraft {
  return {
    kind: o.kind,
    disease: o.disease,
    startedOn: o.startedOn.slice(0, 10),
    elderCases: String(o.elderCases),
    staffCases: String(o.staffCases),
    guardianOn: o.guardianNotifiedOn?.slice(0, 10) ?? '',
    healthCenterOn: o.healthCenterReportedOn?.slice(0, 10) ?? '',
    authorityOn: o.authorityReportedOn?.slice(0, 10) ?? '',
    alertLevel: o.alertLevel ?? '',
    actions: [...o.actions],
    endedOn: o.endedOn?.slice(0, 10) ?? '',
    note: o.note ?? '',
  };
}

export const outbreakSnapshot = (d: OutbreakDraft): string => JSON.stringify(d);

const count = (text: string): number | null => (/^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : null);

/** 저장 막는 문제(없으면 null) — 서버 규칙과 같다: 병명 필수, 미래 날짜 불가, 신고·보고·종료일은 시작일 이후, 국가 위기면 단계 필수 */
export function outbreakProblem(d: OutbreakDraft, today: string): string | null {
  if (d.disease.trim() === '') return '병명이나 증상을 적어 주세요';
  if (!isValidYmd(d.startedOn)) return '시작일을 골라 주세요';
  if (d.startedOn > today) return '시작일은 오늘 이후로 적을 수 없습니다';
  if (d.kind !== 'NATIONAL') {
    for (const [name, text] of [['수급자 환자 수', d.elderCases], ['직원 환자 수', d.staffCases]] as const) {
      const n = count(text);
      if (n === null || n > CASES_MAX) return `${name}는 0부터 ${CASES_MAX}명까지 숫자로 적어 주세요`;
    }
  }
  if (d.kind === 'NATIONAL' && d.alertLevel === '') return '국가 위기 경보 단계를 골라 주세요';
  const dates: Array<[string, string]> = d.kind === 'NATIONAL' ? [['종료일', d.endedOn]] : [['보호자 안내일', d.guardianOn], ['보건소 신고일', d.healthCenterOn], ['지자체·공단 보고일', d.authorityOn], ['종료일', d.endedOn]];
  for (const [name, v] of dates) {
    if (v === '') continue;
    if (v > today) return `${name}은 오늘 이후로 적을 수 없습니다`;
    if (v < d.startedOn) return `${name}은 시작일과 같거나 이후여야 합니다`;
  }
  return null;
}

export function outbreakInput(d: OutbreakDraft): OutbreakInput {
  const national = d.kind === 'NATIONAL';
  const date = (v: string): string | null => (v === '' || national ? null : v);
  return {
    kind: d.kind,
    disease: d.disease.trim(),
    startedOn: d.startedOn,
    elderCases: national ? 0 : count(d.elderCases) ?? 0,
    staffCases: national ? 0 : count(d.staffCases) ?? 0,
    guardianNotifiedOn: date(d.guardianOn),
    healthCenterReportedOn: date(d.healthCenterOn),
    authorityReportedOn: date(d.authorityOn),
    alertLevel: national && d.alertLevel !== '' ? d.alertLevel : null,
    actions: OUTBREAK_ACTIONS.map((a) => a.key).filter((k) => d.actions.includes(k)),
    endedOn: d.endedOn === '' ? null : d.endedOn,
    note: orNull(d.note),
  };
}
