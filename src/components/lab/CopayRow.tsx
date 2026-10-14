'use client';

/**
 * 본인부담금 한 줄 — 어르신 한 명의 청구 입력과 결과.
 * 접어 두면 한 줄 요약(등급·일수·청구액·납부 상태), 펼치면 입력칸과 계산 내역이 나온다.
 * 숫자는 입력할 때마다 buildCopayBillInput으로 다시 계산하고, 계산할 수 없으면 이유를 그 자리에 보여 준다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { billTotals, MAX_MONEY, MAX_NON_COVERED_ITEMS, MAX_NON_COVERED_LABEL } from '@/lib/lab/copayBill';
import { CARE_GRADES, COPAY_CLASSES, DAYCARE_UNITS, HOUR_BANDS, MAX_DAYS_IN_MONTH, formatWon, gradeLabel, hourBand } from '@/lib/ltc2026';
import type { CopayBill, CopayClass, DaycareUnit, HourBand, LtcCareGrade } from '@/lib/lab/labTypes';
import { Chip, NumField, SupportText } from './LabUi';
import { buildFromDraft, isBuildError, newItem, remainingDue, statusChip } from './copayDraft';
import type { CopayDraft } from './copayDraft';
import type { LabElder } from './useLabElders';
import styles from './lab.module.css';

interface CopayRowProps {
  elder: LabElder;
  month: string;
  draft: CopayDraft;
  bill: CopayBill | null;
  dirty: boolean;
  isSaving: boolean;
  /** 출석 기록 일수(불러오지 못했으면 null) */
  attendanceDays: number | null;
  onChange: (next: CopayDraft) => void;
  onSave: () => void;
  onPay: () => void;
  onNotice: () => void;
  onDelete: () => void;
}

const GRADE_OPTIONS = CARE_GRADES.map((g) => ({ value: g.id, label: g.label }));
const CLASS_OPTIONS = COPAY_CLASSES.map((c) => ({ value: c.id, label: c.label }));
const UNIT_OPTIONS = DAYCARE_UNITS.map((u) => ({ value: u.id, label: u.label }));
const BAND_OPTIONS = HOUR_BANDS.map((b) => ({ value: b.id, label: b.label }));

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={styles.figure}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <Text type="body" weight={strong ? 'bold' : 'medium'} hasTabularNumbers>
        {value}
      </Text>
    </div>
  );
}

