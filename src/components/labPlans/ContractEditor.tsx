'use client';

/** 계약·인정 편집기 — 계약 기간, 인정 유효기간, 감경 구분, 서명·교부·통보 날짜, 종료까지 한 양식에서 적는다. */
import { useMemo } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, NumField, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { expectedValidYears, missedDayEligible, VALIDITY_RULE } from '@/lib/lab/contractRules';
import { daysBetween } from '@/lib/lab/labDate';
import type { ContractEndReason, ContractStatus, CopayClass, LtcCareGrade } from '@/lib/lab/labTypes';
import { contractIssues, contractWarnings, MAX_CONTRACT_NOTE, MAX_RECOGNITION_NO, rightsGuideDue } from './ContractDraft';
import type { ContractDraft } from './ContractDraft';
import { COPAY_OPTIONS, END_REASON_OPTIONS, endNeedsReferral, GRADE_OPTIONS, gradeText, STATUS_OPTIONS } from './ContractFormat';
import ContractWindowBar from './ContractWindowBar';
import styles from './labPlans.module.css';

interface Props {
  draft: ContractDraft;
  onChange: (next: ContractDraft) => void;
  elders: LabElder[];
  eldersLoading: boolean;
  /** 고치는 계약의 어르신이 목록에 없을 때(퇴소 등) 보여 줄 이름 */
  fallbackElderName: string | null;
  /** 어르신 번호 → 진행 중 계약 번호 */
  activeOf: ReadonlyMap<number, number>;
  today: string;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onSaveToReferral: () => void;
  onCancel: () => void;
}

const MS_PER_YEAR_DAYS = 365.25;

