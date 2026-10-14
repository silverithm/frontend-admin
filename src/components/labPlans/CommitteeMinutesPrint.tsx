'use client';

/** 회의록 인쇄본(A4 세로) — 일시·종류·참석 위원·안건·회의 내용·결정 사항·다음 회의일·서명. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, todayString, weekdayKo } from '@/components/lab/labFormat';
import type { CommitteeMeeting, CommitteeMember } from '@/lib/lab/labTypes';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';
import eight from './labPlans8.module.css';

interface Props {
  meeting: CommitteeMeeting | null;
  members: CommitteeMember[];
  printKey: number;
  onReady: () => void;
}

export default function CommitteeMinutesPrint({ meeting, members, printKey, onReady }: Props) {
  if (!meeting) return null;
  const names = meeting.attendeeNames.length > 0 ? meeting.attendeeNames : meeting.attendeeIds.map((id) => members.find((m) => m.id === id)?.name ?? '').filter((n) => n !== '');
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>운영위원회 회의록</h1>
      <div className={styles.printMeta}>
        <span>기관명: {companyNameStored() || '____________'}</span>
        <span>작성자: {meeting.writerName || '____________'}</span>
      </div>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <th>일시</th>
            <td>
              {dotDate(meeting.heldOn)} ({weekdayKo(meeting.heldOn)})
            </td>
            <th>종류</th>
            <td>{meeting.kind === 'REGULAR' ? '정기 회의' : '임시 회의'}</td>
          </tr>
          <tr>
            <th>참석 위원 ({names.length}명)</th>
            <td colSpan={3}>{names.length === 0 ? '-' : names.join(', ')}</td>
          </tr>
          <tr>
            <th>안건</th>
            <td colSpan={3}>{meeting.agenda}</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.printSection}>회의 내용</p>
      <div className={eight.printMinutes}>{meeting.minutes.trim() === '' ? '(기록 없음)' : meeting.minutes}</div>
      <p className={styles.printSection}>결정 사항</p>
      {meeting.decisions.length === 0 ? (
        <p>없음</p>
      ) : (
        <ol>
          {meeting.decisions.map((d, i) => (
            <li key={`${i}-${d}`}>{d}</li>
          ))}
        </ol>
      )}
      <p>다음 회의일: {meeting.nextOn ? dotDate(meeting.nextOn) : '미정'}</p>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(todayString())}</span>
        <span>위원장: ____________ (서명 또는 인)</span>
        <span>시설장: ____________ (서명 또는 인)</span>
      </div>
    </PlansPrintPortal>
  );
}