export default function CopayRow({ elder, month, draft, bill, dirty, isSaving, attendanceDays, onChange, onSave, onPay, onNotice, onDelete }: CopayRowProps) {
  const [open, setOpen] = useState(false);
  const built = useMemo(() => buildFromDraft(elder.id, month, draft), [elder.id, month, draft]);
  const ok = !isBuildError(built);
  const totals = ok ? billTotals(built) : null;

  const patch = (p: Partial<CopayDraft>) => onChange({ ...draft, ...p });
  const status = bill ? statusChip(bill.status) : null;
  const summary =
    draft.grade === ''
      ? '등급 없음'
      : [
          gradeLabel(draft.grade),
          COPAY_CLASSES.find((c) => c.id === draft.copayClass)?.label.split(' (')[0],
          hourBand(draft.band).short,
          draft.days === null ? '일수 입력 필요' : `${draft.days}일`,
        ].join(' · ');

  return (
    <div className={styles.rowBlock}>
      <div className={styles.rowHead}>
        <VStack gap={0.5}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="body" weight="semibold">
              {elder.name}
            </Text>
            {status && <Chip tone={status.tone} label={status.label} />}
            {!bill && <Chip tone="neutral" label="아직 청구 전" />}
            {dirty && <Chip tone="warn" label="저장 전" />}
            {!ok && <Chip tone="danger" label="입력 확인" />}
          </HStack>
          <Text type="supporting" color="secondary">
            {summary}
          </Text>
        </VStack>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <VStack gap={0.5} hAlign="end">
            <Text type="body" weight="bold" hasTabularNumbers>
              {totals ? formatWon(totals.totalDue) : '-'}
            </Text>
            {bill && !dirty && (
              <Text type="supporting" color="secondary" hasTabularNumbers>
                남은 금액 {formatWon(remainingDue(bill))}
              </Text>
            )}
          </VStack>
          <Button label={open ? '접기' : '편집'} size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} />
        </HStack>
      </div>

      {open && (
        <div style={{ marginTop: 'var(--spacing-3)' }}>
        <VStack gap={3}>
          <div className={styles.fieldGrid}>
            <Selector
              label="등급"
              options={GRADE_OPTIONS}
              value={draft.grade === '' ? undefined : draft.grade}
              placeholder="등급 선택"
              onChange={(v) => v && patch({ grade: v as LtcCareGrade })}
            />
            <Selector label="감경 구분" options={CLASS_OPTIONS} value={draft.copayClass} onChange={(v) => v && patch({ copayClass: v as CopayClass })} />
            <Selector label="단위" options={UNIT_OPTIONS} value={draft.unit} onChange={(v) => v && patch({ unit: v as DaycareUnit })} />
            <Selector label="시간 구간" options={BAND_OPTIONS} value={draft.band} onChange={(v) => v && patch({ band: v as HourBand })} />
            <NumField
              label="이용일수"
              value={draft.days}
              onChange={(v) => patch({ days: v })}
              max={MAX_DAYS_IN_MONTH}
              grouped={false}
              description={attendanceDays !== null ? `출석 기록 ${attendanceDays}일` : '출석 기록을 불러오지 못했습니다'}
            />
            <NumField label="이전 미납" value={draft.previousUnpaid} onChange={(v) => patch({ previousUnpaid: v })} max={MAX_MONEY} description="원" />
          </div>

          <VStack gap={2}>
            <HStack hAlign="between" vAlign="center" gap={2}>
              <Text type="label">비급여 항목 (식비·간식·이미용 등)</Text>
              <Button
                label="항목 추가"
                size="sm"
                variant="secondary"
                isDisabled={draft.items.length >= MAX_NON_COVERED_ITEMS}
                onClick={() => patch({ items: [...draft.items, newItem()] })}
              />
            </HStack>
            {draft.items.length === 0 && <SupportText>비급여 항목이 없습니다. 식비 등을 따로 받으면 항목을 추가해 주세요.</SupportText>}
            {draft.items.map((item, index) => (
              <div className={styles.itemLine} key={item.key}>
                <TextInput
                  label={`비급여 항목 ${index + 1} 이름`}
                  isLabelHidden
                  placeholder="예: 식비"
                  value={item.label}
                  onChange={(v) => patch({ items: draft.items.map((it) => (it.key === item.key ? { ...it, label: v.slice(0, MAX_NON_COVERED_LABEL) } : it)) })}
                />
                <NumField
                  label={`비급여 항목 ${index + 1} 금액`}
                  isLabelHidden
                  placeholder="금액(원)"
                  value={item.amount}
                  max={MAX_MONEY}
                  onChange={(v) => patch({ items: draft.items.map((it) => (it.key === item.key ? { ...it, amount: v } : it)) })}
                />
                <IconButton
                  label={`비급여 항목 ${index + 1} 지우기`}
                  tooltip="항목 지우기"
                  variant="ghost"
                  icon={<Icon icon="close" size="sm" />}
                  onClick={() => patch({ items: draft.items.filter((it) => it.key !== item.key) })}
                />
              </div>
            ))}
          </VStack>

          {ok ? (
            <div className={styles.figures}>
              <Figure label="1일 급여비용" value={formatWon(built.dailyFee)} />
              <Figure label="급여 총액" value={formatWon(built.coveredTotal)} />
              <Figure label="본인부담금" value={formatWon(built.copayAmount)} />
              <Figure label="한도 초과분" value={formatWon(built.overLimitAmount)} />
              <Figure label="비급여 합계" value={formatWon(totals?.nonCoveredAmount ?? 0)} />
              <Figure label="이전 미납" value={formatWon(built.previousUnpaid)} />
              <Figure label="청구 합계" value={formatWon(totals?.totalDue ?? 0)} strong />
            </div>
          ) : (
            <SupportText tone="error">{built.error}</SupportText>
          )}
        </VStack>
        </div>
      )}

      <div style={{ marginTop: 'var(--spacing-3)' }}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button
          label={bill ? '변경 저장' : '청구서 저장'}
          size="sm"
          variant={dirty ? 'primary' : 'secondary'}
          isLoading={isSaving}
          isDisabled={isSaving || !ok || (!dirty && bill !== null)}
          onClick={onSave}
        />
        <Button label="수납 입력" size="sm" variant="secondary" isDisabled={!bill || dirty || isSaving || remainingDue(bill) <= 0} onClick={onPay} />
        <Button label="안내 문자" size="sm" variant="secondary" isDisabled={!bill || dirty || isSaving} onClick={onNotice} />
        {bill && <Button label="청구서 삭제" size="sm" variant="ghost" isDisabled={isSaving} onClick={onDelete} />}
        {bill && dirty && <SupportText>변경을 저장하면 수납·안내 문자를 쓸 수 있어요.</SupportText>}
      </HStack>
      </div>
    </div>
  );
}
