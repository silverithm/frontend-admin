'use client';

/** 투약의뢰서 한 장 인쇄본 — 화면에서는 보이지 않고 인쇄할 때만 나온다. */
import type { MedicationRequest } from '@/lib/lab/labTypes';
import { relationLabel, routeLabel, slotLabel, timingLabel } from '@/lib/lab/medicationRules';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

export default function MedicationRequestSheet({ request }: { request: MedicationRequest }) {
  const company = companyNameStored();
  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>투약의뢰서</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>상태: {request.status === 'ACTIVE' ? '진행 중' : '끝남'}</span>
      </div>
      <div className={own.sheetHead}>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>어르신</span>
          <span>{request.elderlyName}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>의뢰한 날</span>
          <span>{dotDate(request.requestedOn)}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>의뢰한 사람</span>
          <span>
            {request.requesterName} ({relationLabel(request.requesterRelation)})
          </span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>투약 기간</span>
          <span>
            {dotDate(request.startDate)} ~ {request.endDate ? dotDate(request.endDate) : '정해지지 않음'}
          </span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>의사 처방 확인</span>
          <span>{request.prescriptionChecked ? '확인함' : '확인 안 함'}</span>
        </div>
        <div className={own.sheetCell}>
          <span className={own.sheetCellLabel}>받은 직원</span>
          <span>{request.writerName}</span>
        </div>
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">약 이름</th>
            <th scope="col">용량</th>
            <th scope="col">경로</th>
            <th scope="col">시간대</th>
            <th scope="col">복용 시점</th>
            <th scope="col">메모</th>
          </tr>
        </thead>
        <tbody>
          {request.medicines.map((m, i) => (
            <tr key={`${m.name}-${i}`}>
              <td>{m.name}</td>
              <td>{m.dose}</td>
              <td>{routeLabel(m.route)}</td>
              <td>{m.slots.map(slotLabel).join('·')}</td>
              <td>{timingLabel(m.timing)}</td>
              <td>{m.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {request.note && <p>메모: {request.note}</p>}
      <div className={styles.printSign}>
        <span>의뢰한 사람 (서명): ____________</span>
        <span>받은 직원 (서명): ____________</span>
      </div>
      <p className={styles.printNote}>
        기관 자체 양식입니다(투약의뢰서 서식은 공개 규정에서 정해진 것을 확인하지 못했습니다 — 대조 필요). 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
