'use client';

/** 보호자용 월간 프로그램 계획표 — A4 가로 달력. 월~금(토요일 운영이면 토까지, 일정이 있는 날은 포함)을 주 단위 표로 그린다. */
import type { ScheduleItem } from '@/lib/lab/labTypes';
import { addDays } from '@/lib/lab/labDate';
import { mondayOf, weeksOverlapping } from '@/lib/lab/careEventRules';
import { companyNameStored, dotDate, monthLabel, todayString, weekdayIndex } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';
import own from './ProgramPlan.module.css';

export interface MonthSheetData {
  month: string;
  items: ScheduleItem[];
  operatingDays: string[];
  notes: string;
}

const HEAD = ['월', '화', '수', '목', '금', '토', '일'];

export default function ProgramPlanMonthSheet({ data }: { data: MonthSheetData }) {
  const company = companyNameStored();
  const weeks = weeksOverlapping(data.month);
  const open = new Set(data.operatingDays);
  // 토·일은 운영하거나 일정이 있을 때만 칸을 둔다
  const hasDow = (dow: number) => data.operatingDays.some((d) => weekdayIndex(d) === dow) || data.items.some((i) => weekdayIndex(i.date) === dow);
  const columns = [0, 1, 2, 3, 4, 5, 6].filter((c) => c < 5 || hasDow((c + 1) % 7));
  return (
    <RecordsPrintPortal landscape>
      <h1 className={styles.printTitle}>{monthLabel(data.month)} 프로그램 계획표</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      <table className={own.printCal}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {HEAD[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((monday) => (
            <tr key={monday}>
              {columns.map((c) => {
                const date = addDays(mondayOf(monday), c) ?? monday;
                const inMonth = date.startsWith(`${data.month}-`);
                const list = inMonth ? data.items.filter((i) => i.date.slice(0, 10) === date) : [];
                const off = inMonth && !open.has(date) && list.length === 0;
                return (
                  <td key={c} className={!inMonth || off ? own.printOff : undefined}>
                    {inMonth && <div className={own.printDay}>{Number(date.slice(8, 10))}</div>}
                    {list.map((it, i) => (
                      <div key={`${it.title}-${i}`} className={own.printItem}>
                        {it.startTime ? `${it.startTime} ` : ''}
                        {it.title}
                        {it.instructor ? ` (${it.instructor})` : ''}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {data.notes.trim() !== '' && <p>안내: {data.notes}</p>}
      <p className={styles.printNote}>
        프로그램은 어르신 상태와 날씨에 따라 바뀔 수 있습니다. 문의는 센터로 연락해 주세요. 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
