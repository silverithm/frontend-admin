// 휴무 신청 전 확인·차단 규칙.
//
// 휴무는 신청 즉시 근무표와 배차에 영향을 준다. 특히 같은 노선의 주운전자와
// 부운전자가 같은 날 함께 쉬면 그 차량을 몰 사람이 없어 등·하원이 멈춘다.
// 신청 단계에서 미리 막고, 나머지는 안내 문구로 주의를 환기한다.

import type { Route, RouteDriver } from '@/types/dispatch';

/** 휴무 신청 화면에 노출할 주의사항 */
export const VACATION_NOTICES = [
  '본인이 주운전자 · 부운전자인지 확인해 주세요.',
  '요양팀은 최소 휴무 인원을 확인해 주세요.',
  '휴무 신청은 선착순이 아닙니다. 같은 날 신청이 몰리면 서로 배려해 조정해 주세요.',
  '근무표는 모든 선생님과의 약속입니다. 변동이 없도록 심사숙고해 입력해 주세요.',
] as const;

/** routeDrivers 배열에서의 위치를 사람이 읽는 역할명으로 (0=주운전자) */
export function driverRoleLabel(index: number): string {
  return index === 0 ? '주운전자' : `부${index}운전자`;
}

export interface DriverAssignment {
  route: Route;
  driver: RouteDriver;
  /** routeDrivers 내 위치 */
  index: number;
}

/** 이름으로 배차 배정을 찾는다. 동명이인은 구분하지 못하므로 모두 반환한다. */
export function findDriverAssignments(memberName: string, routes: Route[]): DriverAssignment[] {
  const name = memberName.trim();
  if (!name) return [];

  const found: DriverAssignment[] = [];
  for (const route of routes) {
    route.routeDrivers.forEach((driver, index) => {
      if (driver.driverName.trim() === name) {
        found.push({ route, driver, index });
      }
    });
  }
  return found;
}

export interface DriverConflict {
  routeName: string;
  routeType: string;
  /** 신청자의 역할 (주운전자 / 부1운전자 …) */
  myRole: string;
  /** 이미 휴무인 같은 노선 운전자 */
  otherName: string;
  otherRole: string;
}

/**
 * 같은 노선의 다른 운전자가 이미 그날 휴무인지 확인한다.
 *
 * @param memberName    휴무를 신청하는 사람 이름
 * @param routes        배차 노선 설정
 * @param vacationNames 해당 날짜에 이미 휴무로 잡힌 사람 이름 목록
 */
export function findDriverConflicts(
  memberName: string,
  routes: Route[],
  vacationNames: string[],
): DriverConflict[] {
  const assignments = findDriverAssignments(memberName, routes);
  if (assignments.length === 0) return [];

  const onVacation = new Set(vacationNames.map((n) => n.trim()).filter(Boolean));
  const conflicts: DriverConflict[] = [];

  for (const { route, index } of assignments) {
    route.routeDrivers.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      const otherName = other.driverName.trim();
      if (!otherName || !onVacation.has(otherName)) return;

      conflicts.push({
        routeName: route.name,
        routeType: route.type,
        myRole: driverRoleLabel(index),
        otherName,
        otherRole: driverRoleLabel(otherIndex),
      });
    });
  }
  return conflicts;
}

/** 차단 안내 문구 — 어느 노선이 왜 멈추는지 구체적으로 알린다 */
export function describeDriverConflicts(memberName: string, conflicts: DriverConflict[]): string {
  const lines = conflicts.map(
    (c) =>
      `· ${c.routeName}(${c.routeType}) — ${c.otherRole} ${c.otherName} 선생님이 이미 휴무입니다.`,
  );
  return [
    `${memberName} 선생님은 아래 노선의 운전자로 배정돼 있습니다.`,
    ...lines,
    '',
    '같은 노선의 운전자가 함께 쉬면 그날 차량을 운행할 사람이 없습니다.',
    '휴무일을 조정하거나, 배차에서 대체 운전자를 먼저 지정해 주세요.',
  ].join('\n');
}

/**
 * 배차 설정에서 한 사람이 여러 노선에 중복 배정됐는지 확인한다.
 * 같은 사람이 두 노선을 동시에 몰 수는 없으므로 설정 단계에서 막는다.
 *
 * @param excludeRouteId 지금 편집 중인 노선 (자기 자신과의 비교 제외)
 */
export function findDuplicateAssignment(
  driverName: string,
  routes: Route[],
  excludeRouteId?: string,
): DriverAssignment | null {
  const name = driverName.trim();
  if (!name) return null;

  for (const route of routes) {
    if (excludeRouteId && String(route.id) === String(excludeRouteId)) continue;
    const index = route.routeDrivers.findIndex((d) => d.driverName.trim() === name);
    if (index >= 0) {
      return { route, driver: route.routeDrivers[index], index };
    }
  }
  return null;
}
