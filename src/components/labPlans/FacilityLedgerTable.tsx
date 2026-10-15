'use client';

/** 항목 표 — FACILITY_GROUPS로 묶고, 적용 아님(NA) 줄은 접어 둔다. 항목을 열면 그 줄 아래에 실시 기록이 펼쳐진다. */
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { FACILITY_GROUPS, FACILITY_ITEMS, itemApplies } from '@/lib/lab/facilityLedgerRules';
import type { FacilityItem, LedgerSummary } from '@/lib/lab/facilityLedgerRules';
import type { FacilityApplies, FacilityItemCode, FacilityProfile } from '@/lib/lab/labTypes';
import FacilityLedgerRow from './FacilityLedgerRow';
import styles from './facilityLedger.module.css';

interface Props {
  summary: LedgerSummary;
  profile: FacilityProfile | null;
  openCode: FacilityItemCode | null;
  savingCode: FacilityItemCode | null;
  onToggle: (code: FacilityItemCode) => void;
  onOverride: (code: FacilityItemCode, value: FacilityApplies | null) => void;
  renderPanel: (item: FacilityItem) => ReactNode;
}

export default function FacilityLedgerTable({ summary, profile, openCode, savingCode, onToggle, onOverride, renderPanel }: Props) {
  // 접은 그룹의 '해당 없음' 줄. 열어 둔 항목은 접혀도 보인다
  const [showNa, setShowNa] = useState<Record<string, boolean>>({});
  const rowOf = new Map(summary.rows.map((r) => [r.code, r]));
  const needApproval = !profile?.approvedOn;
  return (
    <div className={styles.lines}>
      {FACILITY_GROUPS.map((g) => {
        const items = FACILITY_ITEMS.filter((i) => i.group === g.key);
        const na = items.filter((i) => rowOf.get(i.code)?.status === 'NA');
        const expanded = showNa[g.key] === true;
        const visible = items.filter((i) => rowOf.get(i.code)?.status !== 'NA' || expanded || i.code === openCode);
        return (
          <div key={g.key} className={styles.lines}>
            <div className={styles.groupTitle}>
              <Text type="label">{g.label}</Text>
              <Chip tone="neutral" label={`항목 ${items.length}개`} />
              {na.length > 0 && <Chip tone="neutral" label={`해당 없음 ${na.length}개`} />}
              {na.length > 0 && <Button label={expanded ? '해당 없음 접기' : '해당 없음 펼치기'} variant="ghost" size="sm" onClick={() => setShowNa((s) => ({ ...s, [g.key]: !expanded }))} />}
            </div>
            {visible.length === 0 ? (
              <Text type="supporting" color="secondary">이 묶음의 항목은 모두 이 센터에 해당하지 않습니다.</Text>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th className={styles.colName}>항목</th>
                      <th className={styles.colLaw}>근거</th>
                      <th>주기</th>
                      <th className={styles.colApply}>적용</th>
                      <th>마지막 실시일</th>
                      <th>다음 기한</th>
                      <th>D-day</th>
                      <th>상태</th>
                      <th>기록</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => {
                      const row = rowOf.get(item.code);
                      if (!row) return null;
                      const isOpen = openCode === item.code;
                      return (
                        <Fragment key={item.code}>
                          <FacilityLedgerRow
                            item={item}
                            row={row}
                            override={profile?.appliesOverride?.[item.code]}
                            autoApplies={profile?.appliesOverride?.[item.code] ? itemApplies(profile ? { ...profile, appliesOverride: {} } : null, item.code) : null}
                            isOpen={isOpen}
                            isSaving={savingCode !== null}
                            needApproval={needApproval && (item.cadence.kind === 'APPROVAL_MONTH')}
                            onToggle={() => onToggle(item.code)}
                            onOverride={(v) => onOverride(item.code, v)}
                          />
                          {isOpen && (
                            <tr className={styles.panelRow}>
                              <td colSpan={9}>{renderPanel(item)}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
