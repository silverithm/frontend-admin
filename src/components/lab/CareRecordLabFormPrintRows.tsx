/**
 * 별지 제15호서식 앞쪽의 칸 구성 — 이용·송영, 영역 네 개(체크·분·선택지·특이사항·작성자), 기타 특이사항.
 * 체크 칸은 □/■로 찍고, 서식에 없는 수급자·보호자 서명 칸은 만들지 않는다. 칸 이름은 서식 원문을 따른다.
 */
import type { ReactNode } from 'react';
import { CARE_FORM_REASONS, careRecordMinutes, emptyCareForm } from '@/lib/lab/careRecordFormRules';
import type { CareFormSectionKey, CareRecord, CareRecordFormView } from '@/lib/lab/labTypes';
import { dotDate } from './labFormat';
import styles from './labForm.module.css';

export interface PrintDay {
  date: string;
  record: CareRecord;
  form: CareRecordFormView;
}

export const toPrintDay = (record: CareRecord): PrintDay => ({ date: record.recordDate.slice(0, 10), record, form: record.form ?? emptyCareForm() });

const mark = (on: boolean) => (on ? '■' : '□');
const num = (n: number | null) => (n === null ? '' : String(n));
const hm = (v: string | null) => (v ? v.slice(0, 5) : '');

export interface PrintRow {
  key: string;
  /** 영역 이름(첫 줄에만) */
  area?: { label: string; rows: number };
  item: string;
  className?: string;
  /** 영역 칸 없이 항목 이름이 두 칸 폭을 차지하는 줄(이용·송영·기타 특이사항) */
  wide?: boolean;
  cell: (day: PrintDay) => ReactNode;
}

const noteOf = (parts: Array<string | null | undefined>): string => parts.filter((p): p is string => !!p && p.trim() !== '').join('\n');

/** 영역별 특이사항은 서술 칸에서 가져온다 — 신체활동=신체·식사·배설·목욕, 인지=인지, 건강=간호, 기능회복=훈련 */
export function sectionNote(section: CareFormSectionKey, r: CareRecord): string {
  switch (section) {
    case 'PHYSICAL':
      return noteOf([r.physical, r.meal && `식사: ${r.meal}`, r.toilet && `배설: ${r.toilet}`, r.bath && `목욕: ${r.bath}`]);
    case 'COGNITIVE':
      return noteOf([r.cognitive]);
    case 'HEALTH':
      return noteOf([r.nursing]);
    case 'REHAB':
      return noteOf([r.training]);
  }
}

/** 기타 특이사항 — 서술 칸의 특이사항과 고시가 적으라고 한 사유 */
export function otherNote(day: PrintDay): string {
  const reasons = day.form.reasons.filter((x) => x.text.trim() !== '').map((x) => `[${CARE_FORM_REASONS.find((r) => r.key === x.kind)?.label ?? x.kind}] ${x.text.trim()}`);
  return noteOf([day.record.specialNote, ...reasons]);
}

const signRow = (section: CareFormSectionKey): PrintRow => ({
  key: `${section}-sign`,
  item: '작성자 성명',
  className: styles.formSign,
  cell: (d) => (
    <>
      {d.form.writerNames?.[section] ?? ''}
      {'  (서명)'}
    </>
  ),
});

const noteRow = (section: CareFormSectionKey): PrintRow => ({ key: `${section}-note`, item: '특이사항', className: styles.formNote, cell: (d) => sectionNote(section, d.record) });

const withArea = (label: string, rows: PrintRow[]): PrintRow[] => rows.map((r, i) => (i === 0 ? { ...r, area: { label, rows: rows.length } } : r));

