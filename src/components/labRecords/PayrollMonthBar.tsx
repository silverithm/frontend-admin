'use client';

/** 월 급여대장 위쪽 줄 — 월 이동, 장기근속 기준, 지난달 복사·전체 저장·확정·인쇄 버튼과 이달 합계. */
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, MonthStepper, SupportText } from '@/components/lab/LabUi';
import type { LongServiceFacility } from '@/lib/lab/labTypes';
import { FACILITY_LABEL } from './PayrollDraft';
import type { MonthRow, MonthTotals } from './PayrollDraft';
import { won } from './FinanceFormat';
import styles from './labRecords.module.css';

interface Props {
  month: string;
  onMonth: (m: string) => void;
  facility: LongServiceFacility;
  onFacility: (f: LongServiceFacility) => void;
  rows: MonthRow[];
  totals: MonthTotals;
  busy: boolean;
  saving: boolean;
  copying: boolean;
  confirming: boolean;
  onCopyPrev: () => void;
  onSaveAll: () => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onPrintAll: () => void;
  missingNames: string[];
}

export default function PayrollMonthBar({ month, onMonth, facility, onFacility, rows, totals, busy, saving, copying, confirming, onCopyPrev, onSaveAll, onConfirm, onUnconfirm, onPrintAll, missingNames }: Props) {
  const count = (s: MonthRow['status']) => rows.filter((r) => r.status === s).length;
  const pending = count('new') + count('edited');
  const invalid = count('invalid');
  const locked = count('locked');
  const confirmable = rows.length > 0 && pending === 0 && invalid === 0 && count('saved') > 0;
  const anyLocked = locked > 0;
  const editable = rows.filter((r) => r.status !== 'locked' && r.status !== 'orphan');

  return (
    <div className={styles.stackTight}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={onMonth} isDisabled={busy} />
        <SegmentedControl label="장기근속장려금 기준 (대조 필요)" value={facility} onChange={(v) => onFacility(v as LongServiceFacility)}>
          <SegmentedControlItem value="HOME" label={FACILITY_LABEL.HOME} />
          <SegmentedControlItem value="RESIDENTIAL" label={FACILITY_LABEL.RESIDENTIAL} />
        </SegmentedControl>
        <Button label="지난달 시간·수당 복사" variant="secondary" isLoading={copying} isDisabled={busy || editable.length === 0} onClick={onCopyPrev} />
        <HStack gap={2} vAlign="center" wrap="wrap">
          {pending > 0 && <Chip tone="warn" label={`저장 전 ${pending}명`} />}
          {invalid > 0 && <Chip tone="danger" label={`입력 확인 ${invalid}명`} />}
          {locked > 0 && <Chip tone="ok" label={`확정 ${locked}명`} />}
        </HStack>
      </div>

      {missingNames.length > 0 && (
        <Banner
          status="warning"
          title={`급여 기준이 없는 직원 ${missingNames.length}명은 이 표에 없습니다`}
          description={`${missingNames.slice(0, 6).join(', ')}${missingNames.length > 6 ? ' 외' : ''} — 위의 “급여 기준” 보기에서 설정하면 표에 나타납니다.`}
        />
      )}
      {anyLocked && locked === rows.length && <Banner status="info" title="확정된 달입니다" description="입력이 잠겨 있습니다. 고치려면 ‘확정 풀기’를 누르세요." />}

      <div className={styles.toolbar}>
        <div className={styles.statBox}>
          <Text type="supporting" color="secondary">
            총지급 합계 ({totals.headcount}명)
          </Text>
          <Text type="label" hasTabularNumbers>
            {won(totals.gross)}
          </Text>
        </div>
        <div className={styles.statBox}>
          <Text type="supporting" color="secondary">
            공제 합계
          </Text>
          <Text type="label" hasTabularNumbers>
            {won(totals.deductions)}
          </Text>
        </div>
        <div className={styles.statBox}>
          <Text type="supporting" color="secondary">
            실지급 합계
          </Text>
          <Text type="label" hasTabularNumbers>
            {won(totals.net)}
          </Text>
        </div>
        <div className={styles.statBox}>
          <Text type="supporting" color="secondary">
            사업주 부담 합계
          </Text>
          <Text type="label" hasTabularNumbers>
            {won(totals.employer)}
          </Text>
        </div>
        <span className={styles.spacer} />
        <HStack gap={2} wrap="wrap">
          <Button label="명세서 전체 인쇄" variant="ghost" isDisabled={busy || rows.length === 0} onClick={onPrintAll} />
          {anyLocked && <Button label="확정 풀기" variant="secondary" isLoading={confirming} isDisabled={busy} onClick={onUnconfirm} />}
          <Button label="이달 확정" variant="secondary" isLoading={confirming} isDisabled={busy || !confirmable} onClick={onConfirm} />
          <Button label={pending > 0 ? `전체 계산·저장 (${pending}명)` : '전체 계산·저장'} variant="primary" isLoading={saving} isDisabled={busy || pending === 0} onClick={onSaveAll} />
        </HStack>
      </div>
      <SupportText>
        사업주 부담: 국민연금 {won(totals.employerNps)} · 건강보험 {won(totals.employerHealth)} · 장기요양 {won(totals.employerLtc)} · 고용보험 {won(totals.employerEmployment)}. 시간 칸에서 Tab은 옆 칸, Enter는 아래 직원으로 옮깁니다.
        {pending > 0 || invalid > 0 ? ' 저장하지 않은 줄이 있으면 확정할 수 없습니다.' : ''}
      </SupportText>
    </div>
  );
}
