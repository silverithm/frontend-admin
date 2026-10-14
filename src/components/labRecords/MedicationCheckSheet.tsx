'use client';

/**
 * 의약품 보관 점검표 인쇄본 — 2026 평가 '투약 및 약품관리' 기준(보관함·냉장고 잠금, 일반의약품 사용기한·보관상태 분기 1회 점검)에 맞춰
 * 일자·약품명·효능·사용기한·점검자명·폐기일자를 적는다. 화면에서는 보이지 않고 인쇄할 때만 나온다.
 */
import type { MedicineCheckAction, MedicineStock } from '@/lib/lab/labTypes';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

export const ACTION_LABEL: Record<MedicineCheckAction, string> = { NONE: '조치 없음', DISPOSE: '폐기', REORDER: '재주문', MOVE: '옮김' };

export interface CheckSheetRow {
  name: string;
  efficacy: string;
  quantity: string;
  storage: string;
  expiresOn: string;
  /** null이면 아직 확인하지 않음 */
  ok: boolean | null;
  action: MedicineCheckAction;
  disposedOn: string;
  note: string;
}

export interface CheckSheetData {
  checkedOn: string;
  inspector: string;
  cabinetLocked: boolean;
  /** null이면 냉장 보관 약이 없음 */
  fridgeLocked: boolean | null;
  rows: CheckSheetRow[];
  note: string;
}

export function sheetRow(stock: MedicineStock | undefined, item: { ok: boolean | null; action: MedicineCheckAction; note: string }, checkedOn: string): CheckSheetRow {
  return {
    name: stock?.name ?? '(삭제된 약품)',
    efficacy: stock?.efficacy ?? '',
    quantity: stock ? `${stock.quantity.toLocaleString('ko-KR')}${stock.unit}` : '',
    storage: stock ? (stock.storage === 'FRIDGE' ? '냉장' : '실온') : '',
    expiresOn: stock ? dotDate(stock.expiresOn) : '',
    ok: item.ok,
    action: item.action,
    disposedOn: stock?.disposedOn ? dotDate(stock.disposedOn) : item.action === 'DISPOSE' ? dotDate(checkedOn) : '',
    note: item.note,
  };
}

export default function MedicationCheckSheet({ data }: { data: CheckSheetData }) {
  const company = companyNameStored();
  return (
    <RecordsPrintPortal landscape>
      <h1 className={styles.printTitle}>의약품 보관 점검표</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      <div className={own.sheetHead}>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>점검 일자</span>
          <span>{dotDate(data.checkedOn)}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>점검자명</span>
          <span>{data.inspector}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>약품보관함 잠금</span>
          <span>{data.cabinetLocked ? '잠금 확인' : '잠금 확인 안 됨'}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>냉장고 잠금</span>
          <span>{data.fridgeLocked === null ? '냉장 보관 약 없음' : data.fridgeLocked ? '잠금 확인' : '잠금 확인 안 됨'}</span>
        </div>
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">약품명</th>
            <th scope="col">효능</th>
            <th scope="col">수량</th>
            <th scope="col">보관</th>
            <th scope="col">사용기한</th>
            <th scope="col">확인</th>
            <th scope="col">조치</th>
            <th scope="col">폐기일자</th>
            <th scope="col">메모</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr>
              <td colSpan={9}>점검할 약품이 없습니다</td>
            </tr>
          ) : (
            data.rows.map((r, i) => (
              <tr key={`${r.name}-${i}`}>
                <td>{r.name}</td>
                <td>{r.efficacy}</td>
                <td>{r.quantity}</td>
                <td>{r.storage}</td>
                <td>{r.expiresOn}</td>
                <td>
                  <span className={own.checkBox} />
                  {r.ok === null ? '' : r.ok ? '이상 없음' : '이상 있음'}
                </td>
                <td>{r.action === 'NONE' ? '' : ACTION_LABEL[r.action]}</td>
                <td>{r.disposedOn}</td>
                <td>{r.note}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {data.note && <p>메모: {data.note}</p>}
      <div className={styles.printSign}>
        <span>점검자 (서명): ____________</span>
        <span>시설장 (서명): ____________</span>
      </div>
      <p className={styles.printNote}>
        2026 평가 기준: 약품보관함 잠금(냉장고에 두면 냉장고도 잠금), 일반의약품 사용기한·보관상태를 분기 1회 이상 점검. 서식은 기관 자체 양식이며 대조 필요. 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
