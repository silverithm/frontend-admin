/**
 * 주운전자 충돌 규칙 — `node --test src/lib/vacationGuard.test.ts`
 *
 * 같은 사람이 등원 노선과 하원 노선의 주운전자를 동시에 맡는 것은 정상이다(시간대가 다르므로).
 * 같은 방향(등원-등원, 하원-하원) 안에서만 주운전자가 겹치면 막아야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { findPrimaryDriverConflict } from './vacationGuard.ts';
import type { Route } from '@/types/dispatch';

const 노선 = (over: Partial<Route>): Route => ({
    id: 'r1',
    name: '스타리아',
    type: '등원',
    routeDrivers: [],
    ...over,
} as Route);

test('같은 방향(등원)의 두 노선에서 같은 주운전자는 충돌로 잡는다', () => {
    const routes: Route[] = [
        노선({ id: 'a', name: '스타리아', type: '등원', routeDrivers: [{ driverId: '1', driverName: '홍길동', vehicleName: '스타리아', vehicleCapacity: 12 }] }),
        노선({ id: 'b', name: '카니발', type: '등원', routeDrivers: [] }),
    ];
    const conflict = findPrimaryDriverConflict('홍길동', routes, 'b', '등원');
    assert.ok(conflict, '같은 방향 충돌을 잡지 못했다');
    assert.equal(conflict?.route.id, 'a');
});

test('등원 주운전자와 하원 주운전자를 같은 사람이 맡아도 충돌이 아니다', () => {
    const routes: Route[] = [
        노선({ id: 'a', name: '스타리아', type: '등원', routeDrivers: [{ driverId: '1', driverName: '홍길동', vehicleName: '스타리아', vehicleCapacity: 12 }] }),
        노선({ id: 'b', name: '스타리아', type: '하원', routeDrivers: [] }),
    ];
    const conflict = findPrimaryDriverConflict('홍길동', routes, 'b', '하원');
    assert.equal(conflict, null, '등원/하원은 독립적이어야 하는데 충돌로 잡혔다');
});

test('같은 노선(자기 자신)은 제외한다', () => {
    const routes: Route[] = [
        노선({ id: 'a', name: '스타리아', type: '등원', routeDrivers: [{ driverId: '1', driverName: '홍길동', vehicleName: '스타리아', vehicleCapacity: 12 }] }),
    ];
    const conflict = findPrimaryDriverConflict('홍길동', routes, 'a', '등원');
    assert.equal(conflict, null);
});
