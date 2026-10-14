'use client';

/** 계획표의 주별 현황(신체·인지·사회적응·그 밖 횟수)과 점검 문장. 신체·인지는 한 주 3회 미만이면 붉게 보인다. */
import { useMemo } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import type { ScheduleItem } from '@/lib/lab/labTypes';
import { WEEKLY_TARGET, scheduleIssues, scheduleWeekly } from '@/lib/lab/programPlanRules';
import { Chip } from '@/components/lab/LabUi';
import { SupportText } from '@/components/lab/LabUi';
import { addDays } from '@/lib/lab/labDate';
import own from './ProgramPlan.module.css';

const short = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;

interface Props {
  month: string;
  items: ReadonlyArray<ScheduleItem>;
  operatingDays: ReadonlyArray<string>;
}

export default function ProgramPlanWeekly({ month, items, operatingDays }: Props) {
  const weeks = useMemo(() => scheduleWeekly(items, month), [items, month]);
  const issues = useMemo(() => scheduleIssues(items, month, operatingDays), [items, month, operatingDays]);
  const low = (n: number, weekStart: string) => {
    const end = addDays(weekStart, 6) ?? weekStart;
    const operating = operatingDays.filter((d) => d >= weekStart && d <= end).length;
    return operating >= WEEKLY_TARGET && n < WEEKLY_TARGET;
  };

  return (
    <Card padding={4}>
      <div className={own.dayPanel}>
        <Text type="large" weight="semibold">
          주별 현황과 점검
        </Text>
        {items.length === 0 ? (
          <SupportText>계획표에 프로그램을 넣으면 주마다 신체·인지 횟수를 세어 줍니다.</SupportText>
        ) : (
          <div className={own.weekScroll}>
            <table className={own.weekTable}>
              <thead>
                <tr>
                  <th scope="col">주</th>
                  <th scope="col">신체</th>
                  <th scope="col">인지</th>
                  <th scope="col">사회적응</th>
                  <th scope="col">그 밖</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.weekStart}>
                    <td>{short(w.weekStart)} ~ {short(addDays(w.weekStart, 6) ?? w.weekStart)}</td>
                    <td className={low(w.physical, w.weekStart) ? own.low : undefined}>{w.physical}</td>
                    <td className={low(w.cognitive, w.weekStart) ? own.low : undefined}>{w.cognitive}</td>
                    <td>{w.social}</td>
                    <td>{w.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {items.length > 0 &&
          (issues.length === 0 ? (
            <Chip tone="ok" label="점검할 것이 없습니다" />
          ) : (
            <>
              <Chip tone="warn" label={`확인할 것 ${issues.length}건`} />
              <ul className={own.issueList}>
                {issues.map((text) => (
                  <li key={text}>
                    <Text type="supporting">{text}</Text>
                  </li>
                ))}
              </ul>
            </>
          ))}
        <SupportText>평가 기준은 신체·인지 프로그램 주 3회 이상, 사회적응 월 1회 이상입니다. 쉬는 날이 많아 운영일이 3일 미만인 주는 점검하지 않습니다.</SupportText>
      </div>
    </Card>
  );
}
