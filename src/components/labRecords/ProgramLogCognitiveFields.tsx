'use client';

/** 프로그램 일지의 시간(분)·인지활동형·제공자 유형 칸과 고시 안내 — 60분 미만이거나 제공자가 '기타'면 경고 칩을 띄운다. */
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { COGNITIVE_MIN_MINUTES, COGNITIVE_PROVIDERS } from '@/lib/lab/cognitiveProgramRules';
import type { CognitiveProviderKind } from '@/lib/lab/labTypes';
import { Chip, NumField } from '@/components/lab/LabUi';
import { MAX_DURATION, MIN_DURATION } from './ProgramLogDraft';
import type { ProgramDraft } from './ProgramLogDraft';
import styles from './labRecords.module.css';

interface Props {
  draft: ProgramDraft;
  onChange: (patch: Partial<Pick<ProgramDraft, 'minutes' | 'cognitive' | 'providerKind'>>) => void;
  isDisabled?: boolean;
}

export default function ProgramLogCognitiveFields({ draft, onChange, isDisabled }: Props) {
  const short = draft.cognitive && (draft.minutes === null || draft.minutes < COGNITIVE_MIN_MINUTES);
  const notAllowed = draft.cognitive && draft.providerKind === 'OTHER';
  return (
    <div className={styles.suggestBox}>
      <div className={styles.stackTight}>
        <div className={styles.fieldGrid}>
          <NumField
            label="진행 시간(분)"
            value={draft.minutes}
            onChange={(v) => onChange({ minutes: v })}
            max={MAX_DURATION}
            grouped={false}
            placeholder={`${MIN_DURATION}~${MAX_DURATION}`}
            isDisabled={isDisabled}
          />
          <Selector
            label={draft.cognitive ? '제공자 유형 (필수)' : '제공자 유형'}
            placeholder="고르기"
            options={COGNITIVE_PROVIDERS.map((p) => ({ value: p.key, label: p.label }))}
            value={draft.providerKind === '' ? undefined : draft.providerKind}
            onChange={(v) => onChange({ providerKind: (v ?? '') as CognitiveProviderKind | '' })}
            isDisabled={isDisabled}
          />
        </div>
        <CheckboxInput label="인지활동형 프로그램" value={draft.cognitive} onChange={(on) => onChange({ cognitive: on })} isDisabled={isDisabled} />
        <Text type="supporting" color="secondary">
          1회 60분 이상, 프로그램관리자·치매전문요양보호사·외부강사가 제공(고시 제30조⑦). 5등급·인지지원 어르신은 이 프로그램에 참여해야 그날 급여비용을 산정할 수 있습니다.
        </Text>
        {(short || notAllowed) && (
          <div className={styles.chips} style={{ justifyContent: 'flex-start' }}>
            {short && <Chip tone="warn" label={draft.minutes === null ? '시간을 적지 않으면 60분 미만으로 봅니다' : '60분 미만 — 인지활동형으로 인정되지 않습니다'} />}
            {notAllowed && <Chip tone="warn" label="제공자가 '기타'면 인정되지 않습니다" />}
          </div>
        )}
      </div>
    </div>
  );
}
