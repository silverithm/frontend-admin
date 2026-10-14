'use client';

/** 진료 동행 한 건 A4 인쇄본(보호자 전달용) — 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone. */
import { useEffect } from 'react';
import type { MedicalVisit } from '@/lib/lab/labTypes';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import { useLatest } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './MedicalVisit.module.css';

export default function MedicalVisitSheet({ visit, onDone }: { visit: MedicalVisit; onDone: () => void }) {
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

  const time = visit.startTime && visit.endTime ? `${visit.startTime} ~ ${visit.endTime}` : visit.startTime ? `${visit.startTime}부터` : visit.endTime ? `${visit.endTime}까지` : '';
  const cell = (label: string, value: string) => (
    <div className={own.sheetCell}>
      <span className={own.sheetCellLabel}>{label}</span>
      <span>{value || '-'}</span>
    </div>
  );
  const block = (label: string, value: string | null) => (
    <>
      <div className={styles.printSection}>{label}</div>
      <div className={own.sheetBlock}>{value ?? ''}</div>
    </>
  );

  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>진료 동행 기록</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      <div className={own.sheetGrid}>
        {cell('어르신', visit.elderlyName)}
        {cell('진료 날짜', dotDate(visit.visitDate))}
        {cell('병원', visit.hospital)}
        {cell('진료과', visit.department ?? '')}
        {cell('동행 직원', visit.escortName)}
        {cell('동행 시각', time)}
      </div>
      {block('진료 사유', visit.reason)}
      {block('진료 내용', visit.result)}
      {block('처방', visit.prescription)}
      <div className={own.sheetGrid} style={{ marginTop: 'var(--spacing-3)' }}>
        {cell('보호자 알림', visit.guardianNotified ? `알림${visit.guardianNote ? ` — ${visit.guardianNote}` : ''}` : '알리지 않음')}
        {cell('후속 확인', visit.followUpOn ? `${dotDate(visit.followUpOn)}${visit.followUpDone ? ' (확인 완료)' : ''}` : '')}
      </div>
      <div className={styles.printSign}>
        <span>동행 직원 (서명): ____________</span>
        <span>보호자 확인 (서명): ____________</span>
      </div>
      <p className={styles.printNote}>
        기관 자체 양식입니다(진료 동행 기록의 필수 항목은 규정에서 정해진 것을 확인하지 못했습니다 — 대조 필요). 의료 판단이 아니라 진료 때 들은 내용을 옮겨 적은 기록입니다. 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
