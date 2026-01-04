/**
 * 차량 배차 알고리즘
 * - 노선별 주운전자 우선 운행
 * - 주운전자 휴무 시 부운전자가 대체
 * - 일요일만 휴무 (공휴일 제외)
 * - 어르신 결석 시 탑승 순서에서 제외
 */

import { format, eachDayOfInterval, parseISO, getDay } from 'date-fns';
import type {
  Route,
  RouteDriver,
  Senior,
  SeniorAbsence,
  DispatchSettings,
  RouteDispatch,
  DailyDispatch,
  DispatchDaySummary,
  DriverRole,
} from '@/types/dispatch';
import type { VacationRequest } from '@/types/vacation';

/**
 * 특정 날짜가 일요일인지 확인
 * - 일요일만 휴무, 그 외 모든 날은 근무
 */
export function isNonWorkingDay(date: Date | string): { isHoliday: boolean; holidayName?: string } {
  const d = typeof date === 'string' ? parseISO(date) : date;

  // 일요일 체크 (0 = 일요일)
  if (getDay(d) === 0) {
    return { isHoliday: true, holidayName: '일요일' };
  }

  return { isHoliday: false };
}

/**
 * 특정 날짜에 운전자가 휴무인지 확인
 * - VacationRequest의 userId와 RouteDriver의 driverId 매칭
 */
export function isDriverOnVacation(
  driver: RouteDriver,
  date: Date | string,
  vacations: VacationRequest[]
): boolean {
  const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');

  // userId로 매칭 (driverId가 있는 경우)
  if (driver.driverId) {
    return vacations.some(
      (v) => v.userId === driver.driverId && v.date === dateStr
    );
  }

  // fallback: 이름으로 매칭 (기존 데이터 호환)
  return vacations.some(
    (v) => v.userName === driver.driverName && v.date === dateStr
  );
}

/**
 * 특정 날짜에 어르신이 결석인지 확인
 */
export function isSeniorAbsent(
  senior: Senior,
  date: Date | string,
  absences: SeniorAbsence[]
): boolean {
  const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  return absences.some((a) => a.seniorId === senior.id && a.date === dateStr);
}

/**
 * 특정 노선의 탑승 어르신 목록 (결석자 제외, 탑승순서 정렬)
 */
export function getSeniorsForRoute(
  routeId: string,
  date: Date | string,
  seniors: Senior[],
  absences: SeniorAbsence[]
): Senior[] {
  return seniors
    .filter((s) => s.routeId === routeId)
    .filter((s) => !isSeniorAbsent(s, date, absences))
    .sort((a, b) => a.boardingOrder - b.boardingOrder);
}

/**
 * 운전자 역할 이름 반환
 */
function getDriverRoleName(index: number): DriverRole {
  if (index === 0) return '주운전자';
  if (index === 1) return '부1운전자';
  if (index === 2) return '부2운전자';
  if (index === 3) return '부3운전자';
  return null;
}

/**
 * 특정 날짜, 특정 노선의 배차 결정
 * - 주운전자 우선, 휴무 시 부운전자가 대체
 */
export function getRouteDispatchForDate(
  route: Route,
  date: Date | string,
  settings: DispatchSettings,
  vacations: VacationRequest[],
  seniorAbsences: SeniorAbsence[]
): RouteDispatch {
  const { seniors } = settings;

  // 노선에 운전자가 배정되지 않은 경우
  if (!route.routeDrivers || route.routeDrivers.length === 0) {
    return {
      routeId: route.id,
      routeName: route.name,
      routeType: route.type,
      driver: null,
      driverRole: null,
      status: '운행없음',
      passengers: [],
      reason: '운전자가 배정되지 않음',
    };
  }

  const mainDriver = route.routeDrivers[0];
  const passengers = getSeniorsForRoute(route.id, date, seniors, seniorAbsences);

  // 주운전자가 휴무가 아닌 경우 - 정상 운행
  if (!isDriverOnVacation(mainDriver, date, vacations)) {
    return {
      routeId: route.id,
      routeName: route.name,
      routeType: route.type,
      driver: mainDriver,
      driverRole: '주운전자',
      status: '정상',
      passengers,
      reason: `주운전자 ${mainDriver.driverName} 정상 운행`,
    };
  }

  // 주운전자가 휴무 - 부운전자 찾기
  const vacationDrivers: string[] = [mainDriver.driverName]; // 휴무인 운전자 목록

  for (let i = 1; i < route.routeDrivers.length; i++) {
    const subDriver = route.routeDrivers[i];
    if (!isDriverOnVacation(subDriver, date, vacations)) {
      return {
        routeId: route.id,
        routeName: route.name,
        routeType: route.type,
        driver: subDriver,
        driverRole: getDriverRoleName(i),
        status: '대체',
        passengers,
        originalMainDriver: mainDriver,
        reason: `주운전자 ${mainDriver.driverName} 휴무 → ${getDriverRoleName(i)} ${subDriver.driverName} 대체 운행`,
      };
    }
    vacationDrivers.push(subDriver.driverName);
  }

  // 모든 운전자가 휴무 - 운행 없음
  return {
    routeId: route.id,
    routeName: route.name,
    routeType: route.type,
    driver: null,
    driverRole: null,
    status: '운행없음',
    passengers: [],
    originalMainDriver: mainDriver,
    reason: `모든 운전자 휴무 (${vacationDrivers.join(', ')})`,
  };
}

