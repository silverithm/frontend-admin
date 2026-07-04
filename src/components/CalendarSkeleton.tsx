import React from 'react';
import { Skeleton } from '@astryxdesign/core/Skeleton';

const CalendarSkeleton: React.FC = () => {
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  // 5주 x 7일 = 35개의 날짜 셀 생성
  const calendarCells = Array.from({ length: 35 }, (_, i) => i);

  return (
    <div className="carev-calskel-root">
      {/* 요일 헤더 */}
      <div className="carev-calskel-header">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className="carev-calskel-weekday"
            style={{
              color:
                index === 0 ? 'var(--color-text-red)' : index === 6 ? 'var(--color-text-purple)' : 'var(--color-text-primary)',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="carev-calskel-grid">
        {calendarCells.map((index) => (
          <div key={index} className="carev-calskel-cell">
            {/* 날짜 셀 스켈레톤 */}
            <Skeleton width="100%" height="100%" radius={2} index={index} />
          </div>
        ))}
      </div>

      {/* 하단 상태 표시 부분도 스켈레톤으로 */}
      <div className="carev-calskel-footer">
        <Skeleton width={80} height={16} radius={2} />
        <div className="carev-calskel-legend">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width={64} height={16} radius="rounded" index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarSkeleton;
