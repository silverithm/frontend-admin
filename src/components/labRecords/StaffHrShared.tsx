'use client';

/** 직원 인사 세 보기가 함께 쓰는 조각 — 안내 접기, 요약 칸, 기준 없는 직원 안내. */
import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import type { StaffCert } from '@/lib/lab/labTypes';
import type { HrPerson } from './StaffHrDraft';
import styles from './StaffHr.module.css';

export interface HrViewProps {
  people: HrPerson[];
  certs: StaffCert[];
  today: string;
  onEditProfile: (memberId: number) => void;
  onAddCert: (memberId: number | null) => void;
  onEditCert: (cert: StaffCert) => void;
}

export function HrGuide({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className={styles.guide}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function SummaryItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.summaryItem}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <Text type="large" weight="semibold" hasTabularNumbers>
        {value}
      </Text>
      {hint && (
        <Text type="supporting" color="secondary">
          {hint}
        </Text>
      )}
    </div>
  );
}

/** 인사 기준이 없는 직원 — 이름마다 "기준 등록" 단추 */
export function PendingPeople({ people, onRegister }: { people: HrPerson[]; onRegister: (memberId: number) => void }) {
  const pending = people.filter((p) => p.profile === null);
  if (pending.length === 0) return null;
  return (
    <div className={styles.noteBox}>
      <Text type="supporting">인사 기준이 없는 직원 {pending.length}명은 아래 계산에 들어가지 않습니다. 이름을 눌러 기준을 등록해 주세요.</Text>
      <div className={styles.pendingList}>
        {pending.map((p) => (
          <Button key={p.memberId} label={`${p.name} 기준 등록`} variant="secondary" size="sm" onClick={() => onRegister(p.memberId)} />
        ))}
      </div>
    </div>
  );
}
