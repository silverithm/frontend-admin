'use client';

/** 폐렴구균·코로나19 — 평가 항목이 아니라 참고로만 접어 둔다. 기록은 '접종 기록'에서 백신을 골라 남긴다. */
import { Text } from '@astryxdesign/core/Text';
import type { Vaccination } from '@/lib/lab/labTypes';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { STATUS_LABEL, STATUS_TONE, VACCINE_LABEL } from './VaccinationDraft';
import styles from './labRecords.module.css';
import own from './Vaccination.module.css';

export default function VaccinationOther({ year, records }: { year: number; records: Vaccination[] }) {
  const others = records
    .filter((r) => r.vaccine !== 'INFLUENZA')
    .sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko') || a.vaccine.localeCompare(b.vaccine));
  return (
    <details className={own.guide}>
      <summary>폐렴구균·코로나19 — 참고 (평가 항목 아님)</summary>
      <p>평가는 인플루엔자 접종률만 봅니다. 폐렴구균·코로나19는 어르신 건강 관리용으로만 남기며 평가 접종률에는 들어가지 않습니다. 기록은 위의 접종 기록 단추에서 백신을 골라 남깁니다.</p>
      {others.length === 0 ? (
        <p>{year}년에 남긴 폐렴구균·코로나19 기록이 없습니다.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>어르신</th>
                <th>백신</th>
                <th>상태</th>
                <th>접종일</th>
                <th>기관</th>
              </tr>
            </thead>
            <tbody>
              {others.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Text type="label">{r.elderlyName}</Text>
                  </td>
                  <td>{VACCINE_LABEL[r.vaccine]}</td>
                  <td>
                    <Chip tone={STATUS_TONE[r.status]} label={STATUS_LABEL[r.status]} />
                  </td>
                  <td>{r.givenOn ? dotDate(r.givenOn) : '-'}</td>
                  <td>{r.institution ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
