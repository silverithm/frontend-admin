/**
 * 차량 배차 알고리즘
 * - 노선별 주운전자 우선 운행
 * - 주운전자 휴무 시 부운전자가 대체
 * - 일요일만 휴무 (공휴일 제외)
 * - 어르신 결석/개인등하원 시 해당 방향 탑승 명단에서 제외
 */

import { format, eachDayOfInterval, parseISO, getDay } from 'date-fns';
import type {
  Route,
  RouteType,
  RouteDriver,
  Senior,
  TripGroup,
  TripOrder,
  DispatchSettings,
  RouteDispatch,
  DailyDispatch,
  DispatchDaySummary,
  DriverRole,
} from '@/types/dispatch';
import type { ElderDayAttendance } from '@/types/attendance';
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
 * 그날 그 어르신의 출결 레코드를 찾는다.
 * Senior.elderlyId(백엔드 Elderly ID)로만 매칭한다 - 이름은 동명이인이 있다.
 */
export function findAttendance(
  senior: Senior,
  date: Date | string,
  attendances: ElderDayAttendance[]
): ElderDayAttendance | undefined {
  if (senior.elderlyId === undefined) return undefined;
  const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  return attendances.find((a) => a.elderlyId === senior.elderlyId && a.date === dateStr);
}

/**
 * 그날 그 어르신이 그 방향(등원/하원) 차량을 타는가?
 *
 * 1) 그날 출결 레코드가 있으면 그것이 우선
 *    - 결석 -> 양방향 모두 제외
 *    - 등원인데 개인등원 -> 제외, 하원인데 개인하원 -> 제외
 * 2) 레코드가 없으면 Senior의 고정 설정으로 판정
 * 3) 그 외 탑승
 *
 * 배차표·캘린더·리스트가 전부 이 함수 하나만 본다.
 */
export function isSeniorRiding(
  senior: Senior,
  date: Date | string,
  routeType: RouteType,
  attendances: ElderDayAttendance[]
): boolean {
  const record = findAttendance(senior, date, attendances);

  if (record) {
    if (record.status === '결석') return false;
    return routeType === '등원' ? !record.personalPickup : !record.personalDropoff;
  }

  return routeType === '등원' ? !senior.personalPickup : !senior.personalDropoff;
}

/**
 * 그날 개인등하원인 어르신 목록 (배차표 헤더에 "개인등원 : ..."으로 표시)
 * 결석자는 아예 안 오는 것이므로 여기 포함하지 않는다.
 */
