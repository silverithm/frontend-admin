'use client';

/** 직원별 퇴직금 추계 표 — 대상 여부, 근속일, 평균임금·통상임금·적용 1일 임금(원), 추계액. 줄을 누르면 아래에서 계산 상세를 본다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { num } from '@/components/labRecords/FinanceFormat';
import { shortReason } from './SeveranceFormat';
import type { SeveranceRow } from './SeveranceFormat';
import styles from './labPlans.module.css';
import s7 from './labPlans7.module.css';

interface Props {
  rows: SeveranceRow[];
  total: number;
  asOf: string;
  activeId: number | null;
  onPick: (memberId: number) => void;
}

export default function SeveranceTable({ rows, total, asOf, activeId, onPick }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">
          직원별 추계 ({dotDate(asOf)} 퇴직 가정, {rows.length}명)
        </Text>
        {rows.length === 0 ? (
          <Text type="supporting" color="secondary">
            직원 급여 기준이 없습니다. 먼저 ‘급여대장’에서 직원별 급여 기준(입사일·주 소정근로시간·급여)을 등록해 주세요.
          </Text>
        ) : (
          <div className={styles.tableScroll}>
            <table className={s7.sevTable}>
              <thead>
                <tr>
                  <th scope="col">직원</th>
                  <th scope="col">입사일</th>
                  <th scope="col">대상 여부</th>
                  <th scope="col" className={s7.num}>근속일</th>
                  <th scope="col" className={s7.num}>평균임금(1일)</th>
                  <th scope="col" className={s7.num}>통상임금(1일)</th>
                  <th scope="col" className={s7.num}>적용 1일 임금</th>
                  <th scope="col" className={s7.num}>추계액</th>
                  <th scope="col">상세</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = r.estimate;
                  return (
                    <tr key={r.profile.memberId} data-active={r.profile.memberId === activeId} data-dim={!e.eligible}>
                      <td>{r.name}</td>
                      <td>{dotDate(r.profile.hireDate)}</td>
                      <td>{e.eligible ? <Chip tone="ok" label="대상" /> : <Chip tone="neutral" label={`대상 아님${shortReason(e, r.profile.weeklyHours) ? ` · ${shortReason(e, r.profile.weeklyHours)}` : ''}`} />}</td>
                      <td className={s7.num}>{num(e.serviceDays)}일</td>
                      <td className={s7.num}>{e.avgDailyWage > 0 ? `${num(e.avgDailyWage)}원` : '-'}</td>
                      <td className={s7.num}>{num(e.ordinaryDailyWage)}원</td>
                      <td className={s7.num}>{num(e.dailyWageUsed)}원</td>
                      <td className={s7.num}>{e.eligible ? `${num(e.amount)}원` : '0원'}</td>
                      <td>
                        <Button label={`${r.name} 계산 상세`} size="sm" variant="ghost" onClick={() => onPick(r.profile.memberId)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={7}>
                    기관 추계 합계
                  </th>
                  <th scope="row" className={s7.num}>
                    {num(total)}원
                  </th>
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <SupportText>직전 3개월 급여대장(확정 전 줄 포함)의 지급 총액으로 평균임금을 구합니다. 급여대장이 없는 달은 빼고 계산하니, 평균임금이 ‘-’이면 통상임금으로 계산한 것입니다. 상여금·연차수당은 직원을 골라 상세에서 넣습니다.</SupportText>
      </VStack>
    </Card>
  );
}
