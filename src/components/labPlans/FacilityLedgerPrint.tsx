'use client';

/** 시설 관리 대장 인쇄본(A4 세로) — 항목·근거·주기·마지막 실시·다음 기한·보관 위치·확인란. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate } from '@/components/lab/labFormat';
import { cadenceLabel, FACILITY_GROUPS, FACILITY_ITEMS } from '@/lib/lab/facilityLedgerRules';
import type { LedgerSummary } from '@/lib/lab/facilityLedgerRules';
import type { FacilityLog, FacilityProfile } from '@/lib/lab/labTypes';
import { APPLIES_INFO, statusInfoOf } from './FacilityLedgerFormat';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';
import mine from './facilityLedger.module.css';

interface Props {
  summary: LedgerSummary | null;
  profile: FacilityProfile | null;
  logs: FacilityLog[];
  today: string;
  printKey: number;
  onReady: () => void;
}

/** 가장 늦은 실시 기록의 보관 위치 */
function latestLocation(logs: FacilityLog[], code: string): string {
  const mineLogs = logs.filter((l) => l.itemCode === code);
  if (mineLogs.length === 0) return '';
  const latest = mineLogs.reduce((a, b) => (b.doneOn > a.doneOn ? b : a));
  return latest.docLocation ?? '';
}

export default function FacilityLedgerPrint({ summary, profile, logs, today, printKey, onReady }: Props) {
  if (!summary) return null;
  const rowOf = new Map(summary.rows.map((r) => [r.code, r]));
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>시설 관리 대장</h1>
      <div className={styles.printMeta}>
        <span>기관명: {companyNameStored() || '____________'}</span>
        <span>사용승인일: {profile?.approvedOn ? dotDate(profile.approvedOn) : '____________'}</span>
        <span>소방안전관리자: {profile?.fireManagerName || '____________'}</span>
      </div>
      {FACILITY_GROUPS.map((g) => (
        <div key={g.key}>
          <p className={styles.printSection}>{g.label}</p>
          <table className={`${styles.sheetTable} ${mine.printSmall} ${mine.printFixed}`}>
            <colgroup>
              <col style={{ width: '17%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>항목</th>
                <th>근거</th>
                <th>주기</th>
                <th>적용</th>
                <th>마지막 실시</th>
                <th>다음 기한</th>
                <th>보관 위치</th>
                <th className={mine.printCheck}>확인</th>
              </tr>
            </thead>
            <tbody>
              {FACILITY_ITEMS.filter((i) => i.group === g.key).map((item) => {
                const row = rowOf.get(item.code);
                const applies = row ? APPLIES_INFO[row.applies].label : '';
                const na = row?.status === 'NA';
                return (
                  <tr key={item.code}>
                    <td>{item.name}{item.basis === 'EVAL' ? ' (평가 요건)' : ''}</td>
                    <td>{item.lawRef}</td>
                    <td>{cadenceLabel(item.cadence)}</td>
                    <td>{applies}{row && row.applies !== 'YES' ? `\n${row.reason}` : ''}</td>
                    <td>{dotDate(row?.lastDoneOn)}</td>
                    <td>{na ? '-' : row?.dueYmd ? dotDate(row.dueYmd) : row ? statusInfoOf(item.code, row.status).label : ''}</td>
                    <td>{latestLocation(logs, item.code)}</td>
                    <td className={mine.printCheck} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <p className={styles.printNote}>적용 여부와 다음 기한은 입력한 시설 정보와 실시 기록으로 계산한 것이며, 확인 필요 항목은 관할 기관에 확인합니다. 분기 전문소독은 2026 평가 요건입니다. 결과서는 항목별 보관 기간 동안 보관합니다.</p>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(today)}</span>
        <span>시설장: ____________ (서명)</span>
      </div>
    </PlansPrintPortal>
  );
}
