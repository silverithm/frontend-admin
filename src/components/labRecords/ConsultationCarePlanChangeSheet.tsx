'use client';

/** 급여제공계획 변경 이력 한 건 A4 인쇄본(보호자 확인 서명 칸 포함) — 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone. */
import { useEffect } from 'react';
import type { CareEvent, CarePlanChange } from '@/lib/lab/labTypes';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { eventOptionLabel, itemLabel, reasonLabel } from './ConsultationCarePlanChangeDraft';
import RecordsPrintPortal from './RecordsPrint';
import { useLatest } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './ConsultationCarePlanChange.module.css';

interface Props {
  change: CarePlanChange;
  grade: string | null;
  event: CareEvent | null;
  onDone: () => void;
}

export default function ConsultationCarePlanChangeSheet({ change, grade, event, onDone }: Props) {
  const company = companyNameStored();
  const done = useLatest(onDone);
  useEffect(() => {
    const finish = () => done.current();
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [done]);

  const cell = (label: string, value: string) => (
    <div className={own.sheetCell}>
      <span className={own.sheetCellLabel}>{label}</span>
      <span>{value || '-'}</span>
    </div>
  );
  const block = (label: string, value: string) => (
    <>
      <div className={styles.printSection}>{label}</div>
      <div className={own.sheetBlock}>{value}</div>
    </>
  );
  const date = (v: string | null) => (v ? dotDate(v.slice(0, 10)) : '');

  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>급여제공계획 변경 이력</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      <div className={own.sheetGrid}>
        {cell('수급자', change.elderlyName)}
        {cell('장기요양등급', grade ?? '')}
        {cell('변경일', date(change.changedOn))}
        {cell('변경 사유', reasonLabel(change.reason))}
        {cell('변경 항목', change.changeItems.map(itemLabel).join(' · '))}
        {cell('관련 상태변화', event ? eventOptionLabel(event) : change.eventId !== null ? '연결됨' : '')}
      </div>
      {block('사유', change.reasonNote)}
      {block('변경 내용', change.changeDetail)}
      <div className={own.sheetGrid} style={{ marginTop: 'var(--spacing-3)' }}>
        {cell('보호자 설명일', date(change.guardianExplainedOn))}
        {cell('확인서명일', date(change.guardianSignedOn))}
        {cell('공단 통보일', date(change.notifiedOn))}
        {cell('작성자', change.writerName ?? '')}
      </div>
      <div className={styles.printSign}>
        <span>작성자 (서명): ______________________</span>
        <span>수급자(보호자) 확인 (서명): ______________________</span>
      </div>
      <p className={styles.printNote}>기관 자체 양식입니다. 공단 공식 서식이 아니므로 제출·보관용은 공단 서식을 확인해 사용해 주세요. 출력일 {dotDate(todayString())}</p>
    </RecordsPrintPortal>
  );
}
