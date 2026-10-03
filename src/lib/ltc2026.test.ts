/**
 * 2026 장기요양 기준값·본인부담금 계산 테스트 — `node --test src/lib/ltc2026.test.ts`
 *
 * 왜 이걸 테스트하나: /ltc 페이지는 검색엔진과 AI가 출처로 인용하라고 만든 공개 페이지다.
 * 표의 숫자가 원문과 한 칸만 어긋나도, 계산기의 한도 처리가 한 줄만 틀려도 보호자와 센터가
 * 틀린 금액을 믿게 된다. 원문(보건복지부고시 제2025-247호)에서 직접 옮긴 값을 여기서 다시 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DAYCARE_FEE_2026,
    DEMENTIA_UNIT_FEE_2026,
    MONTHLY_LIMIT_2025,
    MONTHLY_LIMIT_2026,
    calcDaycareCopay,
    dailyFee,
    daysWithinLimit,
    limitAddOn,
} from './ltc2026.ts';

test('주·야간보호 수가가 고시 제31조 표와 같다 (대표값)', () => {
    assert.equal(DAYCARE_FEE_2026['1'].h3to6, 41820);
    assert.equal(DAYCARE_FEE_2026['4'].h8to10, 58010);
    assert.equal(DAYCARE_FEE_2026['5'].over13, 67240);
    // 인지지원등급은 10시간 이상 구간도 8~10시간과 같은 금액이다 (원문 그대로)
    assert.equal(DAYCARE_FEE_2026.cognitive.h10to13, 56360);
    assert.equal(DAYCARE_FEE_2026.cognitive.over13, 56360);
});

test('치매전담실 표에는 1등급이 없고, 계산기는 그 조합을 거절한다', () => {
    assert.equal(DEMENTIA_UNIT_FEE_2026['1'], undefined);
    assert.equal(DEMENTIA_UNIT_FEE_2026['2']?.h8to10, 81270);
    assert.equal(dailyFee('1', 'dementia', 'h8to10'), null);
    assert.equal(calcDaycareCopay({ grade: '1', unit: 'dementia', band: 'h8to10', days: 20, copayClass: 'standard' }), null);
});

test('2025→2026 월 한도액 인상폭이 복지부 발표 범위(18,920원~247,800원)와 맞는다', () => {
    const raises = (['1', '2', '3', '4', '5', 'cognitive'] as const).map((g) => MONTHLY_LIMIT_2026[g] - MONTHLY_LIMIT_2025[g]);
    assert.deepEqual(raises, [206500, 247800, 42500, 39100, 31900, 18920]);
    assert.equal(Math.min(...raises), 18920);
    assert.equal(Math.max(...raises), 247800);
});

test('추가 산정은 8시간 이상·월 15일 이상일 때만, 등급별 비율로 붙는다 (제13조⑦⑧)', () => {
    assert.equal(limitAddOn('4', 'general', 'h8to10', 15).percent, 20);
    assert.equal(limitAddOn('2', 'general', 'h8to10', 20).percent, 10);
    assert.equal(limitAddOn('4', 'general', 'h8to10', 14).percent, 0);
    assert.equal(limitAddOn('4', 'general', 'h6to8', 22).percent, 0);
    assert.equal(limitAddOn('cognitive', 'general', 'h8to10', 22).percent, 0);
    assert.equal(limitAddOn('3', 'dementia', 'h8to10', 15).percent, 50);
    assert.equal(limitAddOn('cognitive', 'dementia', 'h8to10', 9).percent, 30);
    assert.equal(limitAddOn('cognitive', 'dementia', 'h8to10', 8).percent, 0);
});

test('한도 안이면 급여비용의 15%만 낸다 — 4등급 8~10시간 20일', () => {
    const r = calcDaycareCopay({ grade: '4', unit: 'general', band: 'h8to10', days: 20, copayClass: 'standard' });
    assert.ok(r);
    assert.equal(r.totalFee, 1160200);
    assert.equal(r.overLimit, 0);
    assert.equal(r.copayWithinLimit, 174030);
    assert.equal(r.insurerShare, 986170);
    assert.equal(r.totalCopay, 174030);
});

test('한도를 넘으면 넘는 금액은 전부 본인이 낸다 — 인지지원등급 8~10시간 15일', () => {
    // 한도 676,320원 = 56,360원 × 12일. 추가 산정 없음.
    const r = calcDaycareCopay({ grade: 'cognitive', unit: 'general', band: 'h8to10', days: 15, copayClass: 'standard' });
    assert.ok(r);
    assert.equal(r.totalFee, 845400);
    assert.equal(r.appliedLimit, 676320);
    assert.equal(r.overLimit, 169080);
    assert.equal(r.copayWithinLimit, 101448);
    assert.equal(r.totalCopay, 270528);
});

test('감경률과 의료급여 수급자 0%가 한도 안 금액에만 적용된다', () => {
    const base = { grade: '4', unit: 'general', band: 'h8to10', days: 20 } as const;
    assert.equal(calcDaycareCopay({ ...base, copayClass: 'reduced40' })?.copayWithinLimit, 104418);
    assert.equal(calcDaycareCopay({ ...base, copayClass: 'reduced60' })?.copayWithinLimit, 69612);
    assert.equal(calcDaycareCopay({ ...base, copayClass: 'medicalAid' })?.totalCopay, 0);
});

test('이용일수는 0~31일로 자르고 소수는 버린다', () => {
    assert.equal(calcDaycareCopay({ grade: '3', unit: 'general', band: 'h8to10', days: 40, copayClass: 'standard' })?.days, 31);
    assert.equal(calcDaycareCopay({ grade: '3', unit: 'general', band: 'h8to10', days: -2, copayClass: 'standard' })?.days, 0);
    assert.equal(calcDaycareCopay({ grade: '3', unit: 'general', band: 'h8to10', days: 10.7, copayClass: 'standard' })?.days, 10);
});

test('한도 안 이용 가능 일수 — 4등급 8~10시간은 24일, 추가 산정 시 29일', () => {
    assert.deepEqual(daysWithinLimit('4', 'general', 'h8to10'), { base: 24, withAddOn: 29 });
    assert.deepEqual(daysWithinLimit('cognitive', 'general', 'h8to10'), { base: 12, withAddOn: 12 });
    assert.deepEqual(daysWithinLimit('1', 'general', 'h8to10'), { base: 31, withAddOn: 31 });
});

test('계산기 예시표 문구의 숫자 — 인지지원등급 20일은 한도 초과 450,880원, 1~5등급은 초과 없음', () => {
    const cognitive = calcDaycareCopay({ grade: 'cognitive', unit: 'general', band: 'h8to10', days: 20, copayClass: 'standard' });
    assert.equal(cognitive?.overLimit, 450880);
    assert.equal(cognitive?.totalCopay, 552328);
    for (const grade of ['1', '2', '3', '4', '5'] as const) {
        assert.equal(calcDaycareCopay({ grade, unit: 'general', band: 'h8to10', days: 20, copayClass: 'standard' })?.overLimit, 0);
    }
});
