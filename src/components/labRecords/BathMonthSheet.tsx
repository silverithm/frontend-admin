'use client';

/**
 * 어르신별 월 목욕서비스 제공 일지 인쇄본(세부사항 별지 제23호 항목): 수급자 성명·장기요양등급·인정번호·시설장 성명 빈칸,
 * 회차별 제공일·시작·종료·소요(분)·방법·제공자·특이사항. 등급·인정번호는 진행 중인 계약이 있을 때만 채우고 없으면 빈칸이다.
 */
import type { BathLog } from '@/lib/lab/labTypes';
import { bathMethodLabel } from '@/lib/lab/bathRules';
import { companyNameStored, dotDate, monthLabel, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

export interface BathSheetData {
  elderName: string;
  month: string;
  /** 계약에서 가져온 값 — 없으면 빈 문자열(손으로 적는 빈칸) */
  gradeText: string;
  recognitionNo: string;
  logs: BathLog[];
}

export default function BathMonthSheet({ data }: { data: BathSheetData }) {
  const company = companyNameStored();
  const total = data.logs.reduce((n, l) => n + l.minutes, 0);
  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>{monthLabel(data.month)} 목욕서비스 제공 일지</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      <div className={own.sheetHead}>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>수급자 성명</span>
          <span>{data.elderName}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>장기요양등급</span>
          <span>{data.gradeText}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>인정번호</span>
          <span>{data.recognitionNo}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>시설장 성명</span>
          <span />
        </div>
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">회차</th>
            <th scope="col">제공일</th>
            <th scope="col">시작</th>
            <th scope="col">종료</th>
            <th scope="col">소요(분)</th>
            <th scope="col">방법</th>
            <th scope="col">제공자</th>
            <th scope="col">특이사항</th>
          </tr>
        </thead>
        <tbody>
          {data.logs.map((l, i) => (
            <tr key={l.id}>
              <td>{i + 1}</td>
              <td>{dotDate(l.bathDate)}</td>
              <td>{l.startTime}</td>
              <td>{l.endTime}</td>
              <td>{l.minutes.toLocaleString('ko-KR')}</td>
              <td>{bathMethodLabel(l.method)}</td>
              <td>{l.providerName}</td>
              <td>{[l.preCheck && `목욕 전: ${l.preCheck}`, l.skinNote && `피부: ${l.skinNote}`, l.note].filter(Boolean).join(' / ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        이 달 {data.logs.length}회 · 합계 {total.toLocaleString('ko-KR')}분
      </p>
      <div className={styles.printSign}>
        <span>제공자 (서명): ____________</span>
        <span>시설장 (서명): ____________</span>
      </div>
      <p className={styles.printNote}>
        목욕서비스 제공일지(세부사항 별지 제23호) 항목에 맞춘 참고용 출력본입니다 — 서식은 원본과 대조해 주세요. 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
