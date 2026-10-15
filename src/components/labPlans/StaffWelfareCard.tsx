'use client';

/** 다섯 기준 카드의 틀 — 번호·제목·배점·판정 칩과 본문. */
import type { ReactNode } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import type { Tone } from '@/components/lab/LabUi';
import styles from './StaffWelfare.module.css';

interface Props {
  no: string;
  title: string;
  points: string;
  tone: Tone;
  verdict: string;
  children: ReactNode;
}

export default function StaffWelfareCard({ no, title, points, tone, verdict, children }: Props) {
  return (
    <div className={styles.criteriaCard} data-tone={tone === 'ok' || tone === 'warn' || tone === 'danger' ? tone : 'none'}>
      <Text type="label">{no} {title}</Text>
      <div className={styles.chipLine}>
        <Chip tone={tone} label={verdict} />
        <Chip tone="neutral" label={`배점 ${points}점`} />
      </div>
      <div className={styles.lines}>{children}</div>
    </div>
  );
}
