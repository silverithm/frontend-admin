'use client';

/** 어르신 목록 — 이름과 그 달 안내 상태(없음·초안·보냄). */
import { Text } from '@astryxdesign/core/Text';
import type { GuardianNotice } from '@/lib/lab/labTypes';
import { Chip } from '@/components/lab/LabUi';
import type { LabElder } from '@/components/lab/useLabElders';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  byElder: Map<number, GuardianNotice>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function GuardianNoticeList({ elders, byElder, selectedId, onSelect }: Props) {
  return (
    <nav aria-label="어르신 목록" className={styles.listScroll}>
      {elders.map((elder) => {
        const n = byElder.get(elder.id);
        return (
          <button key={elder.id} type="button" className={styles.elderButton} aria-current={elder.id === selectedId} onClick={() => onSelect(elder.id)}>
            <Text type="body" weight="medium">
              {elder.name}
            </Text>
            <span className={styles.chips}>
              <Chip tone={n ? (n.status === 'SENT' ? 'ok' : 'warn') : 'neutral'} label={n ? (n.status === 'SENT' ? '보냄' : '초안') : '없음'} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
