'use client';

/** 감염병 유행·발생 기록 한 건 A4 인쇄본 — 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone. */
import { useEffect } from 'react';
import type { Outbreak } from '@/lib/lab/labTypes';
import { OUTBREAK_ACTIONS, outbreakCheck } from '@/lib/lab/outbreakRules';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { alertLabel, kindLabel } from './OutbreakDraft';
import RecordsPrintPortal from './RecordsPrint';
import { useLatest } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './Outbreak.module.css';

export default function OutbreakSheet({ outbreak, onDone }: { outbreak: Outbreak; onDone: () => void }) {
  const company = companyNameStored();
  const done = useLatest(onDone);
  useEffect(() => {
    const finish = () => done.current();
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [done]);

  const national = outbreak.kind === 'NATIONAL';
  const check = outbreakCheck(outbreak, todayString());
  const date = (v: string | null) => (v ? dotDate(v.slice(0, 10)) : '');
  const cell = (label: string, value: string) => (
    <div className={own.sheetCell}>
      <span className={own.sheetCellLabel}>{label}</span>
      <span>{value || '-'}</span>
    </div>
  );
  const done11 = new Set(outbreak.actions);

  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>감염병 유행·발생 대응 기록</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      <div className={own.sheetGrid}>
        {cell('종류', kindLabel(outbreak.kind))}
        {cell('병명·증상', outbreak.disease)}
        {cell('시작일', date(outbreak.startedOn))}
        {cell('종료일', outbreak.endedOn ? date(outbreak.endedOn) : '진행 중')}
        {national ? cell('경보 단계', alertLabel(outbreak.alertLevel)) : cell('환자 수', `수급자 ${outbreak.elderCases}명 · 직원 ${outbreak.staffCases}명`)}
        {cell(outbreak.endedOn ? '지속 일수' : '진행 일수', `${check.daysOpen}일`)}
        {!national && cell('보호자 안내일', date(outbreak.guardianNotifiedOn))}
        {!national && cell('보건소 신고일', date(outbreak.healthCenterReportedOn))}
        {!national && cell('지자체·공단 보고일', date(outbreak.authorityReportedOn))}
      </div>
      <div className={styles.printSection}>한 조치</div>
      <div className={own.sheetGrid}>
        {OUTBREAK_ACTIONS.map((a) => (
          <div className={own.sheetCell} key={a.key}>
            <span>{done11.has(a.key) ? '■' : '□'}</span>
            <span>{a.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.printSection}>메모</div>
      <div className={own.sheetBlock}>{outbreak.note ?? ''}</div>
      <div className={styles.printSign}>
        <span>작성자{outbreak.writerName ? ` (${outbreak.writerName})` : ''} (서명): ______________________</span>
        <span>시설장 확인 (서명): ______________________</span>
      </div>
      <p className={styles.printNote}>기관 자체 양식입니다(2023 공단 안전·감염관리 매뉴얼 기준). 공식 신고서가 아니므로 신고는 보건소·공단 절차를 따라 주세요. 출력일 {dotDate(todayString())}</p>
    </RecordsPrintPortal>
  );
}
