/**
 * 노선배차표 -> 카톡 공지용 텍스트
 *
 * 센터장이 매일 손으로 적어 올리던 형식을 그대로 재현한다:
 *
 *   8/31 (월) 등원   [개인등원 : 장치분, 최손분, 하금선]
 *   총 73명
 *   - 레이2/이광성팀장
 *   1차) 강문자 조복수 이종술 유임생
 *   2차) 김태선 이옥자2 박옥자
 *   - 스타렉스/김형인
 *   김안자 정경남 김옥남 신갑순
 *
 * 앱(frontend-app)에도 같은 규칙을 이식해야 두 화면의 텍스트가 어긋나지 않는다.
 */

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { DailyDispatch, RouteDispatch, RouteType, Senior } from '@/types/dispatch';

/**
 * 차량/인력 줄: "스타리아/황인후 박성은팀장"
 * 차량명 뒤에 그날 그 차에 타는 인력을 배정 순서대로 모두 적는다(휴무자 제외).
 * 주운전자가 휴무라 부운전자가 대신 잡는 날은 뒤에 "(대체)"를 붙인다.
 */
export function buildRouteHeadline(rd: RouteDispatch): string {
  const vehicle = rd.driver?.vehicleName?.trim() || rd.routeName;
  const names = rd.crew.length > 0
    ? rd.crew.map((d) => d.driverName)
    : rd.driver
      ? [rd.driver.driverName]
      : [];

  if (names.length === 0) return vehicle;

  const substitute = rd.status === '대체' ? ' (대체)' : '';
  return `${vehicle}/${names.join(' ')}${substitute}`;
}

const joinNames = (seniors: Senior[]) => seniors.map((s) => s.name).join(' ');

/** 노선 한 덩어리: 헤드라인 + 회차 라인들 */
export function buildRouteBlock(rd: RouteDispatch): string[] {
  const lines = [`- ${buildRouteHeadline(rd)}`];

  if (rd.status === '운행없음' || rd.status === '휴일') {
    lines.push(rd.reason || rd.status);
    return lines;
  }

  if (rd.tripGroups.length === 0) {
    lines.push('(탑승 없음)');
    return lines;
  }

  rd.tripGroups.forEach((group) => {
    const names = joinNames(group.seniors);
    lines.push(group.tripOrder ? `${group.tripOrder}차) ${names}` : names);
  });

  return lines;
}

/** 그 방향의 노선만, 운전자 미배정 노선은 빼고 */
export function selectRouteDispatches(daily: DailyDispatch, routeType: RouteType): RouteDispatch[] {
  return daily.routeDispatches.filter((rd) => rd.routeType === routeType);
}

/** 그 방향 차량 탑승 인원 */
export function countPassengers(dispatches: RouteDispatch[]): number {
  return dispatches.reduce((sum, rd) => sum + rd.passengers.length, 0);
}

/**
 * 헤더에 적는 "총 N명" - 그날 센터에 오는 인원.
 * 차량 탑승자 + 개인등하원(보호자가 데려오는 어르신)이고, 결석자는 빠진다.
 */
export function countAttending(daily: DailyDispatch, routeType: RouteType): number {
  const personal = routeType === '등원' ? daily.personalPickupSeniors : daily.personalDropoffSeniors;
  return countPassengers(selectRouteDispatches(daily, routeType)) + personal.length;
}

export function buildDispatchBoardText(daily: DailyDispatch, routeType: RouteType): string {
  const dispatches = selectRouteDispatches(daily, routeType);
  const personal = routeType === '등원' ? daily.personalPickupSeniors : daily.personalDropoffSeniors;

  const dateLabel = format(parseISO(daily.date), 'M/d (EEE)', { locale: ko });
  const personalLabel = routeType === '등원' ? '개인등원' : '개인하원';
  const personalPart = personal.length > 0
    ? `   [${personalLabel} : ${personal.map((s) => s.name).join(', ')}]`
    : '';

  const lines: string[] = [
    `${dateLabel} ${routeType}${personalPart}`,
    `총 ${countAttending(daily, routeType)}명`,
  ];

  dispatches.forEach((rd) => {
    lines.push(...buildRouteBlock(rd));
  });

  return lines.join('\n');
}
