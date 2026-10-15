'use client';

/**
 * 급여제공계획서 — 화면 미리보기와 인쇄본이 같은 표를 쓴다.
 * 인쇄는 화면 전체가 아니라 이 계획서만 나가야 하므로, 인쇄용 사본을 body 바로 아래(portal)에 따로 그리고
 * 인쇄할 때 body의 다른 자식은 모두 숨긴다. 관리자 화면의 스크롤 영역 안에서는 긴 문서가 잘려 나오기 때문이다.
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { CarePlan } from '@/lib/lab/labTypes';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { NEEDS_KEYS, NEEDS_LABEL } from './ConsultationCarePlanPlanDraft';
import styles from './labRecords.module.css';

interface SheetProps {
  plan: CarePlan;
  grade: string | null;
  companyName: string;
}

/** 계획서 본문(제목·표·서명란). 화면과 인쇄에서 그대로 쓴다. */
export function CarePlanSheet({ plan, grade, companyName }: SheetProps) {
  return (
    <div>
      <h1 className={styles.printTitle}>욕구사정 및 급여제공계획서</h1>
      <div className={styles.printMeta}>
        {companyName && <span>기관: {companyName}</span>}
        <span>수급자: {plan.elderlyName}</span>
        {grade && <span>장기요양등급: {grade}</span>}
        <span>계획 연도: {plan.planYear}년</span>
        <span>욕구사정일: {dotDate(plan.assessedOn)}</span>
        {plan.writerName && <span>작성자: {plan.writerName}</span>}
      </div>

      <div className={styles.printSection}>1. 욕구사정</div>
      <table className={styles.sheetTable}>
        <tbody>
          {/* 열 칸과 기피식품은 비어 있어도 줄을 그린다. 옛 '기타 요구'는 글이 있을 때만 */}
          {NEEDS_KEYS.filter((k) => k !== 'other' || (plan.needs.other ?? '').trim() !== '').map((k) => (
            <tr key={k}>
              <th scope="row" className={styles.sheetLabel}>
                {k === 'avoidFoods' ? '기피식품 (식사 유의사항)' : NEEDS_LABEL[k]}
              </th>
              <td>{plan.needs[k] || ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.printSection}>2. 목표</div>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <td>{plan.goals || ' '}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.printSection}>3. 제공 서비스</div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col" style={{ width: '6%' }}>번호</th>
            <th scope="col" style={{ width: '20%' }}>영역</th>
            <th scope="col">내용</th>
            <th scope="col" style={{ width: '16%' }}>횟수·주기</th>
          </tr>
        </thead>
        <tbody>
          {plan.services.length === 0 ? (
            <tr>
              <td colSpan={4}> </td>
            </tr>
          ) : (
            plan.services.map((s, i) => (
              <tr key={`${i}-${s.area}`}>
                <td>{i + 1}</td>
                <td>{s.area}</td>
                <td>{s.content}</td>
                <td>{s.frequency}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className={styles.printSection}>4. 수급자(보호자) 설명 및 동의</div>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <th scope="row" className={styles.sheetLabel}>
              동의일
            </th>
            <td>{plan.guardianAgreedOn ? dotDate(plan.guardianAgreedOn) : ' '}</td>
          </tr>
        </tbody>
      </table>
      <div className={styles.printSign}>
        <span>수급자(보호자) 서명: ______________________</span>
        <span>작성자 서명: ______________________</span>
      </div>
      <p className={styles.printNote}>이 출력본은 케어브이 실험실에서 만든 참고용입니다. 공단 공식 서식이 아니므로, 제출·보관용은 공단 서식을 확인해 사용해 주세요. 출력일 {dotDate(todayString())}</p>
    </div>
  );
}

/** 인쇄 전용 사본. 화면에서는 보이지 않고, 인쇄할 때만 나타난다. */
export function CarePlanPrintPortal(props: Omit<SheetProps, 'companyName'>) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;

  return createPortal(
    // 포털은 Astryx 테마 바깥(body 바로 아래)에 놓이므로, 토큰이 닿도록 테마 속성을 직접 단다
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 portrait; margin: 15mm; }
        @media print {
          body > *:not([data-lab-print-root]) { display: none !important; }
          html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
      <CarePlanSheet {...props} companyName={companyNameStored()} />
    </div>,
    host,
  );
}
