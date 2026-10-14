'use client';

/** 월 급여대장 한 직원의 펼침 — 기타 수당·공제 입력과 계산 내역(지급·공제·사업주 부담). 확정된 줄은 보기만 한다. */
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { NumField, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { MAX_EXTRA_LINES, deductionTotal } from './PayrollDraft';
import type { AllowDraft, DeductDraft, MonthRow } from './PayrollDraft';
import { num } from './FinanceFormat';
import styles from './labRecords.module.css';

interface Props {
  row: MonthRow;
  readOnly: boolean;
  onAllowances: (next: AllowDraft[]) => void;
  onDeductions: (next: DeductDraft[]) => void;
}

const MAX_AMOUNT = 100_000_000;

function Line({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  if (amount === 0 && !bold) return null;
  return (
    <tr>
      <th scope="row" className={bold ? styles.dangerText : undefined}>
        {label}
      </th>
      <td className={styles.num}>{num(amount)}</td>
    </tr>
  );
}

export default function PayrollRowDetail({ row, readOnly, onAllowances, onDeductions }: Props) {
  const a = row.amounts;
  const allowances = row.draft.allowances;
  const deductions = row.draft.deductions;
  const patchAllow = (i: number, patch: Partial<AllowDraft>) => onAllowances(allowances.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const patchDeduct = (i: number, patch: Partial<DeductDraft>) => onDeductions(deductions.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className={styles.fieldGridWide}>
      <VStack gap={3}>
        <Text type="label">기타 수당</Text>
        {allowances.length === 0 && <SupportText>직책수당·성과금처럼 달마다 다른 지급을 넣습니다. 비과세로 표시한 수당은 4대보험·소득세 기준에서 빠집니다.</SupportText>}
        {allowances.map((x, i) => (
          <div key={i} className={styles.extraLine}>
            <TextInput label={`${row.name} 기타 수당 ${i + 1} 이름`} isLabelHidden placeholder="항목 이름 (예: 직책수당)" value={x.label} onChange={(v) => patchAllow(i, { label: v.slice(0, 30) })} isDisabled={readOnly} />
            <NumField label={`${row.name} 기타 수당 ${i + 1} 금액`} isLabelHidden placeholder="금액(원)" value={x.amount} onChange={(v) => patchAllow(i, { amount: v })} max={MAX_AMOUNT} isDisabled={readOnly} />
            <CheckboxInput label="과세" value={x.taxable} onChange={(v) => patchAllow(i, { taxable: v })} isDisabled={readOnly} />
            <IconButton label={`기타 수당 ${i + 1} 지우기`} tooltip="지우기" variant="ghost" isDisabled={readOnly} onClick={() => onAllowances(allowances.filter((_, j) => j !== i))} icon={<Icon icon="close" size="sm" />} />
          </div>
        ))}
        <div>
          <Button label="기타 수당 줄 추가" variant="ghost" size="sm" isDisabled={readOnly || allowances.length >= MAX_EXTRA_LINES} onClick={() => onAllowances([...allowances, { label: '', amount: null, taxable: true }])} />
        </div>

        <Text type="label">기타 공제</Text>
        {deductions.length === 0 && <SupportText>결근·지각 공제, 가불 정산, 건강보험 정산분 등을 넣습니다.</SupportText>}
        {deductions.map((x, i) => (
          <div key={i} className={styles.extraLine}>
            <TextInput label={`${row.name} 기타 공제 ${i + 1} 이름`} isLabelHidden placeholder="항목 이름 (예: 가불 정산)" value={x.label} onChange={(v) => patchDeduct(i, { label: v.slice(0, 30) })} isDisabled={readOnly} />
            <NumField label={`${row.name} 기타 공제 ${i + 1} 금액`} isLabelHidden placeholder="금액(원)" value={x.amount} onChange={(v) => patchDeduct(i, { amount: v })} max={MAX_AMOUNT} isDisabled={readOnly} />
            <span />
            <IconButton label={`기타 공제 ${i + 1} 지우기`} tooltip="지우기" variant="ghost" isDisabled={readOnly} onClick={() => onDeductions(deductions.filter((_, j) => j !== i))} icon={<Icon icon="close" size="sm" />} />
          </div>
        ))}
        <div>
          <Button label="기타 공제 줄 추가" variant="ghost" size="sm" isDisabled={readOnly || deductions.length >= MAX_EXTRA_LINES} onClick={() => onDeductions([...deductions, { label: '', amount: null }])} />
        </div>
      </VStack>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <tbody>
            <Line label="기본급" amount={a.basePay} />
            <Line label="연장근로수당" amount={a.overtimePay} />
            <Line label="야간근로수당" amount={a.nightPay} />
            <Line label="휴일근로수당" amount={a.holidayPay} />
            <Line label="장기근속장려금" amount={a.longServiceAward} />
            <Line label="선임 요양보호사 수당" amount={a.seniorAllowance} />
            {a.otherAllowances.map((x, i) => (
              <Line key={`oa${i}`} label={`${x.label || '기타 수당'}${x.taxable ? '' : ' (비과세)'}`} amount={x.amount} />
            ))}
            <Line label="비과세 식대" amount={a.mealAllowance} />
            <Line label="총지급액" amount={a.grossPay} bold />
            <Line label="국민연금" amount={a.nps} />
            <Line label="건강보험" amount={a.health} />
            <Line label="장기요양보험" amount={a.ltc} />
            <Line label="고용보험" amount={a.employment} />
            <Line label="소득세" amount={a.incomeTax} />
            <Line label="지방소득세" amount={a.localTax} />
            {a.otherDeductions.map((x, i) => (
              <Line key={`od${i}`} label={x.label || '기타 공제'} amount={x.amount} />
            ))}
            <Line label="공제 합계" amount={deductionTotal(a)} bold />
            <Line label="실지급액" amount={a.netPay} bold />
            <tr>
              <th scope="row" className={styles.mutedText}>
                사업주 부담 (국민연금·건강·장기요양·고용)
              </th>
              <td className={`${styles.num} ${styles.mutedText}`}>{num(a.employerNps + a.employerHealth + a.employerLtc + a.employerEmployment)}</td>
            </tr>
          </tbody>
        </table>
        {row.saved?.confirmedAt && <SupportText>확정 {dotDate(row.saved.confirmedAt.slice(0, 10))}</SupportText>}
      </div>
    </div>
  );
}
