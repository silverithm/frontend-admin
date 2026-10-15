'use client';

/** 사례관리 회의록 인쇄본(A4 세로) — 일자·참석자(서명 칸)·대상·선정 사유·직원별 의견·사례관리 계획·회의 내용·반영과 평가. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, todayString, weekdayKo } from '@/components/lab/labFormat';
import { CASE_FOLLOW_UP_DAYS } from '@/lib/lab/caseMeetingRules';
import type { CaseMeeting, StaffProfile } from '@/lib/lab/labTypes';
import { REFLECT_METHODS } from './CaseMeetingDraft';
import { jobLookup } from './CaseMeetingRoles';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';
import ten from './labPlans10.module.css';

interface Props {
  meeting: CaseMeeting | null;
  profiles: StaffProfile[];
  printKey: number;
  onReady: () => void;
}

const methodLabel = (v: string | null) => REFLECT_METHODS.find((m) => m.value === v)?.label ?? '';

export default function CaseMeetingPrint({ meeting, profiles, printKey, onReady }: Props) {
  if (!meeting) return null;
  const jobOf = jobLookup(profiles);
  const opinionOf = (id: number) => meeting.opinions.find((o) => o.memberId === id);
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>사례관리 회의록</h1>
      <div className={styles.printMeta}>
        <span>기관명: {companyNameStored() || '____________'}</span>
        <span>작성자: {meeting.writerName || '____________'}</span>
      </div>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <th>일자</th>
            <td>
              {dotDate(meeting.heldOn)} ({weekdayKo(meeting.heldOn)})
            </td>
            <th>대상</th>
            <td>{meeting.targets.map((t) => t.elderlyName).join(', ') || '-'}</td>
          </tr>
        </tbody>
      </table>

      <p className={styles.printSection}>참석자 ({meeting.attendees.length}명)</p>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th>이름</th>
            <th>직종</th>
            <th>서명</th>
          </tr>
        </thead>
        <tbody>
          {meeting.attendees.map((a) => (
            <tr key={a.memberId}>
              <td>{a.memberName}</td>
              <td>{jobOf(a.memberId) ?? ''}</td>
              <td className={ten.signCell} />
            </tr>
          ))}
        </tbody>
      </table>

      {meeting.targets.map((t, i) => (
        <div key={t.elderlyId}>
          <p className={styles.printSection}>
            대상 {i + 1}. {t.elderlyName}
          </p>
          <table className={styles.sheetTable}>
            <tbody>
              <tr>
                <th>선정 사유</th>
                <td>{t.reason}</td>
              </tr>
              <tr>
                <th>사례관리 계획</th>
                <td>{t.plan}</td>
              </tr>
              <tr>
                <th>담당 직원</th>
                <td>{t.ownerName ?? ''}</td>
              </tr>
              <tr>
                <th>반영 (회의 다음날부터 {CASE_FOLLOW_UP_DAYS}일 안)</th>
                <td>{t.reflectedOn ? `${dotDate(t.reflectedOn)} · ${methodLabel(t.reflectMethod)}${t.reflectNote ? ` · ${t.reflectNote}` : ''}` : ''}</td>
              </tr>
              <tr>
                <th>평가 (반영일부터 {CASE_FOLLOW_UP_DAYS}일 안)</th>
                <td>
                  {t.evaluatedOn
                    ? `${dotDate(t.evaluatedOn)} · 작성자 ${t.evaluatorName ?? ''} · ${t.resolved === null ? '' : t.resolved ? '해결됨' : `해결되지 않음 — 추가 조치: ${t.nextAction ?? ''}`}`
                    : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <p className={styles.printSection}>직원별 의견</p>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th>이름</th>
            <th>의견</th>
          </tr>
        </thead>
        <tbody>
          {meeting.attendees.map((a) => {
            const o = opinionOf(a.memberId);
            return (
              <tr key={a.memberId}>
                <td>
                  {a.memberName}
                  {jobOf(a.memberId) ? ` (${jobOf(a.memberId)})` : ''}
                </td>
                <td>{o ? (o.opinion === null ? '의견 없음' : o.opinion) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className={styles.printSection}>회의 내용</p>
      <div className={`${ten.printBlock} ${ten.printSmall}`}>{meeting.minutes && meeting.minutes.trim() !== '' ? meeting.minutes : '(기록 없음)'}</div>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(todayString())}</span>
        <span>시설장: ____________ (서명)</span>
      </div>
    </PlansPrintPortal>
  );
}
