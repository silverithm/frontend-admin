import React from 'react';

const CalendarSkeleton: React.FC = () => {
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  
  // 5주 x 7일 = 35개의 날짜 셀 생성
  const calendarCells = Array.from({ length: 35 }, (_, i) => i);

  return (
    <div className="w-full">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS.map((day, index) => (
          <div 
            key={day} 
            className={`py-0.5 sm:py-2 text-center font-medium text-[8px] sm:text-sm ${
              index === 0 ? 'text-red-500' : 
              index === 6 ? 'text-indigo-500' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="grid grid-cols-7 gap-x-1 gap-y-3 sm:gap-x-4 sm:gap-y-5 md:gap-x-5 md:gap-y-6 mt-2">
        {calendarCells.map((index) => (
          <div
            key={index}
            className={`p-1 sm:p-3 min-h-[60px] sm:min-h-[120px] md:min-h-[140px] rounded-lg sm:rounded-xl relative`}
          >
            {/* 날짜 셀 스켈레톤 - 한 줄로 표시 */}
            <div className="skeleton rounded-lg h-full p-2 flex items-center justify-center">
              <div className="skeleton rounded-full w-3/4 h-4 sm:h-5"></div>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 상태 표시 부분도 스켈레톤으로 */}
      <div className="mt-6 p-4 border-t border-gray-100">
        <div className="skeleton rounded h-4 w-20 mb-3"></div>
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="skeleton rounded-full w-4 h-4"></div>
              <div className="skeleton rounded w-12 h-4"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarSkeleton;