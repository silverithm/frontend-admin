'use client';

/** 운행일지 A4 인쇄본 — 일지마다 한 쪽, 운전원·동승자 서명 칸. 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone. */
import { useEffect } from 'react';
import type { TransportLog } from '@/lib/lab/labTypes';
import { companyNameStored, dateLabel, dotDate } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import { useLatest } from './recordsFormat';
import { DIRECTION_LABEL } from './TransportDraft';
import styles from './labRecords.module.css';
import own from './Transport.module.css';

interface Props {
  logs: TransportLog[];
  today: string;
  onDone: () => void;
}

export default function TransportLogSheet({ logs, today, onDone }: Props) {
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
  const company = companyNameStored();

  return (
    <RecordsPrintPortal>
      {logs.map((l) => (
        <section key={l.id} className={own.pageBreak}>
          <h1 className={styles.printTitle}>송영 운행일지</h1>
          <div className={styles.printMeta}>
            {company && <span>기관: {company}</span>}
            <span>운행일: {dateLabel(l.runDate)}</span>
            <span>구분: {DIRECTION_LABEL[l.direction]}</span>
            <span>차량: {l.vehicleNo}</span>
            <span>
              출발 {l.departTime ?? '-'} / 도착 {l.arriveTime ?? '-'}
            </span>
          </div>
          <table className={own.sheetTable}>
            <thead>
              <tr>
                <th>번호</th>
                <th>어르신</th>
                <th>탑승</th>
                <th>승차 시각</th>
                <th>하차 시각</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {l.riders.map((r, i) => (
                <tr key={r.elderlyId}>
                  <td>{i + 1}</td>
                  <td>{r.elderlyName}</td>
                  <td>{r.boarded ? '탑승' : '미탑승'}</td>
                  <td>{r.boarded ? r.boardTime ?? '-' : '-'}</td>
                  <td>{r.boarded ? r.alightTime ?? '-' : '-'}</td>
                  <td>{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.printSection}>특이사항</p>
          <p>{l.note ?? '없음'}</p>
          <div className={own.signRow}>
            <div className={own.signBox}>
              <span>운전원: {l.driverName}</span>
              <span>(서명)</span>
            </div>
            <div className={own.signBox}>
              <span>동승자: {l.escortName ?? ''}</span>
              <span>(서명)</span>
            </div>
          </div>
          <p className={styles.printNote}>
            이동서비스 일지입니다(고시 제34조 제4항: 작성·보관). 작성자 {l.writerName ?? '-'} · 출력일 {dotDate(today)}
          </p>
        </section>
      ))}
    </RecordsPrintPortal>
  );
}
