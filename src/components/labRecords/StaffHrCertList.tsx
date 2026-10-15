'use client';

/** 이수·검진 기록 목록(최근 날짜 먼저) — 줄마다 고치기 단추. 삭제는 고치기 화면에서 한다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import type { StaffCert, StaffCertKind } from '@/lib/lab/labTypes';
import { dotDate } from '@/components/lab/labFormat';
import { certTitle } from './StaffHrDraft';
import styles from './StaffHr.module.css';

interface Props {
  kind: StaffCertKind;
  certs: StaffCert[];
  /** 보수교육 목록은 고른 연도만 */
  year?: number;
  onEdit: (cert: StaffCert) => void;
  onAdd: () => void;
}

function detail(c: StaffCert): string {
  const parts: string[] = [];
  if (c.kind === 'CONTINUING_EDU' && c.hours !== null) parts.push(`${c.hours}시간`);
  if (c.institution) parts.push(c.institution);
  if (c.certNo) parts.push(`이수증 ${c.certNo}`);
  return parts.join(' · ');
}

export default function StaffHrCertList({ kind, certs, year, onEdit, onAdd }: Props) {
  const rows = certs
    .filter((c) => c.kind === kind && (year === undefined || c.doneOn.startsWith(`${year}-`)))
    .sort((a, b) => (a.doneOn < b.doneOn ? 1 : a.doneOn > b.doneOn ? -1 : b.id - a.id));
  const title = certTitle(kind);
  if (rows.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState
          isCompact
          title={year === undefined ? `${title} 기록이 없습니다` : `${year}년 ${title} 기록이 없습니다`}
          description={kind === 'HEALTH_CHECK' ? '건강검진 결과통보서를 받으면 검진일을 남겨 두세요. 다음 기한이 자동으로 계산됩니다.' : '보수교육 이수증을 받으면 이수일과 시간을 남겨 두세요.'}
          actions={<Button label={`${title} 기록 추가`} variant="secondary" onClick={onAdd} />}
        />
      </Card>
    );
  }
  return (
    <Card padding={0}>
      {rows.map((c) => (
        <div className={styles.certRow} key={c.id}>
          <div className={styles.certText}>
            <Text type="label">
              {dotDate(c.doneOn.slice(0, 10))} · {c.memberName ?? `직원 ${c.memberId}`}
            </Text>
            {detail(c) !== '' && (
              <Text type="supporting" color="secondary">
                {detail(c)}
              </Text>
            )}
          </div>
          <div className={styles.certActions}>
            <Button label="고치기" variant="ghost" onClick={() => onEdit(c)} />
          </div>
        </div>
      ))}
    </Card>
  );
}