/**
 * 특정 날짜의 전체 배차 결과
 */
export function getDailyDispatch(
  date: Date | string,
  settings: DispatchSettings,
  vacations: VacationRequest[],
  seniorAbsences: SeniorAbsence[]
): DailyDispatch {
  const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');

  // 일요일 체크
  const { isHoliday } = isNonWorkingDay(dateStr);
  if (isHoliday) {
    // 일요일에는 모든 노선이 휴일 상태
    const routeDispatches = settings.routes.map((route) => ({
      routeId: route.id,
      routeName: route.name,
      routeType: route.type,
      driver: null,
      driverRole: null as DriverRole,
      status: '휴일' as const,
      passengers: [],
    }));

    return {
      date: dateStr,
      routeDispatches,
    };
  }

  const routeDispatches = settings.routes.map((route) =>
    getRouteDispatchForDate(route, dateStr, settings, vacations, seniorAbsences)
  );

  return {
    date: dateStr,
    routeDispatches,
  };
}

/**
 * 날짜 범위의 전체 배차 결과
 */
export function getDispatchForDateRange(
  startDate: Date | string,
  endDate: Date | string,
  settings: DispatchSettings,
  vacations: VacationRequest[],
  seniorAbsences: SeniorAbsence[]
): DailyDispatch[] {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  const dates = eachDayOfInterval({ start, end });

  return dates.map((date) =>
    getDailyDispatch(date, settings, vacations, seniorAbsences)
  );
}

/**
 * 캘린더용 일일 요약 정보 생성
 */
export function getDispatchDaySummary(
  date: Date | string,
  settings: DispatchSettings,
  vacations: VacationRequest[],
  seniorAbsences: SeniorAbsence[]
): DispatchDaySummary {
  const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');

  // 일요일 체크
  const holidayInfo = isNonWorkingDay(dateStr);
  if (holidayInfo.isHoliday) {
    return {
      date: dateStr,
      normalCount: 0,
      substituteCount: 0,
      noServiceCount: 0,
      totalRoutes: settings.routes.length,
      isHoliday: true,
      holidayName: holidayInfo.holidayName,
    };
  }

  const dispatch = getDailyDispatch(date, settings, vacations, seniorAbsences);

  let normalCount = 0;
  let substituteCount = 0;
  let noServiceCount = 0;

  dispatch.routeDispatches.forEach((rd) => {
    if (rd.status === '정상') normalCount++;
    else if (rd.status === '대체') substituteCount++;
    else if (rd.status === '운행없음') noServiceCount++;
  });

  return {
    date: dateStr,
    normalCount,
    substituteCount,
    noServiceCount,
    totalRoutes: settings.routes.length,
    isHoliday: false,
  };
}

/**
 * 월간 요약 정보 생성
 */
export function getMonthlyDispatchSummary(
  year: number,
  month: number, // 0-11
  settings: DispatchSettings,
  vacations: VacationRequest[],
  seniorAbsences: SeniorAbsence[]
): Map<string, DispatchDaySummary> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const summaryMap = new Map<string, DispatchDaySummary>();
  const dates = eachDayOfInterval({ start: firstDay, end: lastDay });

  dates.forEach((date) => {
    const summary = getDispatchDaySummary(date, settings, vacations, seniorAbsences);
    summaryMap.set(summary.date, summary);
  });

  return summaryMap;
}
