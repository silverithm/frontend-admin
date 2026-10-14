'use client';

/** 점검 결과 — 직종별 배치 기준·근무인원(감액용)·결원·감산점수 표, 감산 위험 카드, 가산 안내, 1인당 입소자 수. */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { staffGroupLabel } from '@/lib/lab/staffingRules';
import type { StaffingCheck } from '@/lib/lab/staffingRules';
import styles from './labPlans.module.css';
import eight from './labPlans8.module.css';

interface Props {
  check: StaffingCheck;
  users: number;
  /** 지난달 위반 여부: true·false, 기록이 없거나 못 읽으면 null */
  previousViolated: boolean | null;
  previousFailed: boolean;
  hasStaff: boolean;
}

export const fmt1 = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function StaffingResult({ check, users, previousViolated, previousFailed, hasStaff }: Props) {
  const tone = check.violated ? 'danger' : 'ok';
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">인력배치 점검 결과</Text>
          <Chip tone={users === 0 ? 'neutral' : check.violated ? 'danger' : 'ok'} label={users === 0 ? '입소자 수 필요' : check.violated ? '결원 있음' : '기준 충족'} />
        </HStack>
        {users === 0 ? (
          <Text type="supporting" color="secondary">
            입소자 수가 0명이면 점검하지 않습니다. 위에서 급여제공일수와 입소자 합을 채워 주세요.
          </Text>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>직종</th>
                    <th className={styles.num}>배치 기준(명)</th>
                    <th className={styles.num}>근무인원(감액용)</th>
                    <th className={styles.num}>결원(명)</th>
                    <th className={styles.num}>감산점수</th>
                  </tr>
                </thead>
                <tbody>
                  {check.rows.filter((r) => r.required > 0 || r.fte > 0).map((r) => (
                    <tr key={r.group} data-tone={r.penalized && r.shortfall > 0 ? 'danger' : undefined}>
                      <td>{staffGroupLabel(r.group)}</td>
                      <td className={styles.num}>{r.required}</td>
                      <td className={styles.num}>{fmt1(r.fte)}</td>
                      <td className={styles.num}>{r.shortfall > 0 ? fmt1(r.shortfall) : '-'}</td>
                      <td className={styles.num}>{r.penalized ? fmt1(r.penaltyScore) : '감산 대상 아님'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!hasStaff && <SupportText tone="warn">직원 근무시간이 비어 있어 모든 직종이 결원으로 나옵니다. 직원을 채운 뒤 보세요.</SupportText>}

            <div className={eight.riskBox} data-tone={tone}>
              <Text type="label">감산 위험</Text>
              <div className={eight.statRow}>
                <span className={styles.statBox}>
                  <Text type="supporting" color="secondary">감산점수 합</Text>
                  <span className={eight.bigNumber}>{fmt1(check.penaltyScoreSum)}점</span>
                </span>
                <span className={styles.statBox}>
                  <Text type="supporting" color="secondary">감산유형점수</Text>
                  <span className={eight.bigNumber}>{fmt1(check.typeScore)}</span>
                </span>
                <span className={styles.statBox}>
                  <Text type="supporting" color="secondary">연속 위반 배수</Text>
                  <span className={eight.bigNumber}>× {fmt1(check.multiplier)}</span>
                </span>
                <span className={styles.statBox}>
                  <Text type="supporting" color="secondary">감산율</Text>
                  <span className={eight.bigNumber}>{fmt1(check.penaltyRate)}%</span>
                </span>
              </div>
              <Text type="body">
                {check.penaltyRate > 0 ? `급여비용의 약 ${fmt1(check.penaltyRate)}%가 감액될 수 있습니다.` : '지금 입력으로는 감액 대상이 아닙니다.'}
              </Text>
              <SupportText>
                감산율 = 감산점수 합({fmt1(check.adjustedScoreSum)}) × 감산유형점수 ÷ 입소자 {users}명 × 100. 배수는 지난달도 위반이면 곱합니다 —{' '}
                {previousFailed ? '지난달 기록을 읽지 못해 연속 위반은 반영하지 못했습니다.' : previousViolated === null ? '지난달 기록이 없어 연속 위반은 없는 것으로 봤습니다.' : previousViolated ? '지난달 기록이 위반이라 배수를 곱했습니다.' : '지난달 기록은 위반이 아닙니다.'}
              </SupportText>
            </div>

            <VStack gap={1}>
              <Text type="label">가산 안내</Text>
              {check.bonusHints.length === 0 ? (
                <SupportText>인력 추가배치 가산 요건에 해당하는 항목이 없습니다. 기준을 모두 채우고 요양보호사 1인당 입소자가 6.4명 미만이거나 간호(조무)사·치료사 1인당이 19.0명 미만이어야 가산을 봅니다.</SupportText>
              ) : (
                check.bonusHints.map((h) => <Text key={h} type="supporting">{h}</Text>)
              )}
            </VStack>
            <HStack gap={4} wrap="wrap">
              <Text type="supporting" color="secondary" hasTabularNumbers>
                요양보호사 1인당 입소자: {check.caregiverPerHead === null ? '-' : `${check.caregiverPerHead}명`}
              </Text>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                간호(조무)사·치료사 1인당 입소자: {check.nursePerHead === null ? '-' : `${check.nursePerHead}명`}
              </Text>
            </HStack>
          </>
        )}
      </VStack>
    </Card>
  );
}
