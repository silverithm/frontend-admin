'use client';

/** 항목 표의 한 줄 — 적용 판정(직접 지정 포함), 마지막 실시일, 다음 기한, D-day, 상태. */
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { cadenceLabel } from '@/lib/lab/facilityLedgerRules';
import type { ApplyResult, FacilityItem, LedgerRow } from '@/lib/lab/facilityLedgerRules';
import type { FacilityApplies } from '@/lib/lab/labTypes';
import { APPLIES_INFO, OVERRIDE_OPTIONS, ddayText, rowTone, statusInfoOf } from './FacilityLedgerFormat';
import styles from './facilityLedger.module.css';

interface Props {
  item: FacilityItem;
  row: LedgerRow;
  override: FacilityApplies | undefined;
  /** 직접 지정을 걷어 냈을 때의 자동 판정(직접 지정이 없으면 null) */
  autoApplies: ApplyResult | null;
  isOpen: boolean;
  isSaving: boolean;
  needApproval: boolean;
  onToggle: () => void;
  onOverride: (value: FacilityApplies | null) => void;
}

export default function FacilityLedgerRow({ item, row, override, autoApplies, isOpen, isSaving, needApproval, onToggle, onOverride }: Props) {
  const applies = APPLIES_INFO[row.applies];
  const status = statusInfoOf(item.code, row.status);
  const tone = rowTone(row.applies, row.status, row.daysLeft);
  const unknownOverdue = row.applies === 'UNKNOWN' && row.status === 'OVERDUE';
  const statusLabel = row.status === 'NEED_INFO' && needApproval ? '사용승인일 필요' : unknownOverdue ? '해당이면 기한 지남' : status.label;
  return (
    <tr className={styles.row} data-tone={tone} data-na={row.status === 'NA' ? 'true' : undefined} data-open={isOpen ? 'true' : undefined}>
      <td data-label="항목">
        <div className={styles.cell}>
          <Text type="label">{item.name}</Text>
          <div className={styles.chipRow}>
            <Chip tone={item.basis === 'LAW' ? 'info' : 'warn'} label={item.basis === 'LAW' ? '법정' : '평가 요건'} />
          </div>
        </div>
      </td>
      <td data-label="근거">
        <Text type="supporting" color="secondary">{item.lawRef}</Text>
      </td>
      <td data-label="주기">
        <Text type="supporting">{cadenceLabel(item.cadence)}</Text>
      </td>
      <td data-label="적용">
        <div className={styles.cell}>
          <div className={styles.chipRow}>
            <Chip tone={applies.tone} label={applies.label} />
          </div>
          <Text type="supporting" color="secondary">{row.reason}</Text>
          {autoApplies && <Text type="supporting" color="secondary">자동 판정은 ‘{APPLIES_INFO[autoApplies.applies].label}’ — {autoApplies.reason}</Text>}
          <Selector
            label="직접 지정"
            placeholder="고르기"
            size="sm"
            options={OVERRIDE_OPTIONS}
            value={override ?? 'AUTO'}
            isDisabled={isSaving}
            onChange={(v) => {
              if (!v) return;
              const next = v === 'AUTO' ? null : (v as FacilityApplies);
              if ((next ?? undefined) !== override) onOverride(next);
            }}
          />
        </div>
      </td>
      <td data-label="마지막 실시일" className={styles.num}>{dotDate(row.lastDoneOn)}</td>
      <td data-label="다음 기한" className={styles.num}>{row.status === 'NA' ? '-' : dotDate(row.dueYmd)}</td>
      <td data-label="D-day" className={styles.num}>{row.status === 'NA' ? '-' : ddayText(row.daysLeft)}</td>
      <td data-label="상태">
        <div className={styles.cell}>
          <div className={styles.chipRow}>
            <Chip tone={unknownOverdue ? 'warn' : status.tone} label={statusLabel} />
          </div>
          {row.missed > 0 && row.status !== 'NA' && <Text type="supporting" color="secondary">빠진 기간 {row.missed}번</Text>}
        </div>
      </td>
      <td>
        <Button label={isOpen ? '기록 닫기' : '기록 보기·쓰기'} variant="secondary" size="sm" onClick={onToggle} />
      </td>
    </tr>
  );
}
