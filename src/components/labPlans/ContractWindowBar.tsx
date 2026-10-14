'use client';

/**
 * 갱신 신청 창 달력식 표시 — 유효기간 끝 120일 전부터 끝 뒤 14일까지를 한 줄로 펴고,
 * 신청 기간(끝 90일 전~30일 전)은 노랑, 그 뒤 만료까지는 빨강, 오늘은 세로선으로 보인다.
 */
import { Text } from '@astryxdesign/core/Text';
import { dotDate } from '@/components/lab/labFormat';
import { renewalWindow } from '@/lib/lab/contractRules';
import { addDays, daysBetween } from '@/lib/lab/labDate';
import six from './labPlans6.module.css';

interface Props {
  validTo: string;
  today: string;
}

export default function ContractWindowBar({ validTo, today }: Props) {
  const window = renewalWindow(validTo);
  if (!window) return null;
  const from = addDays(window.opensOn, -30) as string;
  const to = addDays(validTo, 14) as string;
  const total = daysBetween(from, to) ?? 1;
  const pct = (date: string) => Math.max(0, Math.min(100, ((daysBetween(from, date) ?? 0) / total) * 100));
  const openAt = pct(window.opensOn);
  const closeAt = pct(window.closesOn);
  const endAt = pct(validTo);
  const todayAt = pct(today);
  const todayInside = today >= from && today <= to;
  return (
    <div className={six.windowBox}>
      <Text type="supporting" color="secondary">
        갱신 신청 창 — 유효기간 끝 90일 전부터 30일 전까지 신청합니다(시행규칙 제8조)
      </Text>
      <div className={six.windowTrack} role="img" aria-label={`갱신 신청 ${dotDate(window.opensOn)}부터 ${dotDate(window.closesOn)}까지, 유효기간 끝 ${dotDate(validTo)}`}>
        <span className={six.windowOpen} style={{ insetInlineStart: `${openAt}%`, width: `${closeAt - openAt}%` }} />
        <span className={six.windowLate} style={{ insetInlineStart: `${closeAt}%`, width: `${endAt - closeAt}%` }} />
        {todayInside && <span className={six.windowToday} style={{ insetInlineStart: `${todayAt}%` }} />}
      </div>
      <div className={six.windowLegend}>
        <Text type="supporting" hasTabularNumbers>
          <span className={six.legendOpen}>신청 기간</span> {dotDate(window.opensOn)} ~ {dotDate(window.closesOn)}
        </Text>
        <Text type="supporting" hasTabularNumbers>
          <span className={six.legendLate}>기한 뒤~만료</span> ~ {dotDate(validTo)}
        </Text>
        {todayInside && (
          <Text type="supporting" color="secondary" hasTabularNumbers>
            오늘 {dotDate(today)}
          </Text>
        )}
      </div>
    </div>
  );
}
