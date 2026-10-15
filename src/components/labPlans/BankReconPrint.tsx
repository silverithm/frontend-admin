'use client';

/** 통장 대사표 A4 인쇄본 — 통장별 월말 잔액, 장부 잔액과 차이, 붙여넣은 거래가 있으면 어긋난 거래, 서명 칸. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, monthLabel, todayString } from '@/components/lab/labFormat';
import { accountLabel } from '@/lib/lab/ledgerRules';
import type { BankStatement } from '@/lib/lab/labTypes';
import type { ReconView } from './BankReconBook';
import type { MatchView } from './BankReconMatch';
import { purposeName, signedWonText, tailText, wonText } from './BankReconFormat';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';

interface Props {
  month: string;
  view: ReconView;
  statements: BankStatement[];
  match: MatchView | null;
  printKey: number;
  onReady: () => void;
}

export default function BankReconPrint({ month, view, statements, match, printKey, onReady }: Props) {
  const r = view.result;
  if (r === null) return null;
  const company = companyNameStored();
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>{monthLabel(month)} 통장 대사표</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>대사 기준일: {monthLabel(month)} 말일</span>
        <span>출력일: {dotDate(todayString())}</span>
      </div>
      <p className={styles.printSection}>통장별 월말 잔액</p>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">통장</th>
            <th scope="col">용도</th>
            <th scope="col">은행·끝 4자리</th>
            <th scope="col">월말 잔액(원)</th>
          </tr>
        </thead>
        <tbody>
          {view.included.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{purposeName(a.purpose)}</td>
              <td>
                {a.bankName} {tailText(a.accountTail)}
              </td>
              <td>{wonText(statements.find((s) => s.accountId === a.id && s.statementMonth === month)?.closingBalance)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" colSpan={3}>
              통장 합계
            </th>
            <td>
              <strong>{wonText(r.bankClosing)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p className={styles.printSection}>장부와 대사</p>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <th scope="row">장부 월말 잔액</th>
            <td>{wonText(r.bookClosing)}</td>
          </tr>
          <tr>
            <th scope="row">통장 합계</th>
            <td>{wonText(r.bankClosing)}</td>
          </tr>
          <tr>
            <th scope="row">차이 (통장 − 장부)</th>
            <td>
              <strong>{r.matched ? '맞음 (0원)' : signedWonText(r.diff)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {match !== null && match.inMonthCount > 0 && (
        <>
          <p className={styles.printSection}>
            통장 거래 맞추기 (통장 {match.inMonthCount}건 중 {match.matched.length}건 일치)
          </p>
          <table className={styles.sheetTable}>
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col">날짜</th>
                <th scope="col">내용</th>
                <th scope="col">금액(원)</th>
              </tr>
            </thead>
            <tbody>
              {match.unmatchedLines.length + match.unmatchedEntries.length === 0 && (
                <tr>
                  <td colSpan={4}>어긋난 거래 없음</td>
                </tr>
              )}
              {match.unmatchedLines.map(({ index, line }) => (
                <tr key={`l${index}`}>
                  <td>장부에 없는 통장 거래</td>
                  <td>{dotDate(line.date)}</td>
                  <td>{line.description}</td>
                  <td>{signedWonText(line.amount)}</td>
                </tr>
              ))}
              {match.unmatchedEntries.map((e) => (
                <tr key={`e${e.id}`}>
                  <td>통장에 없는 장부 기록</td>
                  <td>{dotDate(e.entryDate)}</td>
                  <td>
                    {accountLabel(e.direction, e.accountCode)} {e.description}
                  </td>
                  <td>{signedWonText(e.direction === 'INCOME' ? e.amount : -e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className={styles.printNote}>
        장부 월말 잔액은 통장 시작 잔액 합({wonText(view.openingSum)})에 {view.startDate ?? ''} 이후 장부의 수입을 더하고 지출을 뺀 값입니다. 재무·회계 규칙에는 월말 통장 대사 조항이 없어 기관 관리 기준으로 만든 참고 자료입니다(대조 필요).
      </p>
      <div className={styles.printSign}>
        <span>작성자: ____________</span>
        <span>확인(시설장): ____________ (서명)</span>
      </div>
    </PlansPrintPortal>
  );
}
