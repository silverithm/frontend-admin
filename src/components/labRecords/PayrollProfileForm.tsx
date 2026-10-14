'use client';

/** 직원 한 명의 급여 기준 편집 양식 — 직종·급여 방식·금액·가족·원천징수 비율·식대·입사일·선임·4대보험 가입. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, NumField, SupportText } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { MIN_WAGE_2026, MEAL_TAX_FREE_LIMIT, minimumWageIssue } from '@/lib/lab/payrollRules';
import type { PayrollPayType, WithholdingRate } from '@/lib/lab/labTypes';
import { JOB_OPTIONS, calcProfileOf, profileDraftIssues, wageBasis } from './PayrollDraft';
import type { ProfileDraft } from './PayrollDraft';
import { sanitizeDecimal } from './recordsFormat';
import { won } from './FinanceFormat';
import styles from './labRecords.module.css';

interface Props {
  name: string;
  meta: string;
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  isExisting: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PayrollProfileForm({ name, meta, draft, onChange, isExisting, dirty, saving, error, onSave, onDelete, onClose }: Props) {
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...draft, ...patch });
  const calc = calcProfileOf(draft);
  const issues = profileDraftIssues(draft);
  const wage = draft.baseAmount !== null && draft.baseAmount > 0 ? minimumWageIssue(calc) : null;
  const basis = wageBasis(calc);

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
          <VStack gap={1}>
            <Text type="label">{name}</Text>
            <SupportText>{meta}</SupportText>
          </VStack>
          <HStack gap={2} vAlign="center">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <span className={styles.onlyNarrow}>
              <Button label="목록으로" variant="ghost" onClick={onClose} isDisabled={saving} />
            </span>
          </HStack>
        </HStack>

        <div className={styles.fieldGridWide}>
          <Selector label="직종" options={JOB_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={draft.jobType} onChange={(v) => v && set({ jobType: v as ProfileDraft['jobType'] })} isDisabled={saving} />
          <SegmentedControl label="급여 방식" value={draft.payType} onChange={(v) => set({ payType: v as PayrollPayType })}>
            <SegmentedControlItem value="HOURLY" label="시급제" />
            <SegmentedControlItem value="MONTHLY" label="월급제" />
          </SegmentedControl>
          <NumField
            label={draft.payType === 'HOURLY' ? '시급 (원)' : '월급 (원)'}
            value={draft.baseAmount}
            onChange={(v) => set({ baseAmount: v })}
            max={20_000_000}
            isDisabled={saving}
            description={draft.payType === 'HOURLY' ? `2026 최저임금 ${won(MIN_WAGE_2026)} (대조 필요)` : '세전 월급 전액을 기본급으로 둡니다'}
          />
          <TextInput label="주 소정근로시간" value={draft.weeklyHours} onChange={(v) => set({ weeklyHours: sanitizeDecimal(v, 1) })} isDisabled={saving} description="소수 한 자리까지 (예: 40, 15.5)" />
        </div>

        {basis.monthlyHours > 0 && (
          <SupportText>
            월 소정근로시간 {basis.monthlyHours}시간 · 통상시급 {won(basis.hourly)}
          </SupportText>
        )}
        {wage && <ErrorBanner message={wage} />}

        <div className={styles.fieldGridWide}>
          <NumField label="공제대상가족 (본인 포함)" value={draft.dependents} onChange={(v) => set({ dependents: v })} max={11} grouped={false} isDisabled={saving} description="1~11명" />
          <NumField label="8~20세 자녀" value={draft.children} onChange={(v) => set({ children: v })} max={10} grouped={false} isDisabled={saving} description="0~10명, 가족 수에 포함됩니다" />
          <SegmentedControl label="원천징수 비율" value={String(draft.withholdingRate)} onChange={(v) => set({ withholdingRate: Number(v) as WithholdingRate })}>
            <SegmentedControlItem value="80" label="80%" />
            <SegmentedControlItem value="100" label="100%" />
            <SegmentedControlItem value="120" label="120%" />
          </SegmentedControl>
          <NumField label="비과세 식대 (원)" value={draft.mealAllowance} onChange={(v) => set({ mealAllowance: v })} max={200_000} isDisabled={saving} description={`월 ${won(MEAL_TAX_FREE_LIMIT)}까지 비과세 (대조 필요)`} />
          <LabDateInput label="입사일" value={draft.hireDate} onChange={(v) => set({ hireDate: v })} max={todayString()} />
        </div>

        <VStack gap={2}>
          {draft.jobType === 'CAREGIVER' && (
            <Switch label="선임 요양보호사 (수당 월 15만 원, 대조 필요)" value={draft.seniorCaregiver} onChange={(v) => set({ seniorCaregiver: v })} isDisabled={saving} />
          )}
          <Switch label="국민연금 가입" value={draft.npsEnrolled} onChange={(v) => set({ npsEnrolled: v })} isDisabled={saving} />
          <Switch label="건강보험·장기요양보험 가입" value={draft.healthEnrolled} onChange={(v) => set({ healthEnrolled: v })} isDisabled={saving} />
          <Switch label="고용보험 가입" value={draft.employmentEnrolled} onChange={(v) => set({ employmentEnrolled: v })} isDisabled={saving} />
          <SupportText>가입 제외 대상(60세 이상 국민연금, 소득 8만 원 미만 등)은 자동으로 가리지 않습니다. 직접 꺼 주세요.</SupportText>
        </VStack>

        {dirty && issues.length > 0 && (
          <VStack gap={1}>
            {issues.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}

        <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
          {isExisting ? <Button label="급여 기준 삭제" variant="ghost" isDisabled={saving} onClick={onDelete} /> : <span />}
          <Button label={isExisting ? '급여 기준 저장' : '급여 기준 만들기'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0 || (isExisting && !dirty)} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
