'use client';

/** 복지(포상) 제공대장 인쇄본(A4 세로) — 연도·분기별 표에 수령인 서명 칸. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate } from '@/components/lab/labFormat';
import { quarterOf } from '@/lib/lab/welfareRules';
import type { StaffWelfare } from '@/lib/lab/labTypes';
import { kindInfo, quarterName, wonText } from './StaffWelfareFormat';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';
import mine from './StaffWelfare.module.css';

interface Props {
  year: number;
  /** '' = 연 전체, 'Q1'~'Q4' = 그 분기만 */
  scope: string;
  entries: StaffWelfare[] | null;
  today: string;
  printKey: number;
  onReady: () => void;
}

/** 손으로 더 적을 수 있게 비워 두는 줄 수 */
const BLANK_ROWS = 2;

export default function StaffWelfarePrint({ year, scope, entries, today, printKey, onReady }: Props) {
  if (!entries) return null;
  const quarters = (scope === '' ? ['Q1', 'Q2', 'Q3', 'Q4'] : [scope]).map((q) => `${year}-${q}`);
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>직원 복지(포상) 제공대장</h1>
      <div className={styles.printMeta}>
        <span>기관명: {companyNameStored() || '____________'}</span>
        <span>{year}년 {scope === '' ? '전체' : `${scope.slice(1)}분기`}</span>
      </div>
      {quarters.map((q) => {
        const rows = entries.filter((e) => quarterOf(e.givenOn) === q).sort((a, b) => (a.givenOn < b.givenOn ? -1 : 1));
        return (
          <div key={q}>
            <p className={styles.printSection}>{quarterName(q)}</p>
            <table className={`${styles.sheetTable} ${mine.printSmall}`}>
              <thead>
                <tr>
                  <th>제공일</th>
                  <th>직원</th>
                  <th>종류</th>
                  <th>포상품·내용</th>
                  <th>금액</th>
                  <th>증빙</th>
                  <th>수령인 서명</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>{dotDate(e.givenOn)}</td>
                    <td>{e.memberName}</td>
                    <td>{kindInfo(e.kind)?.label ?? e.kind}</td>
                    <td>{e.item}</td>
                    <td>{wonText(e.amount)}</td>
                    <td>{e.evidenceLedgerId !== null ? '장부 기록' : e.evidenceNote ?? ''}</td>
                    <td className={mine.signCell} />
                  </tr>
                ))}
                {Array.from({ length: BLANK_ROWS }, (_, i) => (
                  <tr key={`blank${i}`}>
                    <td className={mine.signCell} />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className={styles.printNote}>현금을 직접 주고 서명만 받은 경우는 인정되지 않습니다. 이체내역이나 영수증을 함께 보관해 주세요. 회식·간식, 상장·상패만 수여, 후원품 증정, 대표자 본인에게 준 것은 복지로 세지 않습니다.</p>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(today)}</span>
        <span>시설장: ____________ (서명)</span>
      </div>
    </PlansPrintPortal>
  );
}