export const FRONT_ROWS: readonly PrintRow[] = [
  { key: 'date', wide: true, item: '년 월/일', cell: (d) => dotDate(d.date) },
  { key: 'minutes', wide: true, item: '총시간', cell: (d) => { const s = careRecordMinutes(d.form.startTime, d.form.endTime); return s ? `( ${s.minutes} )분` : '( )분'; } },
  { key: 'time', wide: true, item: '시작시간 / 종료시간', cell: (d) => `${hm(d.form.startTime)} / ${hm(d.form.endTime)}` },
  { key: 'transport', wide: true, item: '이동서비스 제공여부(차량번호)', cell: (d) => `${mark(d.form.transport)} ( ${d.form.vehicleNo ?? ''} )` },
  ...withArea('신체활동지원', [
    { key: 'wash', item: '세면·구강청결·머리감기·몸단장·옷 갈아입기 도움 등', cell: (d) => mark(d.form.washHelp) },
    { key: 'bath', item: '목욕 (분) / 방법', cell: (d) => `( ${num(d.form.bathMinutes)} )분  ${mark(d.form.bathMethod === 'FULL')}전신입욕  ${mark(d.form.bathMethod === 'SHOWER')}샤워식` },
    { key: 'mealKind', item: '식사 종류', cell: (d) => `${mark(d.form.mealKind === 'NORMAL')}일반식  ${mark(d.form.mealKind === 'PORRIDGE')}죽  ${mark(d.form.mealKind === 'LIQUID')}유동식(미음)` },
    { key: 'mealIntake', item: '식사 섭취량', cell: (d) => `${mark(d.form.mealIntake === 'FULL')}1  ${mark(d.form.mealIntake === 'HALF_OR_MORE')}1/2 이상  ${mark(d.form.mealIntake === 'LESS_THAN_HALF')}1/2 미만` },
    { key: 'toilet', item: '화장실이용하기(기저귀 교환)', cell: (d) => `( ${num(d.form.toiletCount)} )회` },
    { key: 'mobility', item: '이동도움 및 신체기능 유지·증진', cell: (d) => mark(d.form.mobilityHelp) },
    noteRow('PHYSICAL'),
    signRow('PHYSICAL'),
  ]),
  ...withArea('인지관리 및 의사소통', [
    { key: 'cog', item: '인지관리지원', cell: (d) => mark(d.form.cogSupport) },
    { key: 'comm', item: '의사소통도움 등 말벗·격려', cell: (d) => mark(d.form.commHelp) },
    noteRow('COGNITIVE'),
    signRow('COGNITIVE'),
  ]),
  ...withArea('건강 및 간호관리', [
    { key: 'vitals', item: '혈압 / 체온', cell: (d) => `${d.form.bpSystolic !== null && d.form.bpDiastolic !== null ? `${d.form.bpSystolic}/${d.form.bpDiastolic}` : ''}  /  ${d.form.temperature === null ? '' : d.form.temperature.toFixed(1)}` },
    { key: 'health', item: '건강관리 (분)', cell: (d) => `${mark((d.form.healthCareMinutes ?? 0) > 0)} ( ${num(d.form.healthCareMinutes)} )분` },
    { key: 'nursing', item: '간호관리 (분)', cell: (d) => `${mark((d.form.nursingCareMinutes ?? 0) > 0)} ( ${num(d.form.nursingCareMinutes)} )분` },
    { key: 'emergency', item: '기타(응급서비스)', cell: (d) => mark(d.form.emergency) },
    noteRow('HEALTH'),
    signRow('HEALTH'),
  ]),
  ...withArea('기능회복훈련', [
    { key: 'programs', item: '신체·인지기능 향상 프로그램(프로그램명)', cell: (d) => d.form.programNames ?? '' },
    { key: 'rehabPhysical', item: '신체기능·기본동작, 일상생활동작훈련', cell: (d) => mark(d.form.rehabPhysical) },
    { key: 'rehabCogActivity', item: '인지활동형 프로그램', cell: (d) => mark(d.form.rehabCogActivity) },
    { key: 'rehabCogTraining', item: '인지기능 향상훈련', cell: (d) => mark(d.form.rehabCogTraining) },
    { key: 'rehabPtOt', item: '물리(작업)치료', cell: (d) => mark(d.form.rehabPtOt) },
    noteRow('REHAB'),
    signRow('REHAB'),
  ]),
  { key: 'other', wide: true, item: '기타 특이사항', className: styles.formNote, cell: (d) => otherNote(d) },
];
