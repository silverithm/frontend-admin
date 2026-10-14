'use client';

/** 사고 보고서 한 장(A4) — 인쇄할 때만 나타나는 사본. 화면 입력값 그대로 찍는다. */
import { EVENT_KINDS, EVENT_SEVERITIES } from '@/lib/lab/careEventRules';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { EVENT_TEXT_LABEL, GUARDIAN_METHODS, guardianAtOf, occurredAtOf } from './CareEventDraft';
import type { CareEventDraft } from './CareEventDraft';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';

const timeText = (value: string | null): string => (value ? `${dotDate(value.slice(0, 10))} ${value.slice(11, 16)}` : ' ');

export default function CareEventReport({ draft, elderName }: { draft: CareEventDraft; elderName: string }) {
  const kind = EVENT_KINDS.find((k) => k.value === draft.kind)?.label ?? draft.kind;
  const severity = EVENT_SEVERITIES.find((s) => s.value === draft.severity)?.label ?? draft.severity;
  const method = GUARDIAN_METHODS.find((m) => m.value === draft.guardianMethod)?.label;
  const company = companyNameStored();
  const row = (label: string, value: string) => (
    <tr>
      <th scope="row" className={styles.sheetLabel}>
        {label}
      </th>
      <td className={styles.printBox}>{value.trim() === '' ? ' ' : value}</td>
    </tr>
  );
  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>사고 보고서</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>어르신: {elderName || ' '}</span>
        <span>보고자: {draft.reporter}</span>
      </div>
      <table className={styles.sheetTable}>
        <tbody>
          {row('일어난 때', timeText(occurredAtOf(draft) || null))}
          {row('종류·중증도', `${kind} · ${severity}`)}
          {row('장소', draft.place)}
          {row(EVENT_TEXT_LABEL.description, draft.fields.description)}
          {row(EVENT_TEXT_LABEL.immediateAction, draft.fields.immediateAction)}
          {row('보호자 연락', guardianAtOf(draft) ? `${timeText(guardianAtOf(draft))} · ${method ?? ''}` : '')}
          {row(EVENT_TEXT_LABEL.guardianResponse, draft.fields.guardianResponse)}
          {row('병원', draft.hospital)}
          {row(EVENT_TEXT_LABEL.followUp, draft.fields.followUp)}
          {row(EVENT_TEXT_LABEL.prevention, draft.fields.prevention)}
        </tbody>
      </table>
      <div className={styles.printSign}>
        <span>작성자 서명: ______________________</span>
        <span>시설장 확인: ______________________</span>
      </div>
      <p className={styles.printNote}>이 출력본은 케어브이 실험실에서 만든 참고용입니다. 기관의 공식 사고보고 서식이 따로 있으면 그 서식을 함께 확인해 주세요. 출력일 {dotDate(todayString())}</p>
    </RecordsPrintPortal>
  );
}
