'use client';

/** 기록 체크리스트 — 입력하는 동안 바로 갱신된다. 닫기 전에 빠진 것을 한눈에 본다. */
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import type { ChecklistItem } from '@/lib/lab/careEventRules';
import { Chip } from '@/components/lab/LabUi';
import styles from './labRecords.module.css';

interface Props {
  items: ChecklistItem[];
  /** 낙상 재평가 항목이 위험도 평가 기록을 못 읽은 채 계산됐는지 */
  riskUnknown?: boolean;
}

export default function CareEventChecklist({ items, riskUnknown }: Props) {
  const missing = items.filter((i) => !i.ok).length;
  return (
    <VStack gap={2}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)', alignItems: 'center' }}>
        <Text type="label">기록 체크리스트</Text>
        <Chip tone={missing === 0 ? 'ok' : 'warn'} label={missing === 0 ? '모두 갖춤' : `빠진 것 ${missing}`} />
      </div>
      {items.map((item) => (
        <div className={styles.checkItem} key={item.code}>
          <span className={`${styles.checkMark} ${item.ok ? styles.okText : styles.warnText}`} aria-hidden="true">
            {item.ok ? '✓' : '!'}
          </span>
          <span className={item.ok ? styles.mutedText : undefined}>
            <Text type="supporting" color="inherit">
              <span className={styles.srOnly}>{item.ok ? '갖춤: ' : '빠짐: '}</span>
              {item.message}
            </Text>
            {item.code === 'GUARDIAN_SAME_DAY' && (
              <>
                {' '}
                <Chip tone="neutral" label="대조 필요" />
              </>
            )}
          </span>
        </div>
      ))}
      {riskUnknown && (
        <Text type="supporting" color="secondary">
          위험도 평가 기록을 불러오지 못해 낙상 재평가는 “안 함”으로 보고 있습니다.
        </Text>
      )}
    </VStack>
  );
}
