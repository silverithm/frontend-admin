// 휴무 신청 전 확인·차단 규칙.
//
// 휴무는 신청 즉시 근무표와 배차에 영향을 준다. 특히 같은 노선의 주운전자와
// 부운전자가 같은 날 함께 쉬면 그 차량을 몰 사람이 없어 등·하원이 멈춘다.
// 신청 단계에서 미리 막고, 나머지는 안내 문구로 주의를 환기한다.

import type { Route, RouteDriver } from '@/types/dispatch';

/** 휴무 등록 전 필수 숙지 사항 — 신청·등록 화면 배너 제목으로 함께 쓴다 */
export const VACATION_NOTICE_TITLE = '휴무 등록 전 필수 숙지 사항';

/**
 * 필수 숙지 사항 배너의 공통 스타일.
 * Banner의 description은 줄바꿈을 유지하지 않아 항목이 한 문단으로 뭉치므로,
 * 항목은 children의 <ul>로 넘기고 이 스타일로 한 줄씩 세운다.
 * (Astryx reset이 list-style을 지우므로 불릿은 globals.css의 ::before로 그린다)
 */
export const VACATION_NOTICE_LIST_STYLE = {
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
} as const;

/** 위 목록에 불릿을 그리는 커스텀 클래스 (globals.css의 .carev-vacation-notices) */
export const VACATION_NOTICE_LIST_CLASS = 'carev-vacation-notices';

/** 휴무 신청 화면에 노출할 필수 숙지 사항 (순서 유지) */
export const VACATION_NOTICES = [
  '근무표는 모든 선생님과의 약속입니다. 본인의 일정 변동이 다른 선생님들의 업무 과중을 불러일으키니, 심사숙고하여 정해진 기일까지 입력 부탁드립니다.',
  '휴무 신청은 선착순이 아닙니다. 특정일에 휴무가 중복될 경우 서로 배려하여 조정 부탁드립니다.',
  '당일 최소 휴무 인원과 주/부운전자 중복 여부를 꼭 확인하시기 바랍니다.',
  '휴무, 연차 사용의 최종 승인은 센터 운영 전반을 고려하여 이루어집니다.',
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
    // 운전자가 셋인 노선에서 한 명 쉬는 건 문제가 아니다.
    // 내가 쉬었을 때 그 노선에 남는 운전자가 하나도 없을 때만 알린다.
    const remaining = route.routeDrivers.filter((other, otherIndex) => {
      if (otherIndex === index) return false;
      const name = other.driverName.trim();
      return !!name && !onVacation.has(name);
    });
    if (remaining.length > 0) continue;

    const restingOthers = route.routeDrivers
      .map((other, otherIndex) => ({ other, otherIndex }))
      .filter(({ other, otherIndex }) => otherIndex !== index && onVacation.has(other.driverName.trim()));

    conflicts.push({
      routeName: route.name,
      routeType: route.type,
      myRole: driverRoleLabel(index),
      otherName: restingOthers.map(({ other }) => other.driverName.trim()).join(', ') || '-',
      otherRole: restingOthers.map(({ otherIndex }) => driverRoleLabel(otherIndex)).join(', ') || '-',
    });
  }
  return conflicts;
}

/** 그날 운전자가 전원 휴무라 운행할 수 없는 노선 */
export interface RouteOutage {
  routeId: string;
  routeName: string;
  routeType: string;
  /** 휴무인 운전자 이름 */
  restingDrivers: string[];
}

/**
 * 해당 날짜에 운행이 불가능한 노선을 찾는다 (운전자 전원 휴무).
 * 관리자 화면에서 빨간 표시를 띄우는 근거로 쓴다.
 */
export function findRouteOutages(routes: Route[], vacationNames: string[]): RouteOutage[] {
  const onVacation = new Set(vacationNames.map((n) => n.trim()).filter(Boolean));
  if (onVacation.size === 0) return [];

  const outages: RouteOutage[] = [];
  for (const route of routes) {
    const drivers = route.routeDrivers.map((d) => d.driverName.trim()).filter(Boolean);
    if (drivers.length === 0) continue;

    const resting = drivers.filter((name) => onVacation.has(name));
    if (resting.length === drivers.length) {
      outages.push({
        routeId: String(route.id),
        routeName: route.name,
        routeType: route.type,
        restingDrivers: resting,
      });
    }
  }
  return outages;
}

/** 서버가 내려주는 운전자 배정 (GET /dispatch-settings/driver-roles) */
export interface RemoteDriverRole {
  routeName: string;
  routeType: string;
  roleIndex: number;
  roleLabel: string;
  /** 같은 노선의 다른 운전자 이름 */
  coDrivers: string[];
}

/**
 * 서버에서 받은 배정 정보로 충돌을 찾는다.
 * 배차 설정을 통째로 내려받지 않아도 되므로 휴무 화면·직원 앱에서 이 경로를 쓴다.
 */
export function findConflictsFromRoles(
  roles: RemoteDriverRole[],
  vacationNames: string[],
): DriverConflict[] {
  const onVacation = new Set(vacationNames.map((n) => n.trim()).filter(Boolean));
  const conflicts: DriverConflict[] = [];

  for (const role of roles) {
    const others = role.coDrivers.map((n) => n.trim()).filter(Boolean);
    // 내가 쉬어도 남는 운전자가 있으면 운행에 지장이 없다
    const remaining = others.filter((name) => !onVacation.has(name));
    if (remaining.length > 0) continue;

    const resting = others.filter((name) => onVacation.has(name));
    conflicts.push({
      routeName: role.routeName,
      routeType: role.routeType,
      myRole: role.roleLabel,
      otherName: resting.join(', ') || '-',
      // 서버 응답에는 상대의 역할까지 담기지 않는다 — 같은 노선이라는 사실만으로 충분하다
      otherRole: '같은 노선 운전자',
    });
  }
  return conflicts;
}

/**
 * 경고 문구 — 어느 노선이 왜 멈추는지 알린다.
 * 신청 자체를 막지는 않는다. 사정이 있을 수 있어 최종 판단은 관리자가 한다.
 */
export function describeDriverConflicts(memberName: string, conflicts: DriverConflict[]): string {
  const lines = conflicts.map(
    (c) =>
      `· ${c.routeName}(${c.routeType}) — ${c.otherRole} ${c.otherName} 선생님이 이미 휴무입니다.`,
  );
  return [
    `${memberName} 선생님이 쉬면 아래 노선을 운행할 사람이 없습니다.`,
    ...lines,
    '',
    '그래도 신청하시려면 계속 진행하세요. 관리자가 확인 후 조정할 수 있습니다.',
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
