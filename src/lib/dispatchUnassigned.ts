// 회원관리에는 등록돼 있는데 어느 배차 노선에도 없는 어르신을 찾는다.
//
// 숲속재활 사례(어르신 82명 중 78명만 배정)처럼, 노선 설정 화면과 배차표
// 어디에도 "빠진 사람"이 보이지 않아서 새로 들어온 어르신을 노선에 넣는 걸
// 잊어도 아무도 몰랐다. 등원/하원은 서로 다른 노선 구성이라 방향별로 따로 센다.

import type { DispatchSettings, RouteType } from '@/types/dispatch';
import type { ElderlyInfo } from '@/types/elderly';
import type { ElderDayAttendance } from '@/types/attendance';

/**
 * 어르신이 특정 방향(등원/하원)의 노선에 "커버"되는지 본다.
 * - 그 방향의 노선에 배정돼 있으면 커버
 * - 그 방향에 개인등원/개인하원 고정 설정이 있으면 커버(차량을 안 타는 게 정상이므로)
 */
export function getUnassignedElders(
  direction: RouteType,
  settings: DispatchSettings,
  companyElders: ElderlyInfo[],
  /** 그 날짜의 결석 기록 — 있으면 결석자는 "미배정"에서 뺀다(그날은 어차피 안 옴) */
  attendancesForDate?: ElderDayAttendance[]
): ElderlyInfo[] {
  const routeIdsForDirection = new Set(
    settings.routes.filter((r) => r.type === direction).map((r) => r.id)
  );

  const coveredElderIds = new Set<number>();
  settings.seniors.forEach((s) => {
    if (s.elderlyId === undefined) return;
    const inRouteOfDirection = routeIdsForDirection.has(s.routeId);
    const personalFlag = direction === '등원' ? s.personalPickup : s.personalDropoff;
    if (inRouteOfDirection || personalFlag) coveredElderIds.add(s.elderlyId);
  });

  const absentElderIds = new Set(
    (attendancesForDate ?? []).filter((a) => a.status === '결석').map((a) => a.elderlyId)
  );

  return companyElders.filter(
    (e) => !coveredElderIds.has(e.id) && !absentElderIds.has(e.id)
  );
}
