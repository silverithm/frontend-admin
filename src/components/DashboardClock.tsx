'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Text } from '@astryxdesign/core/Text';

/**
 * 1분마다 갱신되는 헤더 시계.
 * 관리자 화면에서 초 단위까지 볼 일은 드물고, 초마다 굵게 바뀌는 숫자가
 * 시선을 끌어 (#63) 분 단위로 낮추고 굵기도 낮춘다.
 * AdminDashboard에 state로 두면 갱신마다 대시보드 전체(달력·목록 포함)가 리렌더됐다.
 * 이 컴포넌트로 분리해 재렌더 범위를 시계 텍스트 하나로 좁힌다.
 */
export default function DashboardClock() {
  const [currentTime, setCurrentTime] = useState(() => format(new Date(), 'HH:mm'));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm'));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="carev-dash-clock" style={{ textAlign: 'right' }}>
      <Text type="body" weight="normal" color="secondary" hasTabularNumbers>{currentTime}</Text>
    </div>
  );
}
