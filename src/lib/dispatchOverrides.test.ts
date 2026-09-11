/**
 * 그날 하루치 배차 수정본 — `node --test src/lib/dispatchOverrides.test.ts`
 *
 * 배차표는 노선 설정에서 매일 다시 계산된다. 현장의 "오늘은 저 어르신을 저 차에"를
 * 설정에 직접 하면 다음 날부터도 바뀌므로, 그날치만 얹고 원본은 건드리지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDispatchOverrides, getDailyDispatch } from './dispatchAlgorithm.ts';
import type { DispatchSettings, Senior } from '@/types/dispatch';

const 어르신 = (id: string, name: string, routeId: string, boardingOrder: number, tripOrder?: 1 | 2): Senior =>
    ({ id, name, routeId, boardingOrder, tripOrder, elderlyId: Number(id.replace(/\D/g, '')) });

const 명단: Senior[] = [
    어르신('s1', '강문자', 'r1', 1),
    어르신('s2', '조복수', 'r1', 2),
    어르신('s3', '김안자', 'r2', 1),
];

test('수정본이 없으면 명단을 그대로 둔다 — 배열 자체를 돌려준다', () => {
    assert.equal(applyDispatchOverrides(명단, []), 명단);
    assert.equal(applyDispatchOverrides(명단, null), 명단);
});

test('옮긴 어르신만 노선이 바뀐다 — 나머지는 설정 그대로', () => {
    const result = applyDispatchOverrides(명단, [{ seniorId: 's1', routeId: 'r2', boardingOrder: 5 }]);

    assert.equal(result[0].routeId, 'r2');
    assert.equal(result[0].boardingOrder, 5);
    assert.equal(result[1].routeId, 'r1', '건드리지 않은 어르신이 함께 움직였다');
    assert.equal(result[2].routeId, 'r2');
});

test('원본 명단은 바뀌지 않는다 — 내일 배차가 오늘 조작을 물려받으면 안 된다', () => {
    applyDispatchOverrides(명단, [{ seniorId: 's1', routeId: 'r2', boardingOrder: 5 }]);

    assert.equal(명단[0].routeId, 'r1');
    assert.equal(명단[0].boardingOrder, 1);
});

test('회차도 함께 옮긴다', () => {
    const result = applyDispatchOverrides(명단, [
        { seniorId: 's3', routeId: 'r1', tripOrder: 2, boardingOrder: 1 },
    ]);

    assert.equal(result[2].tripOrder, 2);
    assert.equal(result[2].routeId, 'r1');
});

test('같은 어르신이 두 줄이면 마지막 줄이 이긴다', () => {
    const result = applyDispatchOverrides(명단, [
        { seniorId: 's1', routeId: 'r2', boardingOrder: 1 },
        { seniorId: 's1', routeId: 'r3', boardingOrder: 9 },
    ]);

    assert.equal(result[0].routeId, 'r3');
    assert.equal(result[0].boardingOrder, 9);
});

test('설정에 없는 어르신의 옛 수정본은 명단을 되살리지 않는다', () => {
    const result = applyDispatchOverrides(명단, [{ seniorId: '퇴소한분', routeId: 'r1', boardingOrder: 1 }]);

    assert.equal(result.length, 3);
    assert.ok(!result.some((s) => s.id === '퇴소한분'));
});

test('배차표가 실제로 바뀐다 — 옮긴 어르신이 그 차의 명단에 나타난다', () => {
    const settings: DispatchSettings = {
        routes: [
            {
                id: 'r1', name: '레이', type: '등원',
                routeDrivers: [{ driverId: 'd1', driverName: '이광성', vehicleName: '레이', vehicleCapacity: 12 }],
            },
            {
                id: 'r2', name: '스타리아', type: '등원',
                routeDrivers: [{ driverId: 'd2', driverName: '황인후', vehicleName: '스타리아', vehicleCapacity: 12 }],
            },
        ],
        seniors: 명단,
    };

    const before = getDailyDispatch('2026-09-11', settings, [], []);
    const 레이before = before.routeDispatches.find((rd) => rd.routeId === 'r1');
    assert.deepEqual(레이before?.passengers.map((s) => s.name), ['강문자', '조복수']);

    const moved: DispatchSettings = {
        ...settings,
        seniors: applyDispatchOverrides(명단, [{ seniorId: 's1', routeId: 'r2', boardingOrder: 9 }]),
    };
    const after = getDailyDispatch('2026-09-11', moved, [], []);

    assert.deepEqual(
        after.routeDispatches.find((rd) => rd.routeId === 'r1')?.passengers.map((s) => s.name),
        ['조복수'],
    );
    assert.deepEqual(
        after.routeDispatches.find((rd) => rd.routeId === 'r2')?.passengers.map((s) => s.name),
        ['김안자', '강문자'],
        '옮긴 어르신이 지정한 순서(맨 뒤)로 붙지 않았다',
    );
});

// --- 떨어뜨린 자리로 정해지는 탑승 순서 ---
//
// 정수로 다시 매기면 같은 차의 다른 분들 순서까지 전부 수정본에 들어가고,
// 그러면 나중에 설정에서 순서를 바꿔도 그날만 옛 순서로 남는다. 옮긴 사람만 기록한다.
import { nextBoardingOrder } from './dispatchBoardEdit.ts';

test('빈 차에 처음 놓으면 1번', () => {
    assert.equal(nextBoardingOrder([], -1), 1);
});

test('맨 뒤에 놓으면 마지막 다음 번호', () => {
    assert.equal(nextBoardingOrder([{ boardingOrder: 1 }, { boardingOrder: 4 }], -1), 5);
});

test('맨 앞에 놓으면 첫 사람보다 앞 번호', () => {
    assert.ok(nextBoardingOrder([{ boardingOrder: 1 }, { boardingOrder: 2 }], 0) < 1);
});

test('사이에 놓으면 앞뒤 사람의 사이값 — 나머지 순서를 건드리지 않는다', () => {
    const order = nextBoardingOrder([{ boardingOrder: 1 }, { boardingOrder: 2 }], 1);
    assert.ok(order > 1 && order < 2, `앞뒤 사이가 아니다: ${order}`);
});
