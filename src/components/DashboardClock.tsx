'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Text } from '@astryxdesign/core/Text';

/**
 * 1초마다 갱신되는 헤더 시계.
 * AdminDashboard에 state로 두면 1초마다 대시보드 전체(달력·목록 포함)가 리렌더됐다.
 * 이 컴포넌트로 분리해 재렌더 범위를 시계 텍스트 하나로 좁힌다.
 */
export default function DashboardClock() {
  const [currentTime, setCurrentTime] = useState(() => format(new Date(), 'HH:mm:ss'));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="carev-dash-clock" style={{ textAlign: 'right' }}>
      <Text type="body" weight="bold" color="secondary" hasTabularNumbers>{currentTime}</Text>
    </div>
  );
}
