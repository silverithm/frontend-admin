'use client';

/** 인력배치 점검표 인쇄본(A4 세로) — 입소자 수, 월 기준 근무시간, 직원별 근무시간, 직종별 점검 결과, 감산 위험, 대조 필요 안내. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, monthLabel, todayString } from '@/components/lab/labFormat';
import { staffGroupLabel, staffJobTypeLabel } from '@/lib/lab/staffingRules';
import type { StaffingCheck } from '@/lib/lab/staffingRules';
import type { StaffingDraft } from './StaffingDraft';
import { hoursOf, totalSum } from './StaffingDraft';
import PlansPrintPortal from './PlansPrintPortal';
import { fmt1 } from './StaffingResult';
import styles from './labPlans.module.css';

interface Props {
  draft: StaffingDraft;
  users: number;
  standardHours: number;
  check: StaffingCheck;
  printKey: number;
  onReady: () => void;
}

export default function StaffingPrint({ draft, users, standardHours, check, printKey, onReady }: Props) {
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>인력배치 점검표 — {monthLabel(draft.month)}</h1>
      <div className={styles.printMeta}>
        <span>기관명: {companyNameStored() || '____________'}</span>
        <span>작성자: {draft.writerName || '____________'}</span>
      </div>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <th>급여제공일수</th>
            <td>{draft.serviceDays ?? '-'}일</td>
            <th>일자별 입소자 수의 합</th>
            <td>{totalSum(draft).toLocaleString('ko-KR')}명{draft.extraSum ? ` (더한 인원 ${draft.extraSum.toLocaleString('ko-KR')}명 포함)` : ''}</td>
          </tr>
          <tr>
            <th>월 입소자 수</th>
            <td>{users}명</td>
            <th>월 기준 근무시간</th>
            <td>{standardHours}시간</td>
          </tr>
          <tr>
            <th>공휴일</th>
            <td colSpan={3}>{draft.holidays.length === 0 ? '없음' : draft.holidays.map(dotDate).join(', ')}</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.printSection}>직원별 근무시간</p>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th>이름</th>
            <th>직종</th>
            <th>근무시간</th>
          </tr>
        </thead>
        <tbody>
          {draft.staff.length === 0 ? (
            <tr>
              <td colSpan={3}>적은 직원이 없습니다.</td>
            </tr>
          ) : (
            draft.staff.map((s) => (
              <tr key={s.key}>
                <td>{s.name}</td>
                <td>{staffJobTypeLabel(s.jobType)}</td>
                <td>{hoursOf(s) ?? '-'}시간</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className={styles.printSection}>직종별 점검 결과</p>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th>직종</th>
            <th>배치 기준(명)</th>
            <th>근무인원(감액용)</th>
            <th>결원(명)</th>
            <th>감산점수</th>
          </tr>
        </thead>
        <tbody>
          {check.rows.filter((r) => r.required > 0 || r.fte > 0).map((r) => (
            <tr key={r.group}>
              <td>{staffGroupLabel(r.group)}</td>
              <td>{r.required}</td>
              <td>{fmt1(r.fte)}</td>
              <td>{r.shortfall > 0 ? fmt1(r.shortfall) : '-'}</td>
              <td>{r.penalized ? fmt1(r.penaltyScore) : '감산 대상 아님'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        감산점수 합 {fmt1(check.penaltyScoreSum)}점 · 감산유형점수 {fmt1(check.typeScore)} · 연속 위반 배수 × {fmt1(check.multiplier)} · 감산율 {fmt1(check.penaltyRate)}%
        {check.penaltyRate > 0 ? ` — 급여비용의 약 ${fmt1(check.penaltyRate)}%가 감액될 수 있습니다.` : ''}
      </p>
      {check.bonusHints.map((h) => (
        <p key={h}>{h}</p>
      ))}
      {draft.note.trim() !== '' && <p>메모: {draft.note}</p>}
      <p className={styles.printNote}>감산·가산 점수표와 공휴일 목록은 원문 대조 필요. 치매전담실·통합재가 가산은 다루지 않음. 점검용 참고이며 실제 감액은 공단 심사 결과를 따릅니다.</p>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(todayString())}</span>
        <span>시설장: ____________ (서명 또는 인)</span>
      </div>
    </PlansPrintPortal>
  );
}
