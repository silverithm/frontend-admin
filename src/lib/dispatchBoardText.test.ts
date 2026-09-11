/**
 * 배차표 텍스트 — `node --test src/lib/dispatchBoardText.test.ts`
 *
 * 노선에 등록된 인력을 전부 적는 바람에 주운전자가 출근한 날에도 부운전자 이름이 같이 찍혔다.
 * 그날 그 차를 실제로 모는 사람만 적어야 공지를 읽고 바로 알 수 있다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRouteBlock, buildRouteHeadline } from './dispatchBoardText.ts';
import type { RouteDispatch } from '@/types/dispatch';

const 운전자 = (driverName: string, vehicleName: string): RouteDispatch['driver'] =>
    ({ driverId: driverName, driverName, vehicleName, vehicleCapacity: 12 });

const 노선 = (over: Partial<RouteDispatch>): RouteDispatch => ({
    routeName: '스타리아',
    routeType: '등원',
    driver: 운전자('황인후', '스타리아'),
    crew: [운전자('황인후', '스타리아'), 운전자('박성은팀장', '스타리아')],
    status: '정상',
    tripGroups: [],
    passengers: [],
    ...over,
} as RouteDispatch);

test('주운전자가 출근한 날은 주운전자만 적는다 — 부운전자를 같이 적지 않는다', () => {
    const headline = buildRouteHeadline(노선({}));
    assert.equal(headline, '스타리아/황인후');
    assert.ok(!headline.includes('박성은팀장'), '부운전자가 헤드라인에 섞였다');
});

test('주운전자가 쉬어 부운전자가 대신 잡은 날은 그 사람만 적고 (대체)를 붙인다', () => {
    assert.equal(
        buildRouteHeadline(노선({
            driver: 운전자('박성은팀장', '스타리아'),
            status: '대체',
        })),
        '스타리아/박성은팀장 (대체)',
    );
});

test('차량명이 비어 있으면 노선 이름으로 적는다', () => {
    assert.equal(
        buildRouteHeadline(노선({ driver: 운전자('황인후', '   ') })),
        '스타리아/황인후',
    );
});

test('운전자가 없는 노선은 차량명만 적는다', () => {
    assert.equal(buildRouteHeadline(노선({ driver: undefined, status: '운행없음' })), '스타리아');
});

test('노선 덩어리에도 부운전자가 새지 않는다', () => {
    const lines = buildRouteBlock(노선({
        tripGroups: [{ tripOrder: 1, seniors: [{ name: '강문자' }, { name: '조복수' }] }] as RouteDispatch['tripGroups'],
    }));
    assert.deepEqual(lines, ['- 스타리아/황인후', '1차) 강문자 조복수']);
});
