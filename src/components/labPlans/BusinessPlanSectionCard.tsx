'use client';

/** 사업계획 한 분야(기관운영·서비스 제공·직원관리) 카드 — 항목 표(여섯 칸), 줄 추가·삭제·위아래, 칸 옆 점검, 분야 예산 합. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, NumField, SupportText } from '@/components/lab/LabUi';
import { num } from '@/components/labRecords/FinanceFormat';
import { ITEM_FIELDS, ITEM_LIMITS, MAX_ITEM_BUDGET, MAX_SECTION_ITEMS, sectionLabel } from '@/lib/lab/businessPlanRules';
import type { BusinessPlanIssue } from '@/lib/lab/businessPlanRules';
import type { BusinessPlanItem, BusinessSection } from '@/lib/lab/labTypes';
import { moveItem, newItem } from './BusinessPlanDraft';
import type { ItemDraft } from './BusinessPlanDraft';
import styles from './labPlans.module.css';
import s7 from './labPlans7.module.css';

interface Props {
  section: BusinessSection;
  items: ItemDraft[];
  issues: BusinessPlanIssue[];
  subtotal: number;
  disabled: boolean;
  onChange: (items: ItemDraft[]) => void;
}

const WARN = { type: 'warning' } as const;

export default function BusinessPlanSectionCard({ section, items, issues, subtotal, disabled, onChange }: Props) {
  const label = sectionLabel(section);
  const sectionIssue = issues.find((i) => i.index === null);
  const missingOf = (index: number): Set<keyof BusinessPlanItem> => new Set(issues.filter((i) => i.index === index && i.field).map((i) => i.field as keyof BusinessPlanItem));
  const patch = (key: number, p: Partial<BusinessPlanItem>) => onChange(items.map((it) => (it.key === key ? { ...it, ...p } : it)));
  const labelOf = (f: keyof BusinessPlanItem) => ITEM_FIELDS.find((x) => x.key === f)?.label ?? '';

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <div className={s7.cardHead}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">{label}</Text>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {items.length}개 · 예산 합 {num(subtotal)}원
            </Text>
            {sectionIssue ? <Chip tone="warn" label="사업 없음" /> : issues.length > 0 ? <Chip tone="warn" label={`빈 칸 ${issues.length}`} /> : <Chip tone="ok" label="모두 적음" />}
          </HStack>
          <Button label={`${label} 사업 추가`} size="sm" variant="secondary" isDisabled={disabled || items.length >= MAX_SECTION_ITEMS} onClick={() => onChange([...items, newItem()])} />
        </div>

        {items.length === 0 ? (
          <Text type="supporting" color="secondary">
            {label} 분야의 사업이 아직 없습니다. ‘{label} 사업 추가’를 누르거나 ‘AI 초안’으로 채워 보세요. 세 분야가 모두 있어야 평가에서 인정됩니다.
          </Text>
        ) : (
          <div className={styles.tableScroll}>
            <table className={s7.itemTable}>
              <thead>
                <tr>
                  <th scope="col">번호</th>
                  {ITEM_FIELDS.map((f) => (
                    <th key={f.key} scope="col">
                      {f.key === 'budget' ? '사업예산 (원)' : f.label}
                    </th>
                  ))}
                  <th scope="col">줄 관리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, index) => {
                  const missing = missingOf(index);
                  const st = (f: keyof BusinessPlanItem) => (missing.has(f) ? WARN : undefined);
                  return (
                    <tr key={it.key}>
                      <td data-label="번호">
                        <Text type="label" hasTabularNumbers>
                          {index + 1}
                        </Text>
                      </td>
                      <td className={s7.colMid} data-label="세부사업명">
                        <TextInput label={`${label} ${index + 1}번 세부사업명`} isLabelHidden placeholder="세부사업명" value={it.name} onChange={(v) => patch(it.key, { name: v.slice(0, ITEM_LIMITS.name) })} status={st('name')} isDisabled={disabled} />
                      </td>
                      <td className={s7.colWide} data-label="사업목표">
                        <TextArea label={`${label} ${index + 1}번 사업목표`} isLabelHidden placeholder="사업목표" rows={3} maxLength={ITEM_LIMITS.goal} value={it.goal} onChange={(v) => patch(it.key, { goal: v.slice(0, ITEM_LIMITS.goal) })} status={st('goal')} isDisabled={disabled} />
                      </td>
                      <td className={s7.colWide} data-label="사업내용">
                        <TextArea label={`${label} ${index + 1}번 사업내용`} isLabelHidden placeholder="사업내용" rows={3} maxLength={ITEM_LIMITS.content} value={it.content} onChange={(v) => patch(it.key, { content: v.slice(0, ITEM_LIMITS.content) })} status={st('content')} isDisabled={disabled} />
                      </td>
                      <td className={s7.colSmall} data-label="사업대상">
                        <TextInput label={`${label} ${index + 1}번 사업대상`} isLabelHidden placeholder="사업대상" value={it.target} onChange={(v) => patch(it.key, { target: v.slice(0, ITEM_LIMITS.target) })} status={st('target')} isDisabled={disabled} />
                      </td>
                      <td className={s7.colMoney} data-label="사업예산 (원)">
                        <NumField label={`${label} ${index + 1}번 사업예산`} isLabelHidden placeholder="0원도 적어 주세요" value={it.budget} onChange={(v) => patch(it.key, { budget: v })} max={MAX_ITEM_BUDGET} isDisabled={disabled} />
                        {missing.has('budget') && <p className={s7.fieldNote}>예산을 적어 주세요 (없으면 0)</p>}
                      </td>
                      <td className={s7.colMid} data-label="추진일정">
                        <TextInput label={`${label} ${index + 1}번 추진일정`} isLabelHidden placeholder="예: 3월~11월 매월" value={it.schedule} onChange={(v) => patch(it.key, { schedule: v.slice(0, ITEM_LIMITS.schedule) })} status={st('schedule')} isDisabled={disabled} />
                      </td>
                      <td className={s7.colButtons} data-label="줄 관리">
                        <div className={s7.rowButtons}>
                          <Button label="위로" size="sm" variant="ghost" isDisabled={disabled || index === 0} onClick={() => onChange(moveItem(items, index, -1))} />
                          <Button label="아래로" size="sm" variant="ghost" isDisabled={disabled || index === items.length - 1} onClick={() => onChange(moveItem(items, index, 1))} />
                          <Button label="삭제" size="sm" variant="ghost" isDisabled={disabled} onClick={() => onChange(items.filter((x) => x.key !== it.key))} />
                        </div>
                        {missing.size > 0 && <p className={s7.fieldNote}>빈 칸: {[...missing].map(labelOf).join('·')}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <SupportText>세부사업명·사업목표·사업내용·사업대상·사업예산·추진일정 여섯 칸이 모두 있어야 합니다. 비어 있어도 저장은 되고 위쪽 점검에 남습니다. 예산이 없는 사업은 0원으로 적습니다.</SupportText>
      </VStack>
    </Card>
  );
}
