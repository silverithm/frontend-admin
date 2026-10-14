'use client';

/** 보호자 안내 인쇄본(A4) — 제목과 본문. 인쇄할 때만 나타난다. */
import { companyNameStored, dotDate, monthLabel, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';

interface Props {
  title: string;
  body: string;
  elderName: string;
  month: string;
  writer: string;
}

export default function GuardianNoticeSheet({ title, body, elderName, month, writer }: Props) {
  const company = companyNameStored();
  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>{title || `${monthLabel(month)} 보호자 안내`}</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>어르신: {elderName}</span>
        <span>안내 월: {monthLabel(month)}</span>
        <span>작성일: {dotDate(todayString())}</span>
      </div>
      <div className={styles.printBody}>{body}</div>
      <div className={styles.printSign}>
        <span>작성자: {writer || '______________________'}</span>
        <span>수령 확인: ______________________</span>
      </div>
    </RecordsPrintPortal>
  );
}
