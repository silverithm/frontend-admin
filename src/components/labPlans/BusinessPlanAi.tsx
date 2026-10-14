'use client';

/** 사업계획 AI 초안 — 지난해 실험실 기록의 숫자 요약만 보내고, 제안은 분야별로 골라 항목 끝에 더한다. 직원이 고친 뒤 저장한다. */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { AiChip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { num } from '@/components/labRecords/FinanceFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { SECTIONS } from '@/lib/lab/businessPlanRules';
import { aiDraftBusinessPlan } from '@/lib/lab/labApi';
import type { BusinessPlanFacts, BusinessPlanSections, BusinessSection } from '@/lib/lab/labTypes';
import { loadPlanFacts } from './BusinessPlanFacts';
import styles from './labPlans.module.css';
import s7 from './labPlans7.module.css';

interface Props {
  year: number;
  /** 현재 등록된 어르신 수(못 읽었으면 null) */
  elderCount: number | null;
  disabled: boolean;
  /** 고른 분야의 제안을 항목 끝에 더한다 */
  onApply: (section: BusinessSection, items: BusinessPlanSections[BusinessSection]) => void;
}

export default function BusinessPlanAi({ year, elderCount, disabled, onApply }: Props) {
  const alive = useAlive();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [facts, setFacts] = useState<BusinessPlanFacts | null>(null);
  const [result, setResult] = useState<BusinessPlanSections | null>(null);
  const [applied, setApplied] = useState<Set<BusinessSection>>(new Set());
  const busy = useRef(false);

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadPlanFacts(year, elderCount);
      const r = await aiDraftBusinessPlan({ year, facts: loaded.facts, ...(notes.trim() === '' ? {} : { notes: notes.trim() }) });
      if (!alive.current) return;
      setFacts(loaded.facts);
      setWarnings(loaded.warnings);
      setResult(r.sections);
      setApplied(new Set());
    } catch (err) {
      if (alive.current) setError(errorText(err, 'AI가 사업계획 초안을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">AI 초안</Text>
          <AiChip label="제안만" />
        </HStack>
        <SupportText>
          지난해({year - 1}년) 프로그램·직원 교육·사고 건수, 어르신 수, 예산 합계의 숫자 요약만 AI로 보냅니다. 이름이나 기록 내용은 보내지 않습니다. 제안은 분야별로 골라 항목 끝에 더하고, 숫자와 일정은 꼭 직접 확인해 고쳐 주세요.
        </SupportText>
        <TextArea label="참고 메모 (선택)" description="올해 꼭 넣고 싶은 방향을 적으세요. 이름·연락처는 적지 마세요." placeholder="예: 올해는 인지 프로그램을 늘리고 직원 교육을 분기마다 합니다" rows={3} maxLength={1000} value={notes} onChange={setNotes} isDisabled={disabled || loading} />
        <HStack gap={2} wrap="wrap">
          <Button label="AI 초안 받기" variant="secondary" isLoading={loading} isDisabled={disabled || loading} onClick={() => void run()} />
        </HStack>
        {error && <ErrorBanner message={error} />}
        {facts && (
          <SupportText>
            보낸 숫자: 프로그램 {num(facts.programs)}건 · 직원 교육 {num(facts.trainings)}건 · 사고·응급 {num(facts.events)}건 · 어르신 {num(facts.elders)}명
            {facts.budgetTotals ? ` · 예산 세입 ${num(facts.budgetTotals.income)}원 / 세출 ${num(facts.budgetTotals.expense)}원` : ' · 지난해 예산 없음'}
          </SupportText>
        )}
        {warnings.map((w) => (
          <SupportText key={w} tone="warn">
            {w}
          </SupportText>
        ))}
        {result && (
          <div className={styles.suggestBox}>
            <VStack gap={2}>
              {SECTIONS.map(({ value, label }) => {
                const items = result[value] ?? [];
                return (
                  <div key={value}>
                    <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
                      <Text type="label">
                        {label} 제안 {items.length}개
                      </Text>
                      <Button
                        label={applied.has(value) ? `${label} 반영함` : `${label} 반영`}
                        size="sm"
                        variant="secondary"
                        isDisabled={disabled || items.length === 0 || applied.has(value)}
                        onClick={() => {
                          onApply(value, items);
                          setApplied((cur) => new Set(cur).add(value));
                        }}
                      />
                    </HStack>
                    {items.length === 0 ? (
                      <Text type="supporting" color="secondary">
                        이 분야는 제안이 없습니다. 직접 적어 주세요.
                      </Text>
                    ) : (
                      items.map((it, i) => (
                        <div key={`${value}-${i}`} className={s7.proposalRow}>
                          <div className={s7.proposalBody}>
                            <Text type="label">{it.name || '(이름 없음)'}</Text>
                            <Text type="supporting" color="secondary">
                              {it.goal} · 대상 {it.target || '-'} · 일정 {it.schedule || '-'} · 예산 {num(it.budget ?? 0)}원
                            </Text>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
              <Text type="supporting" color="secondary">
                ‘반영’을 누르면 그 분야 항목 끝에 더해집니다(한 분야 20개까지). 이미 적은 항목은 그대로 둡니다.
              </Text>
            </VStack>
          </div>
        )}
      </VStack>
    </Card>
  );
}
