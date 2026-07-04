import React, { useState, useEffect, useMemo, CSSProperties } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { VacationRequest, DayInfo } from '@/types/vacation';

interface CalendarProps {
  vacations?: VacationRequest[];
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}

const CARD_STYLE: CSSProperties = {
  background: 'var(--color-background-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  overflow: 'hidden',
};

const Calendar: React.FC<CalendarProps> = ({ vacations = [], onSelectDate, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [direction, setDirection] = useState(0); // 애니메이션 방향

  // 월 변경 함수 최적화
  const changeMonth = (delta: number) => {
    setDirection(delta);
    setCurrentMonth(prev => addMonths(prev, delta));
  };

  // 이전 달로 이동
  const prevMonth = () => changeMonth(-1);

  // 다음 달로 이동
  const nextMonth = () => changeMonth(1);

  // 달력 데이터 계산 - useMemo로 최적화
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);

    // 각 날짜에 휴가 신청 정보 추가
    const daysWithInfo = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayVacations = vacations.filter(v => v.date === dateStr);

      return {
        date: day,
        vacationCount: dayVacations.length,
        vacations: dayVacations
      };
    });

    // 첫 주의 비어있는 셀 채우기
    const blanks = Array(startDay).fill(null);

    // 6주(행) 채우기 위해 필요한 만큼 다음 달의 빈 셀 추가
    const totalCells = 6 * 7; // 6행 x 7열
    const daysWithBlanks = [...blanks, ...daysWithInfo];

    while (daysWithBlanks.length < totalCells) {
      daysWithBlanks.push(null);
    }

    // 6행 7열의 2차원 배열로 변환
    const rows = [];
    for (let i = 0; i < 6; i++) {
      rows.push(daysWithBlanks.slice(i * 7, (i + 1) * 7));
    }

    return rows;
  }, [currentMonth, vacations]);

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div style={CARD_STYLE}>
      {/* 캘린더 헤더 */}
      <div
        style={{
          background: 'linear-gradient(to right, #14b8a6, #0d9488)',
          color: '#fff',
          padding: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={prevMonth}
          className="carev-cal-navbtn"
          aria-label="이전 달"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            border: 'none',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <Icon icon="chevronLeft" size="md" color="inherit" />
        </button>
        <Text type="display-3" as="h2" weight="bold" color="inherit">
          {format(currentMonth, 'yyyy년 MM월', { locale: ko })}
        </Text>
        <button
          onClick={nextMonth}
          className="carev-cal-navbtn"
          aria-label="다음 달"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            border: 'none',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <Icon icon="chevronRight" size="md" color="inherit" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--color-background-muted)' }}>
        {weekDays.map((day, index) => (
          <div
            key={index}
            style={{
              padding: 12,
              textAlign: 'center',
              color: index === 0 ? 'var(--color-text-red)' : index === 6 ? 'var(--color-text-blue)' : 'var(--color-text-primary)',
            }}
          >
            <Text type="label" weight="semibold" color="inherit">{day}</Text>
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* 달력 내용 */}
        <div style={{ width: '100%' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: 'repeat(6, 1fr)',
              borderTop: '1px solid var(--color-border)',
              borderLeft: '1px solid var(--color-border)',
            }}
          >
            {calendarData.map((row, rowIndex) => (
              <React.Fragment key={rowIndex}>
                {row.map((dayInfo, colIndex) => {
                  if (!dayInfo) {
                    return (
                      <div
                        key={`blank-${rowIndex}-${colIndex}`}
                        className="carev-cal-cell"
                        style={{
                          padding: 4,
                          borderBottom: '1px solid var(--color-border)',
                          borderRight: '1px solid var(--color-border)',
                          background: 'rgba(249, 250, 251, 0.5)',
                        }}
                      />
                    );
                  }

                  const isToday = isSameDay(dayInfo.date, new Date());
                  const isSelected = selectedDate && isSameDay(dayInfo.date, selectedDate);
                  const isCurrentMonth = isSameMonth(dayInfo.date, currentMonth);
                  const isSunday = getDay(dayInfo.date) === 0;
                  const isSaturday = getDay(dayInfo.date) === 6;

                  // 날짜 숫자 스타일
                  const dayNumberStyle: CSSProperties = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(isToday
                      ? {
                          background: 'var(--color-background-teal)',
                          color: '#fff',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        }
                      : !isCurrentMonth
                      ? { color: 'inherit' }
                      : isSunday
                      ? { color: 'var(--color-text-red)' }
                      : isSaturday
                      ? { color: 'var(--color-text-blue)' }
                      : { color: 'var(--color-text-primary)' }),
                  };

                  return (
                    <div
                      key={`day-${rowIndex}-${colIndex}`}
                      onClick={() => onSelectDate(dayInfo.date)}
                      className="carev-cal-cell carev-cal-daycell"
                      style={{
                        position: 'relative',
                        padding: 4,
                        borderBottom: '1px solid var(--color-border)',
                        borderRight: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        transition: 'background 200ms',
                        color: !isCurrentMonth ? 'var(--color-text-primary)' : undefined,
                        background: isSelected
                          ? 'var(--color-background-teal)'
                          : !isCurrentMonth
                          ? 'rgba(249, 250, 251, 0.5)'
                          : isToday
                          ? 'rgba(240, 253, 250, 0.4)'
                          : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 4 }}>
                          <span style={dayNumberStyle}>
                            <Text type="body" weight="medium" color="inherit">{format(dayInfo.date, 'd')}</Text>
                          </span>
                          {dayInfo.vacationCount > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 20,
                                height: 20,
                                padding: '0 6px',
                                borderRadius: '9999px',
                                background: 'var(--color-background-red)',
                                color: '#fff',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                              }}
                            >
                              <Text type="supporting" size="2xs" weight="semibold" color="inherit">{dayInfo.vacationCount}</Text>
                            </div>
                          )}
                        </div>

                        {/* 휴가 표시 */}
                        {dayInfo.vacationCount > 0 && isCurrentMonth && (
                          <div style={{ marginTop: 4, padding: '0 4px' }}>
                            {dayInfo.vacations.slice(0, 2).map((vacation: VacationRequest, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  margin: '2px 0',
                                  padding: 4,
                                  borderRadius: 4,
                                  background: 'var(--color-background-red)',
                                  color: 'var(--color-text-red)',
                                }}
                              >
                                <Text type="supporting" size="2xs" weight="medium" color="inherit" maxLines={1}>
                                  {vacation.userName}
                                </Text>
                              </div>
                            ))}
                            {dayInfo.vacationCount > 2 && (
                              <div style={{ marginTop: 4, color: 'var(--color-text-gray)' }}>
                                <Text type="supporting" size="2xs" weight="medium" color="inherit">
                                  +{dayInfo.vacationCount - 2}명
                                </Text>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 선택 효과 */}
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            border: '2px solid #14b8a6',
                            borderRadius: 2,
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 정보 */}
      <div
        style={{
          padding: 12,
          background: 'var(--color-background-muted)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: 'var(--color-background-teal)' }} />
          <Text type="supporting" size="2xs" color="secondary">오늘</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: 'var(--color-background-red)' }} />
          <Text type="supporting" size="2xs" color="secondary">휴가신청</Text>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Calendar);