export function getPersonalTransportSeniors(
  date: Date | string,
  routeType: RouteType,
  seniors: Senior[],
  attendances: ElderDayAttendance[]
): Senior[] {
  const matched = seniors.filter((s) => {
    const record = findAttendance(s, date, attendances);
    if (record) {
      if (record.status === '결석') return false;
      return routeType === '등원' ? record.personalPickup : record.personalDropoff;
    }
    return routeType === '등원' ? !!s.personalPickup : !!s.personalDropoff;
  });

  // 어르신 한 명이 등원용·하원용 Senior 두 레코드로 존재하므로 사람 단위로 합친다.
  // (합치지 않으면 "개인등원 : 김순자, 김순자"처럼 이름이 두 번 찍히고 총원도 부풀려진다)
  const unique = new Map<string, Senior>();
  matched.forEach((s) => {
    const key = s.elderlyId !== undefined ? `id:${s.elderlyId}` : `name:${s.name}`;
    if (!unique.has(key)) unique.set(key, s);
  });

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/**
 * 특정 노선의 탑승 어르신 목록 (결석·개인등하원 제외, 회차-탑승순서 정렬)
 */
export function getSeniorsForRoute(
  routeId: string,
  routeType: RouteType,
  date: Date | string,
  seniors: Senior[],
  attendances: ElderDayAttendance[]
): Senior[] {
  return seniors
    .filter((s) => s.routeId === routeId)
    .filter((s) => isSeniorRiding(s, date, routeType, attendances))
    .sort(compareByTripThenBoarding);
}

/** 회차 우선, 그 다음 탑승순서 */
function compareByTripThenBoarding(a: Senior, b: Senior): number {
  const at = a.tripOrder ?? 0;
  const bt = b.tripOrder ?? 0;
  if (at !== bt) return at - bt;
  return a.boardingOrder - b.boardingOrder;
}

/**
 * 탑승 명단을 회차별로 묶는다.
 * 아무도 회차를 지정하지 않은 노선은 그룹 1개(tripOrder 없음)로 돌려주고,
 * 화면/텍스트에서는 "1차)" 같은 접두어 없이 한 줄로 출력한다.
 */
export function groupPassengersByTrip(passengers: Senior[]): TripGroup[] {
  const hasTrip = passengers.some((s) => s.tripOrder !== undefined);
  if (!hasTrip) {
    return passengers.length > 0 ? [{ seniors: [...passengers].sort(compareByTripThenBoarding) }] : [];
  }

  const groups = new Map<TripOrder, Senior[]>();
  passengers.forEach((s) => {
    // 회차를 쓰는 노선에서 미지정 어르신은 1차로 본다
    const trip = (s.tripOrder ?? 1) as TripOrder;
    const list = groups.get(trip) ?? [];
    list.push(s);
    groups.set(trip, list);
  });

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([tripOrder, seniors]) => ({
      tripOrder,
      seniors: seniors.sort((a, b) => a.boardingOrder - b.boardingOrder),
    }));
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
  attendances: ElderDayAttendance[]
): RouteDispatch {
  const { seniors } = settings;

  // 노선에 운전자가 배정되지 않은 경우
  if (!route.routeDrivers || route.routeDrivers.length === 0) {
    return {
      routeId: route.id,
      routeName: route.name,
      routeType: route.type,
      driver: null,
      crew: [],
      driverRole: null,
      status: '운행없음',
      passengers: [],
      tripGroups: [],
      reason: '운전자가 배정되지 않음',
    };
  }

  const mainDriver = route.routeDrivers[0];
  const passengers = getSeniorsForRoute(route.id, route.type, date, seniors, attendances);
  const tripGroups = groupPassengersByTrip(passengers);
  // 그날 그 차에 실제로 타는 인력 (주운전자든 동승 팀장이든 휴무가 아닌 사람 전원)
  const crew = route.routeDrivers.filter((d) => !isDriverOnVacation(d, date, vacations));

  // 주운전자가 휴무가 아닌 경우 - 정상 운행
  if (!isDriverOnVacation(mainDriver, date, vacations)) {
    return {
      routeId: route.id,
      routeName: route.name,
      routeType: route.type,
      driver: mainDriver,
      crew,
      driverRole: '주운전자',
      status: '정상',
      passengers,
      tripGroups,
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
        crew,
        driverRole: getDriverRoleName(i),
        status: '대체',
        passengers,
        tripGroups,
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
    crew: [],
    driverRole: null,
    status: '운행없음',
    passengers: [],
    tripGroups: [],
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
  attendances: ElderDayAttendance[]
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
      crew: [],
      driverRole: null as DriverRole,
      status: '휴일' as const,
      passengers: [],
      tripGroups: [],
    }));

    return {
      date: dateStr,
      routeDispatches,
      personalPickupSeniors: [],
      personalDropoffSeniors: [],
    };
  }

  const routeDispatches = settings.routes.map((route) =>
    getRouteDispatchForDate(route, dateStr, settings, vacations, attendances)
  );

  return {
    date: dateStr,
    routeDispatches,
    personalPickupSeniors: getPersonalTransportSeniors(dateStr, '등원', settings.seniors, attendances),
    personalDropoffSeniors: getPersonalTransportSeniors(dateStr, '하원', settings.seniors, attendances),
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
  attendances: ElderDayAttendance[]
): DailyDispatch[] {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  const dates = eachDayOfInterval({ start, end });

  return dates.map((date) =>
    getDailyDispatch(date, settings, vacations, attendances)
  );
}

/**
 * 캘린더용 일일 요약 정보 생성
 */
export function getDispatchDaySummary(
  date: Date | string,
  settings: DispatchSettings,
  vacations: VacationRequest[],
  attendances: ElderDayAttendance[]
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

  const dispatch = getDailyDispatch(date, settings, vacations, attendances);

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
  attendances: ElderDayAttendance[]
): Map<string, DispatchDaySummary> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const summaryMap = new Map<string, DispatchDaySummary>();
  const dates = eachDayOfInterval({ start: firstDay, end: lastDay });

  dates.forEach((date) => {
    const summary = getDispatchDaySummary(date, settings, vacations, attendances);
    summaryMap.set(summary.date, summary);
  });

  return summaryMap;
}
