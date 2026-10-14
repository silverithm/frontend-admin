'use client';

/**
 * 봉사자 활동 확인서 인쇄본 — A4 세로. 그 해 그 봉사자의 활동 날짜·시간·내용과 합계, 기관 확인란.
 * 시간 합계는 활동 시간 그대로, 인정 시간은 하루 8시간(VMS) 한도로 자른 값이다. 화면에서는 보이지 않는다.
 */
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { VMS_DAILY_MINUTES } from '@/lib/lab/communityRules';
import type { VolunteerLog } from '@/lib/lab/labTypes';
import { activityLabel, minutesText } from './CommunityVolunteerDraft';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';

interface Props {
  year: number;
  /** 확인서를 만들 봉사자 이름 */
  volunteerName: string;
  logs: VolunteerLog[];
  printKey: number;
  onReady: () => void;
}

export default function CommunityVolunteerCertificate({ year, volunteerName, logs, printKey, onReady }: Props) {
  const mine = logs
    .filter((l) => l.volunteerName.trim() === volunteerName && l.activityDate.startsWith(`${year}-`))
    .sort((a, b) => (a.activityDate < b.activityDate ? -1 : a.activityDate > b.activityDate ? 1 : a.startTime < b.startTime ? -1 : 1));
  const perDay = new Map<string, number>();
  for (const l of mine) perDay.set(l.activityDate, (perDay.get(l.activityDate) ?? 0) + l.minutes);
  const total = mine.reduce((s, l) => s + l.minutes, 0);
  const certifiable = [...perDay.values()].reduce((s, m) => s + Math.min(m, VMS_DAILY_MINUTES), 0);
  const organizations = [...new Set(mine.map((l) => l.organization).filter((o): o is string => !!o))];
  const company = companyNameStored();

  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>봉사활동 확인서</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>봉사자: {volunteerName === '' ? '(이름 없음)' : volunteerName}</span>
        {organizations.length > 0 && <span>소속: {organizations.join(', ')}</span>}
        <span>기간: {year}년</span>
        <span>출력일: {dotDate(todayString())}</span>
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">활동 날짜</th>
            <th scope="col">시간</th>
            <th scope="col">활동 종류·내용</th>
            <th scope="col">활동 시간</th>
            <th scope="col">확인자</th>
          </tr>
        </thead>
        <tbody>
          {mine.length === 0 && (
            <tr>
              <td colSpan={5}>이 해에 기록된 활동이 없습니다</td>
            </tr>
          )}
          {mine.map((l) => (
            <tr key={l.id}>
              <td>{dotDate(l.activityDate)}</td>
              <td>
                {l.startTime}~{l.endTime}
              </td>
              <td>
                {activityLabel(l.activityType)}
                {l.content ? ` — ${l.content}` : ''}
              </td>
              <td>{minutesText(l.minutes)}</td>
              <td>{l.confirmerName}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" colSpan={3}>
              합계 {mine.length}회
            </th>
            <td colSpan={2}>
              <strong>{minutesText(total)}</strong> · 하루 8시간 한도 적용 인정 시간 <strong>{minutesText(certifiable)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p className={styles.printNote}>위와 같이 봉사활동을 하였음을 확인합니다. 이 확인서는 기관 기록으로 만든 참고 자료이며, VMS(1365) 인증 시간은 VMS 등록 결과가 기준입니다.</p>
      <div className={styles.printSign}>
        <span>작성일: {dotDate(todayString())}</span>
        <span>기관명: {company || '____________'}</span>
        <span>확인자(시설장): ____________ (서명 또는 인)</span>
      </div>
    </PlansPrintPortal>
  );
}
