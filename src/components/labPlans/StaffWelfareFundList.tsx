'use client';

/** 가산금 받음·사용 목록 — 최근 날짜 순. */
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import type { BonusFund } from '@/lib/lab/labTypes';
import { wonText } from './StaffWelfareFormat';
import styles from './StaffWelfare.module.css';
import plans from './labPlans.module.css';

interface Props {
  year: number;
  all: BonusFund[];
  loading: boolean;
  error: string | null;
  activeId: number | null;
  isDisabled: boolean;
  onRetry: () => void;
  onOpen: (f: BonusFund) => void;
}

export default function StaffWelfareFundList({ year, all, loading, error, activeId, isDisabled, onRetry, onOpen }: Props) {
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (loading && all.length === 0) return <Loading size="section" label="가산금 기록을 불러오는 중..." />;
  const rows = all.filter((f) => f.occurredOn.startsWith(`${year}-`)).sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
  if (rows.length === 0) return <Text type="supporting" color="secondary">{year}년에 적은 가산금 기록이 없습니다. 가산금을 받지 않았다면 비워 두어도 충족으로 칩니다.</Text>;
  return (
    <div className={plans.tableScroll}>
      <table className={plans.table}>
        <thead>
          <tr>
            <th>날짜</th>
            <th>구분</th>
            <th className={plans.num}>금액</th>
            <th>대상 직원</th>
            <th>용도</th>
            <th>증빙</th>
            <th>고치기</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <td>{dotDate(f.occurredOn)}</td>
              <td>
                <Chip tone={f.kind === 'RECEIVED' ? 'info' : 'neutral'} label={f.kind === 'RECEIVED' ? '받음' : '사용'} />
                {f.ownerUse && <Chip tone="warn" label="대표자·시설장 몫" />}
              </td>
              <td className={plans.num}>{wonText(f.amount)}</td>
              <td>{f.kind === 'SPENT' ? (f.memberName ?? '여러 직원') : '-'}</td>
              <td className={styles.reasonCell}>{f.purpose}</td>
              <td>{f.evidenceLedgerId !== null ? <Chip tone="ok" label="장부 기록 연결" /> : <Chip tone="warn" label="증빙 연결 없음" />}</td>
              <td><Button label={activeId === f.id ? '고치는 중' : '고치기'} variant="secondary" size="sm" isDisabled={isDisabled || activeId === f.id} onClick={() => onOpen(f)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
