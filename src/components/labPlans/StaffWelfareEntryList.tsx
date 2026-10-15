'use client';

/** 복지 제공대장 목록 — 분기별로 묶고, 건마다 인정·불인정 칩과 이유를 보여 준다. 넓은 표는 상자 안에서만 가로로 움직인다. */
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { quarterOf, welfareEntryOk, welfareQuarters } from '@/lib/lab/welfareRules';
import type { StaffWelfare } from '@/lib/lab/labTypes';
import { kindInfo, quarterName, welfareReasons, wonText } from './StaffWelfareFormat';
import styles from './StaffWelfare.module.css';
import plans from './labPlans.module.css';

interface Props {
  year: number;
  all: StaffWelfare[];
  today: string;
  loading: boolean;
  error: string | null;
  activeId: number | null;
  isDisabled: boolean;
  onRetry: () => void;
  onOpen: (e: StaffWelfare) => void;
}

export default function StaffWelfareEntryList({ year, all, today, loading, error, activeId, isDisabled, onRetry, onOpen }: Props) {
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (loading && all.length === 0) return <Loading size="section" label="복지 제공대장을 불러오는 중..." />;
  const mine = all.filter((e) => e.givenOn.startsWith(`${year}-`));
  if (mine.length === 0) return <Text type="supporting" color="secondary">{year}년에 적은 복지 제공 기록이 없습니다. 위 입력 칸에서 첫 기록을 남겨 보세요.</Text>;
  const states = new Map(welfareQuarters(all, '2026-Q1', today).quarters.map((q) => [q.quarter, q]));
  const groups = new Map<string, StaffWelfare[]>();
  for (const e of [...mine].sort((a, b) => (a.givenOn < b.givenOn ? 1 : -1))) {
    const q = quarterOf(e.givenOn) ?? '';
    groups.set(q, [...(groups.get(q) ?? []), e]);
  }
  return (
    <div className={plans.stackTight}>
      {[...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([q, rows]) => {
        const st = states.get(q);
        return (
          <div key={q} className={plans.stackTight}>
            <div className={styles.quarterTitle}>
              <Text type="label">{quarterName(q)}</Text>
              <Chip tone="neutral" label={`기록 ${rows.length}건`} />
              {st && <Chip tone={st.state === 'MET' ? 'ok' : st.state === 'NOT_MET' ? 'danger' : 'warn'} label={st.state === 'MET' ? `충족 (인정 ${st.ok}건)` : st.state === 'NOT_MET' ? '미충족' : '진행 중 (인정 0건)'} />}
            </div>
            <div className={plans.tableScroll}>
              <table className={plans.table}>
                <thead>
                  <tr>
                    <th>제공일</th>
                    <th>직원</th>
                    <th>종류</th>
                    <th>내용</th>
                    <th className={plans.num}>금액</th>
                    <th>판정</th>
                    <th>이유</th>
                    <th>고치기</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const ok = welfareEntryOk(e);
                    const reasons = welfareReasons(e);
                    const info = kindInfo(e.kind);
                    return (
                      <tr key={e.id} data-tone={ok ? undefined : 'warn'}>
                        <td>{dotDate(e.givenOn)}</td>
                        <td>{e.memberName}{e.recipientIsOwner ? ' (대표자)' : ''}</td>
                        <td>{info?.label ?? e.kind}</td>
                        <td className={plans.wrap}>{e.item}</td>
                        <td className={plans.num}>{wonText(e.amount)}</td>
                        <td>
                          <Chip tone={ok ? 'ok' : 'danger'} label={ok ? '인정' : '불인정'} />
                          {info?.check && <Chip tone="info" label="대조 필요" />}
                        </td>
                        <td className={styles.reasonCell}>{ok ? (e.signed ? '서명·증빙 있음' : '') : reasons.join(' · ')}</td>
                        <td><Button label={activeId === e.id ? '고치는 중' : '고치기'} variant="secondary" size="sm" isDisabled={isDisabled || activeId === e.id} onClick={() => onOpen(e)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
