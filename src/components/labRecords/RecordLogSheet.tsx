'use client';

/**
 * 종류별 기록 인쇄본 — 한 건 또는 한 달치를 표로. 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone.
 * 안전관리 설명은 건마다 서명란이 있는 확인서 모양이고, 나머지는 날짜순 대장 표다.
 */
import { useEffect } from 'react';
import type { RecordLog, RecordLogKind } from '@/lib/lab/labTypes';
import { RECORD_LOG_KINDS, checkLabel, formatWon, receiptTotal } from '@/lib/lab/recordLogRules';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import { useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  kind: RecordLogKind;
  logs: RecordLog[];
  /** 한 달치를 찍을 때 제목 옆에 적는 월(예: 2026년 10월). 한 건이면 비운다 */
  periodLabel?: string;
  onDone: () => void;
}

export default function RecordLogSheet({ kind, logs, periodLabel, onDone }: Props) {
  const rule = RECORD_LOG_KINDS[kind];
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

  const ordered = [...logs].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id - b.id);
  const single = ordered.length === 1;
  /** 날짜·이름·금액은 한 줄로 둔다 — 좁은 칸에서 "2026.10." / "21"처럼 쪼개지면 읽기 어렵다 */
  const keep = { whiteSpace: 'nowrap' } as const;
  const checkText = (l: RecordLog) => l.checks.map((c) => checkLabel(kind, c)).join(', ');

  return (
    <RecordsPrintPortal landscape={!single && kind !== 'SAFETY_BRIEFING'}>
      <h1 className={styles.printTitle}>{rule.printTitle}</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        {periodLabel && <span>기간: {periodLabel}</span>}
        {kind === 'CASH_RECEIPT' && <span>합계: {formatWon(receiptTotal(ordered))}</span>}
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col" style={keep}>{kind === 'CASH_RECEIPT' ? '발행일' : kind === 'SAFETY_BRIEFING' ? '설명한 날' : '일자'}</th>
            {rule.perElder && <th scope="col" style={keep}>수급자</th>}
            <th scope="col">{rule.checksLabel}</th>
            {kind === 'CASH_RECEIPT' && <th scope="col">금액</th>}
            {kind === 'CASH_RECEIPT' && <th scope="col">승인번호</th>}
            <th scope="col">{rule.bodyLabel.replace(' (선택)', '')}</th>
            {kind !== 'SAFETY_BRIEFING' && kind !== 'CASH_RECEIPT' && <th scope="col">조치·전달 사항</th>}
            <th scope="col">{kind === 'CASH_RECEIPT' ? '발행 직원' : kind === 'SAFETY_BRIEFING' ? '설명 직원' : '작성자'}</th>
            {(single || kind === 'SAFETY_BRIEFING') && <th scope="col">확인(서명)</th>}
          </tr>
        </thead>
        <tbody>
          {ordered.map((l) => (
            <tr key={l.id}>
              <td style={keep}>{dotDate(l.entryDate)}</td>
              {rule.perElder && <td style={keep}>{l.elderlyName}</td>}
              <td>{checkText(l)}</td>
              {kind === 'CASH_RECEIPT' && <td style={keep}>{formatWon(l.amount)}</td>}
              {kind === 'CASH_RECEIPT' && <td>{l.extra ?? ''}</td>}
              <td>{l.body ?? ''}</td>
              {kind !== 'SAFETY_BRIEFING' && kind !== 'CASH_RECEIPT' && <td>{l.action ?? ''}</td>}
              <td style={keep}>{l.authorName}</td>
              {(single || kind === 'SAFETY_BRIEFING') && <td style={{ minWidth: '28mm' }}>&nbsp;</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {kind === 'SAFETY_BRIEFING' && <p>수급자 또는 보호자가 설명을 들었음을 위 서명란에 확인합니다.</p>}
      <p className={styles.printNote}>
        기관 자체 양식입니다(칸 구성은 공개 자료의 메뉴 구성을 참고했으며 고시·평가 매뉴얼의 필수 항목은 확인하지 못했습니다 — 대조 필요). 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
