'use client';

/** 한 사람 퇴직금 계산 상세 — 퇴직일·연간 상여를 넣으면 계산식을 한 줄씩 보여 준다(평균임금, 통상임금, 큰 값, 퇴직금). */
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, LabDateInput, NumField, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { num } from '@/components/labRecords/FinanceFormat';
import { daysInMonth } from '@/lib/lab/labDate';
import type { PayrollLine } from '@/lib/lab/labTypes';
import { hourlyWageOf } from '@/lib/lab/payrollRules';
import { MIN_SERVICE_DAYS, MIN_WEEKLY_HOURS, averageWageMonths, severanceEstimate } from '@/lib/lab/severanceRules';
import { serviceText, wonText } from './SeveranceFormat';
import type { SeveranceRow } from './SeveranceFormat';
import styles from './labPlans.module.css';
import s7 from './labPlans7.module.css';

const MAX_BONUS = 1_000_000_000;

interface Props {
  rows: SeveranceRow[];
  activeId: number | null;
  onPick: (memberId: number | null) => void;
  lines: PayrollLine[];
  retireDate: string;
  onRetireDate: (v: string) => void;
  bonus: number | null;
  onBonus: (v: number | null) => void;
  loading: boolean;
}

export default function SeveranceDetail({ rows, activeId, onPick, lines, retireDate, onRetireDate, bonus, onBonus, loading }: Props) {
  const row = rows.find((r) => r.profile.memberId === activeId) ?? null;
  const options = rows.map((r) => ({ value: String(r.profile.memberId), label: r.name }));

  let body: React.ReactNode = <Text type="supporting" color="secondary">위 표에서 직원을 고르거나 여기서 한 사람을 골라 계산식을 확인하세요.</Text>;
  if (row) {
    const p = row.profile;
    const mine = lines.filter((l) => l.memberId === p.memberId);
    const e = severanceEstimate(p, mine, retireDate, bonus ?? 0);
    const months = averageWageMonths(retireDate);
    const byMonth = new Map(mine.map((l) => [l.payMonth, Math.max(0, Math.floor(l.grossPay))]));
    const present = months.filter((m) => byMonth.has(m));
    const wageSum = present.reduce((s, m) => s + (byMonth.get(m) ?? 0), 0);
    const dayCount = present.reduce((s, m) => s + daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7))), 0);
    const bonusAdd = Math.floor(((bonus ?? 0) * present.length) / 12);
    const hourly = hourlyWageOf(p);
    body = (
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{row.name}</Text>
          {e.eligible ? <Chip tone="ok" label="퇴직금 대상" /> : <Chip tone="neutral" label="대상 아님" />}
        </HStack>
        <div className={s7.formula}>
          <Text type="supporting">
            ① 근속: 입사 {dotDate(p.hireDate)} → 퇴직 {dotDate(retireDate)} = {serviceText(e.serviceDays)} (퇴직일은 일수에 넣지 않음). 대상 조건: 계속근로 {MIN_SERVICE_DAYS}일 이상 {e.serviceDays >= MIN_SERVICE_DAYS ? '충족' : '미충족'}, 주 {MIN_WEEKLY_HOURS}시간 이상(주 {p.weeklyHours}시간) {p.weeklyHours >= MIN_WEEKLY_HOURS ? '충족' : '미충족'}
          </Text>
          <Text type="supporting">② 평균임금을 구할 직전 3개월: {months.length === 0 ? '퇴직일을 골라 주세요' : months.map((m) => `${m.slice(0, 4)}.${m.slice(5)}`).join(' · ')}</Text>
          {months.map((m) => (
            <Text key={m} type="supporting" color="secondary">
              {'　'}
              {m.slice(0, 4)}.{m.slice(5)}: {byMonth.has(m) ? `지급 총액 ${wonText(byMonth.get(m) ?? 0)} (${daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)))}일)` : '급여대장 없음 — 제외'}
            </Text>
          ))}
          <Text type="supporting">
            ③ 평균임금 = (3개월 임금 합 {wonText(wageSum)} + 상여·연차수당 {wonText(bonus ?? 0)} × {present.length}/12 = {wonText(bonusAdd)}) ÷ 일수 합 {num(dayCount)}일 = <b>{wonText(e.avgDailyWage)}</b> (1일, 원 미만 절사)
          </Text>
          <Text type="supporting">
            ④ 통상임금 = 통상시급 {wonText(hourly)} × 하루 소정시간 {Math.round((p.weeklyHours / 5) * 100) / 100}시간(주 {p.weeklyHours}시간 ÷ 5) = <b>{wonText(e.ordinaryDailyWage)}</b> (1일)
          </Text>
          <Text type="supporting">
            ⑤ 적용 1일 임금 = 평균임금과 통상임금 중 큰 값 = <b>{wonText(e.dailyWageUsed)}</b> (평균임금이 통상임금보다 적으면 통상임금)
          </Text>
          <Text type="supporting">
            ⑥ 퇴직금 = {wonText(e.dailyWageUsed)} × 30일 × 근속 {num(e.serviceDays)}일 ÷ 365 = <b>{e.eligible ? wonText(e.amount) : '0원 (대상 아님)'}</b>
          </Text>
        </div>
        {e.reason && <SupportText tone="warn">{e.reason}</SupportText>}
        <SupportText>이 값은 추계입니다. 실제 퇴직금은 퇴직일 확정 후 급여대장 지급 총액과 상여·연차수당 내역으로 다시 계산해 주세요.</SupportText>
      </VStack>
    );
  }

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">한 사람 계산 상세</Text>
        <div className={styles.fieldGrid}>
          <Selector label="직원" placeholder="직원 고르기" hasSearch searchPlaceholder="찾기" options={options} value={activeId === null ? undefined : String(activeId)} onChange={(v) => onPick(v === null ? null : Number(v))} isDisabled={rows.length === 0} />
          <LabDateInput label="퇴직일" value={retireDate} onChange={onRetireDate} />
          <NumField label="연간 상여·연차수당 (선택)" value={bonus} onChange={onBonus} max={MAX_BONUS} placeholder="없으면 비워 두세요" description="있는 달 수 ÷ 12만큼 평균임금에 더합니다" />
        </div>
        {loading && <SupportText>급여대장을 불러오는 중입니다. 잠시 뒤 값이 바뀔 수 있습니다.</SupportText>}
        {body}
      </VStack>
    </Card>
  );
}
