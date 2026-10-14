'use client';

/** 어르신별 서류 점검표 A4 인쇄본 — 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone. */
import { useEffect } from 'react';
import type { ElderDocStatusRow } from '@/lib/lab/elderDocRules';
import type { ElderDocument } from '@/lib/lab/labTypes';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { expiryState, expiryText } from './ElderDocsDraft';
import { AUTO_SHORT, STATUS_LABEL } from './ElderDocsStatus';
import { REQUIRED_DOCS } from '@/lib/lab/elderDocRules';
import RecordsPrintPortal from './RecordsPrint';
import { useLatest } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './ElderDocs.module.css';

interface Props {
  elderName: string;
  rows: Array<ElderDocStatusRow<ElderDocument>>;
  today: string;
  onDone: () => void;
}

export default function ElderDocsSheet({ elderName, rows, today, onDone }: Props) {
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

  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>수급자 서류 점검표</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      <div className={own.sheetGrid}>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>어르신</span>
          <span>{elderName}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>점검일</span>
          <span>{dotDate(today)}</span>
        </div>
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">서류</th>
            <th scope="col">상태</th>
            <th scope="col">제목·근거</th>
            <th scope="col">발급일</th>
            <th scope="col">만료일</th>
            <th scope="col">보관 위치</th>
            <th scope="col">확인일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const auto = REQUIRED_DOCS.find((x) => x.docType === r.docType)?.auto ?? null;
            const state = expiryState(r.doc?.expiresOn, today);
            return (
              <tr key={r.docType}>
                <td>{r.label}</td>
                <td>
                  {r.status === 'MISSING' ? '없음 (빠짐)' : STATUS_LABEL[r.status]}
                  {state ? ` · ${expiryText(state)}` : ''}
                </td>
                <td>{r.doc ? r.doc.title : r.status === 'AUTO' && auto ? `자동: ${AUTO_SHORT[auto]}` : ''}</td>
                <td>{r.doc ? dotDate(r.doc.issuedOn) : ''}</td>
                <td>{r.doc ? dotDate(r.doc.expiresOn) : ''}</td>
                <td>{r.doc?.location ?? ''}</td>
                <td>{r.doc ? dotDate(r.doc.checkedOn) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.printSign}>
        <span>점검자 (서명): ____________</span>
        <span>확인자 (서명): ____________</span>
      </div>
      <p className={styles.printNote}>
        법정 서류 목록이 아니라 평가·운영 기준을 묶은 기관 점검표입니다(대조 필요). 급여 종료일부터 5년 보존(노인장기요양보험법 시행규칙 제27조제4항). 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
