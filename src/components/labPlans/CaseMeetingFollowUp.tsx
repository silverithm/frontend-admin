'use client';

/** 대상 한 명의 반영(반영일·방식·내용)과 평가(평가일·작성자·해결 여부·추가 조치) — 기한 칩은 targetFollowUp 판정이다. */
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Chip, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { targetFollowUp } from '@/lib/lab/caseMeetingRules';
import type { CaseReflectMethod } from '@/lib/lab/labTypes';
import { MAX_NAME, MAX_NOTE, REFLECT_METHODS, followTargetOf } from './CaseMeetingDraft';
import type { TargetDraft } from './CaseMeetingDraft';
import { followChips } from './CaseMeetingFollow';
import styles from './labPlans10.module.css';

interface Props {
  target: TargetDraft;
  heldOn: string;
  today: string;
  defaultEvaluator: string;
  isDisabled: boolean;
  onChange: (patch: Partial<TargetDraft>) => void;
}

const RESOLVED_OPTIONS = [
  { value: 'YES', label: '해결됨' },
  { value: 'NO', label: '해결되지 않음' },
];

export default function CaseMeetingFollowUp({ target, heldOn, today, defaultEvaluator, isDisabled, onChange }: Props) {
  const chips = followChips(targetFollowUp(heldOn, followTargetOf(target), today));
  const reflected = target.reflectedOn !== '';
  return (
    <div className={styles.followBox}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text type="label">반영과 평가</Text>
        <span className={styles.chipLine}>
          {chips.map((c) => (
            <Chip key={c.label} tone={c.tone} label={c.label} />
          ))}
        </span>
      </HStack>
      <SupportText>회의 다음날부터 30일 안에 급여 등에 반영하고, 반영일부터 30일 안에 평가합니다. 회의 뒤에 이 칸을 채워 저장해 주세요.</SupportText>
      <VStack gap={3}>
        <div className={styles.attendeeGrid}>
          <LabDateInput label="반영일 (선택)" value={target.reflectedOn} max={today} onChange={(v) => onChange({ reflectedOn: v })} />
          <Selector
            label={reflected ? '반영 방식' : '반영 방식 (선택)'}
            placeholder="방식 고르기"
            options={REFLECT_METHODS as unknown as Array<{ value: string; label: string }>}
            value={target.reflectMethod === '' ? undefined : target.reflectMethod}
            onChange={(v) => onChange({ reflectMethod: (v ?? '') as CaseReflectMethod | '' })}
            isDisabled={isDisabled}
          />
        </div>
        <TextArea label="반영 내용 (선택)" placeholder="예: 급여제공계획의 이동 보조 항목을 주 3회로 변경함" value={target.reflectNote} onChange={(v) => onChange({ reflectNote: v.slice(0, MAX_NOTE) })} rows={2} maxLength={MAX_NOTE} isDisabled={isDisabled} />
        {target.reflectMethod === 'RESOURCE' && <SupportText tone="warn">지역사회자원 연계는 신청만으로는 부족하고 선정 결과가 있어야 인정됩니다. 선정 결과와 증빙(협약서·회의자료·사진 등)을 내용에 적어 두세요.</SupportText>}
        <div className={styles.attendeeGrid}>
          <LabDateInput label="평가일 (선택)" value={target.evaluatedOn} max={today} onChange={(v) => onChange(v !== '' && target.evaluatorName.trim() === '' ? { evaluatedOn: v, evaluatorName: defaultEvaluator } : { evaluatedOn: v })} />
          <TextInput label="평가 작성자" placeholder="평가를 쓴 직원" value={target.evaluatorName} onChange={(v) => onChange({ evaluatorName: v.slice(0, MAX_NAME) })} isDisabled={isDisabled} />
          <Selector
            label="선정 사유 해결 여부"
            placeholder="해결 여부 고르기"
            options={RESOLVED_OPTIONS}
            value={target.resolved === '' ? undefined : target.resolved}
            onChange={(v) => onChange({ resolved: (v ?? '') as 'YES' | 'NO' | '' })}
            isDisabled={isDisabled}
          />
        </div>
        {target.resolved === 'NO' && (
          <TextArea label="추가 조치 계획" placeholder="해결되지 않은 부분을 어떻게 이어서 할지" value={target.nextAction} onChange={(v) => onChange({ nextAction: v.slice(0, MAX_NOTE) })} rows={2} maxLength={MAX_NOTE} isDisabled={isDisabled} />
        )}
      </VStack>
    </div>
  );
}