export default function ContractEditor({ draft, onChange, elders, eldersLoading, fallbackElderName, activeOf, today, saving, error, onSave, onSaveToReferral, onCancel }: Props) {
  const set = (patch: Partial<ContractDraft>) => onChange({ ...draft, ...patch });
  const editing = draft.id !== null;
  const issues = contractIssues(draft, activeOf);
  const warnings = contractWarnings(draft);
  const touched = draft.elderlyId !== null && (draft.contractStart !== '' || draft.validTo !== '');
  const years = expectedValidYears(draft.careGrade, draft.renewalCount ?? 0);
  const guideDue = rightsGuideDue(draft.contractStart);

  const elderOptions = useMemo(() => {
    const list = elders.map((e) => ({ value: String(e.id), label: e.name }));
    if (draft.elderlyId !== null && !elders.some((e) => e.id === draft.elderlyId)) list.push({ value: String(draft.elderlyId), label: fallbackElderName ?? '(목록에 없는 어르신)' });
    return list;
  }, [elders, draft.elderlyId, fallbackElderName]);

  const periodDays = draft.validFrom && draft.validTo ? daysBetween(draft.validFrom, draft.validTo) : null;
  const periodGap = periodDays === null ? null : Math.abs(periodDays + 1 - years * MS_PER_YEAR_DAYS);
  const periodFar = periodGap !== null && periodGap > 190;

  const referralHint = draft.status === 'ENDED' && endNeedsReferral(draft.endReason);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '계약 고치기' : '계약 등록'}</Text>
          {editing && <Chip tone="warn" label="수정 중" />}
        </HStack>

        <div className={styles.fieldGrid}>
          <Selector
            label="어르신"
            placeholder={eldersLoading ? '어르신 목록을 불러오는 중...' : '어르신 고르기'}
            hasSearch
            searchPlaceholder="찾기"
            options={elderOptions}
            value={draft.elderlyId === null ? undefined : String(draft.elderlyId)}
            onChange={(v) => {
              if (v === null) return;
              const elder = elders.find((e) => String(e.id) === v);
              set({ elderlyId: Number(v), careGrade: draft.id === null && elder?.careGrade ? (elder.careGrade as LtcCareGrade) : draft.careGrade });
            }}
            isDisabled={saving || editing}
          />
          <LabDateInput label="계약 시작일" value={draft.contractStart} onChange={(v) => set({ contractStart: v })} />
          <LabDateInput label="계약 종료일 (선택)" value={draft.contractEnd} onChange={(v) => set({ contractEnd: v })} />
        </div>

        <div className={styles.fieldGrid}>
          <Selector placeholder="고르기" label="장기요양 등급" options={GRADE_OPTIONS} value={draft.careGrade} onChange={(v) => v && set({ careGrade: v as LtcCareGrade })} isDisabled={saving} />
          <TextInput label="장기요양인정번호 (선택)" value={draft.recognitionNo} onChange={(v) => set({ recognitionNo: v.slice(0, MAX_RECOGNITION_NO) })} isDisabled={saving} />
          <Selector placeholder="고르기" label="본인부담 감경 구분" options={COPAY_OPTIONS} value={draft.copayClass} onChange={(v) => v && set({ copayClass: v as CopayClass })} isDisabled={saving} />
        </div>

        <VStack gap={2}>
          <div className={styles.fieldGrid}>
            <LabDateInput label="인정 유효기간 시작" value={draft.validFrom} onChange={(v) => set({ validFrom: v })} />
            <LabDateInput label="인정 유효기간 끝" value={draft.validTo} onChange={(v) => set({ validTo: v })} />
            <NumField label="갱신 횟수 (처음 인정이면 0)" value={draft.renewalCount} onChange={(v) => set({ renewalCount: v })} max={99} grouped={false} isDisabled={saving} />
          </div>
          <SupportText>
            예상 유효기간 {years}년 — 최초 인정 {VALIDITY_RULE.initialYears}년, 갱신하면 1등급 {VALIDITY_RULE.renewalYears['1']}년·2~4등급 {VALIDITY_RULE.renewalYears['2']}년·5등급과 인지지원등급 {VALIDITY_RULE.renewalYears['5']}년.
            등급판정위원회가 앞뒤 {VALIDITY_RULE.adjustMonths}개월 안에서 늘리거나 줄일 수 있으니 실제 기간은 장기요양인정서로 확인하세요 ({gradeText(draft.careGrade)} 기준).
          </SupportText>
          {periodFar && <SupportText tone="warn">입력한 기간({dotDate(draft.validFrom)} ~ {dotDate(draft.validTo)})이 예상 {years}년과 6개월 넘게 다릅니다. 인정서의 유효기간과 등급·갱신 횟수를 다시 확인해 주세요.</SupportText>}
          {draft.validTo !== '' && <ContractWindowBar validTo={draft.validTo} today={today} />}
        </VStack>

        <VStack gap={1}>
          <NumField label="월 이용 계약 일수 (선택)" value={draft.plannedDays} onChange={(v) => set({ plannedDays: v })} max={31} grouped={false} isDisabled={saving} placeholder="예: 20" />
          {missedDayEligible({ plannedDaysPerMonth: draft.plannedDays }) ? (
            <SupportText>월 15일 이상 이용하기로 계약하면 못 온 날도 급여비용(미이용일)을 청구할 수 있습니다(고시 제32조). 급여 개시 전월 말일까지 계약통보를 했는지 등 요건은 공단 고시 원문과 대조가 필요합니다.</SupportText>
          ) : (
            <SupportText>월 15일 이상으로 계약하면 미이용일 급여비용 대상이 됩니다.</SupportText>
          )}
        </VStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label="계약서 서명일 (선택)" value={draft.signedOn} onChange={(v) => set({ signedOn: v })} />
          <LabDateInput label="공단 계약통보일 (선택)" value={draft.contractNotifiedOn} onChange={(v) => set({ contractNotifiedOn: v })} />
          <VStack gap={1}>
            <Text type="label">계약서 1부 수급자 교부</Text>
            <Switch label="1부를 수급자에게 드렸습니다" value={draft.copyGiven} onChange={(v) => set({ copyGiven: v })} isDisabled={saving} />
          </VStack>
        </div>
        <SupportText>계약서는 급여를 시작하기 전에 2부를 써서 1부를 수급자에게 지체 없이 드립니다. 공단 계약통보도 “지체 없이”이며 며칠이라는 숫자는 법령에 없습니다.</SupportText>

        <div className={styles.fieldGrid}>
          <VStack gap={1}>
            <LabDateInput label="급여제공계획 최초 통보일 (선택)" value={draft.planNotifiedOn} onChange={(v) => set({ planNotifiedOn: v })} />
            <SupportText>급여제공 시작일까지 공단에 통보해야 합니다(2026 평가 22). 계획을 바꿔 다시 통보한 날은 이 칸이 아니라 급여계획 기록에 남겨 주세요. 이 칸은 처음 통보한 날로 둡니다.</SupportText>
          </VStack>
          <VStack gap={1}>
            <LabDateInput label="노인인권 지침 안내일 (선택)" value={draft.rightsGuidedOn} onChange={(v) => set({ rightsGuidedOn: v })} />
            <SupportText>{guideDue ? `신규 수급자에게는 시작일부터 14일 안(${dotDate(guideDue)}까지, 토요일·공휴일 포함) 안내합니다(2026 평가 19).` : '신규 수급자에게는 급여제공 시작일부터 14일 안에 안내합니다(2026 평가 19).'}</SupportText>
          </VStack>
        </div>

        <div className={styles.fieldGrid}>
          <Selector placeholder="고르기" label="계약 상태" options={STATUS_OPTIONS as unknown as Array<{ value: string; label: string }>} value={draft.status} onChange={(v) => v && set({ status: v as ContractStatus })} isDisabled={saving} />
          {draft.status === 'ENDED' && (
            <Selector
              placeholder="고르기"
              label="종료 사유"
              options={END_REASON_OPTIONS as unknown as Array<{ value: string; label: string }>}
              value={draft.endReason === '' ? undefined : draft.endReason}
              onChange={(v) => set({ endReason: (v ?? '') as ContractEndReason | '' })}
              isDisabled={saving}
            />
          )}
        </div>
        {draft.status === 'ENDED' && <SupportText>종료한 계약은 위의 “계약 종료일”도 꼭 골라 주세요.</SupportText>}

        {draft.status === 'ENDED' && draft.endReason === 'DEATH' && <SupportText>사망으로 끝난 계약은 퇴소 연계기록지를 쓰지 않습니다.</SupportText>}
        {draft.status === 'ENDED' && draft.endReason === 'HOSPITAL' && (
          <SupportText>퇴소 없이 입원만 한 경우는 연계기록지를 쓰지 않습니다. 입원한 뒤 계약을 해지하고 퇴소했다면 “퇴소 연계기록지” 보기에서 사유를 “입원 후 퇴소”로 골라 직접 쓰세요.</SupportText>
        )}
        {referralHint && (
          <div className={styles.suggestBox}>
            <VStack gap={2}>
              <Text type="label">퇴소 연계기록지를 써야 합니다</Text>
              <SupportText>계약 종료일까지 수급자(보호자)에게 연계기록지를 써서 드려야 합니다(2026 평가 30 기준②). 저장한 뒤 바로 이어서 쓸 수 있습니다.</SupportText>
              <HStack gap={2} wrap="wrap">
                <Button label="저장하고 퇴소 연계기록지 쓰기" variant="secondary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={onSaveToReferral} />
              </HStack>
            </VStack>
          </div>
        )}

        <TextArea label="메모 (선택)" value={draft.note} onChange={(v) => set({ note: v.slice(0, MAX_CONTRACT_NOTE) })} rows={3} maxLength={MAX_CONTRACT_NOTE} isDisabled={saving} />

        {touched && issues.length > 0 && (
          <VStack gap={1}>
            {issues.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {warnings.length > 0 && (
          <VStack gap={1}>
            {warnings.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          {(editing || touched) && <Button label={editing ? '고치기 취소' : '비우기'} variant="ghost" isDisabled={saving} onClick={onCancel} />}
          <Button label={editing ? '고친 내용 저장' : '계약 저장'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
