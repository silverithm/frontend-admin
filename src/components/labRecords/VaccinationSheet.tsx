'use client';

/** 연도별 접종 현황 A4 인쇄본 — 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone. */
import { useEffect } from 'react';
import type { SeasonProgress } from '@/lib/lab/vaccineRules';
import type { Vaccination } from '@/lib/lab/labTypes';
import { companyNameStored, dotDate } from '@/components/lab/labFormat';
import { STATUS_LABEL, VERIFIED_LABEL } from './VaccinationDraft';
import type { ActiveElder } from './VaccinationDraft';
import RecordsPrintPortal from './RecordsPrint';
import { useLatest } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './Vaccination.module.css';

interface Props {
  year: number;
  elders: ActiveElder[];
  /** 그 연도의 인플루엔자 기록 */
  records: Vaccination[];
  progress: SeasonProgress;
  today: string;
  onDone: () => void;
}

export default function VaccinationSheet({ year, elders, records, progress, today, onDone }: Props) {
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

  const byElder = new Map<number, Vaccination>();
  for (const r of records) if (r.vaccine === 'INFLUENZA') byElder.set(r.elderlyId, r);
  const company = companyNameStored();

  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>{year}년 인플루엔자 예방접종 현황</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>출력일: {dotDate(today)}</span>
        <span>
          접종 {progress.done}명 · 거부 {progress.refused}명 · 제외 {progress.excluded}명 · 미확인 {progress.unknown}명 (진행 중 {progress.total}명)
        </span>
        <span>접종률: {progress.rate === null ? '-' : `${progress.rate}%`} (거부·제외 제외)</span>
      </div>
      <table className={own.sheetTable}>
        <thead>
          <tr>
            <th>어르신</th>
            <th>상태</th>
            <th>접종일</th>
            <th>접종 기관</th>
            <th>확인 방법</th>
            <th>사유·메모</th>
          </tr>
        </thead>
        <tbody>
          {elders.map((e) => {
            const r = byElder.get(e.id);
            return (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{r ? STATUS_LABEL[r.status] : '미확인'}</td>
                <td>{r?.givenOn ? dotDate(r.givenOn) : '-'}</td>
                <td>{r?.institution ?? '-'}</td>
                <td>{r?.verifiedBy ? VERIFIED_LABEL[r.verifiedBy] : '-'}</td>
                <td>{[r?.reason, r?.note].filter(Boolean).join(' · ') || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.printNote}>
        진행 중(계약 유지) 어르신의 인플루엔자 접종 기록입니다. 거부·제외 사유는 간호일지와 급여제공기록지에도 남겨 두세요. 평가 접종률 환산은 계약 이력과 전년도 기록으로 따로 계산합니다.
      </p>
    </RecordsPrintPortal>
  );
}
