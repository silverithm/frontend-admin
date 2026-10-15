'use client';

/**
 * 법정 서식(별지 제15호) 인쇄본 — 어르신 한 분, 한 달. printSheets로 이용일 3칸씩 장을 나눠 앞쪽(서식 칸)을 찍고, 뒤쪽은 유의사항 일곱 개다.
 * 인쇄는 body 바로 아래(portal)에 따로 그린다. 월별 기록지 인쇄와 같은 방식이라, 한 번에 하나만 그려 @page 설정이 섞이지 않게 한다.
 */
import { createPortal } from 'react-dom';
import { Fragment, useEffect, useState } from 'react';
import { printSheets } from '@/lib/lab/careRecordFormRules';
import type { CareRecord } from '@/lib/lab/labTypes';
import { FRONT_ROWS, toPrintDay } from './CareRecordLabFormPrintRows';
import type { PrintDay } from './CareRecordLabFormPrintRows';
import { FORM_NOTICES, FORM_NOTICE_FOOTNOTE } from './CareRecordLabFormNotices';
import { monthLabel } from './labFormat';
import styles from './lab.module.css';
import formStyles from './labForm.module.css';

interface Props {
  month: string;
  elderName: string;
  /** 장기요양등급 이름(모르면 빈칸) */
  gradeLabel: string;
  companyName: string;
  records: CareRecord[];
  /** 장마다 뒷면(유의사항)도 찍을지. 끄면 맨 끝에 한 번만 찍는다 */
  backEachSheet: boolean;
}

function FormHead({ elderName, gradeLabel, companyName }: Pick<Props, 'elderName' | 'gradeLabel' | 'companyName'>) {
  return (
    <table className={formStyles.formHeadTable}>
      <tbody>
        <tr>
          <th scope="row">수급자 성명</th>
          <td>{elderName}</td>
          <th scope="row">생년월일</th>
          <td />
          <th scope="row">장기요양등급</th>
          <td>{gradeLabel}</td>
        </tr>
        <tr>
          <th scope="row">장기요양기관명</th>
          <td>{companyName}</td>
          <th scope="row">장기요양기관기호</th>
          <td />
          <th scope="row">장기요양인정번호</th>
          <td />
        </tr>
      </tbody>
    </table>
  );
}

function FrontSheet({ days, head, monthText }: { days: PrintDay[]; head: Pick<Props, 'elderName' | 'gradeLabel' | 'companyName'>; monthText: string }) {
  const cols: Array<PrintDay | null> = [0, 1, 2].map((i) => days[i] ?? null);
  return (
    <div className={formStyles.formSheet}>
      <h1 className={formStyles.formTitle}>급여제공기록지(주·야간보호) — 별지 제15호서식 · {monthText}</h1>
      <FormHead {...head} />
      <table className={formStyles.formTable}>
        <thead>
          <tr>
            <th scope="col" className={formStyles.formArea}>구분</th>
            <th scope="col" className={formStyles.formItem}>항목</th>
            {cols.map((c, i) => (
              <th scope="col" key={c?.date ?? `empty-${i}`}>이용일 {i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FRONT_ROWS.map((row) => (
            <tr key={row.key} className={row.className}>
              {row.area && (
                <th scope="rowgroup" rowSpan={row.area.rows} className={formStyles.formArea}>
                  {row.area.label}
                </th>
              )}
              <th scope="row" className={formStyles.formItem} colSpan={row.wide ? 2 : 1}>
                {row.item}
              </th>
              {cols.map((c, i) => (
                <td key={c?.date ?? `empty-${i}`}>{c ? row.cell(c) : ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BackSheet() {
  return (
    <div className={formStyles.formSheet}>
      <h2 className={formStyles.formNoticeTitle}>유의사항</h2>
      <ol className={formStyles.formNoticeList}>
        {FORM_NOTICES.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ol>
      <p className={styles.printNote}>{FORM_NOTICE_FOOTNOTE}</p>
    </div>
  );
}

/** 인쇄 전용 사본. 화면에서는 보이지 않고, 인쇄할 때만 나타난다. */
export default function CareRecordLabFormPrint({ month, elderName, gradeLabel, companyName, records, backEachSheet }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;

  const inMonth = records.filter((r) => r.recordDate.slice(0, 7) === month);
  const byDate = new Map(inMonth.map((r) => [r.recordDate.slice(0, 10), toPrintDay(r)]));
  const sheets = printSheets([...byDate.keys()]);
  const head = { elderName, gradeLabel, companyName };

  return createPortal(
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body > *:not([data-lab-print-root]) { display: none !important; }
          html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
      {sheets.map((dates) => (
        <Fragment key={dates[0]}>
          <FrontSheet days={dates.map((d) => byDate.get(d)).filter((d): d is PrintDay => !!d)} head={head} monthText={monthLabel(month)} />
          {backEachSheet && <BackSheet />}
        </Fragment>
      ))}
      {!backEachSheet && sheets.length > 0 && <BackSheet />}
    </div>,
    host,
  );
}
