/**
 * 케어 정보 표시 규칙 테스트 — `node --test src/lib/elderCare.test.ts`
 *
 * 왜 이걸 테스트하나: 표 한 칸에 들어가는 요약 문자열과 주민번호 입력 보정은
 * 화면을 띄워야만 눈에 보이는 자리다. 여기가 틀어지면 "투약 없음"인 어르신에게
 * 약을 주거나, 13자리를 채웠는데도 저장 버튼이 안 열리는 식으로 조용히 잘못된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CARE_GRADE_LABELS,
    COGNITION_LABELS,
    DIAPER_LABELS,
    MEAL_TYPE_LABELS,
    birthDateFromResidentNumber,
    formatAgeGender,
    formatMeals,
    formatMedication,
    formatResidentNumberInput,
    formatSeat,
    genderFromResidentNumber,
    isValidResidentNumber,
    maskResidentNumber,
    riskChips,
} from './elderCare.ts';

test('등급·기저귀·인지·식사형태 라벨이 계약서 enum을 모두 덮는다', () => {
    assert.equal(CARE_GRADE_LABELS.GRADE_1, '1등급');
    assert.equal(CARE_GRADE_LABELS.COGNITIVE_SUPPORT, '인지지원');
    assert.equal(Object.keys(CARE_GRADE_LABELS).length, 7);
    assert.equal(Object.keys(DIAPER_LABELS).length, 4);
    assert.equal(Object.keys(COGNITION_LABELS).length, 4);
    assert.equal(Object.keys(MEAL_TYPE_LABELS).length, 4);
    assert.equal(DIAPER_LABELS.PANTY, '팬티기저귀');
    assert.equal(MEAL_TYPE_LABELS.PORRIDGE, '죽');
});

test('투약 — 켜진 끼니만, 시간이 있으면 괄호로', () => {
    assert.equal(formatMedication({ medMorning: true, medEvening: true }), '아침·저녁');
    assert.equal(
        formatMedication({ medMorning: true, medMorningTime: '10시', medLunch: true, medLunchTime: '14시' }),
        '아침(10시)·점심(14시)',
    );
    // 시간만 있고 끼니가 꺼져 있으면 표시하지 않는다 — 껐다 켰다 한 흔적이 남아 있을 수 있다
    assert.equal(formatMedication({ medMorning: false, medMorningTime: '10시' }), '');
    // 켜진 칸이 없으면 '없음'이 아니라 빈 값이다 — 안 적은 것과 약이 없는 것을 구분할 수 없어서,
    // '없음'이라고 적으면 약을 드시는 어르신이 안 드시는 것으로 읽힌다
    assert.equal(formatMedication({}), '');
    assert.equal(formatMedication(null), '');
});

test('식사 — 세 칸은 항상 보이고, 값이 없으면 기본 O', () => {
    assert.equal(formatMeals({ morningSnack: false, afternoonSnack: true, dinner: true }), '오전간식 X · 오후간식 O · 저녁 O');
    assert.equal(formatMeals({}), '오전간식 O · 오후간식 O · 저녁 O');
    assert.equal(formatMeals(null), '오전간식 O · 오후간식 O · 저녁 O');
});

test('자리·나이/성별 — 한쪽만 있어도 구분자가 남지 않는다', () => {
    assert.equal(formatSeat({ floor: 1, seatNote: 'TV 앞' }), '1층 · TV 앞');
    assert.equal(formatSeat({ floor: 2 }), '2층');
    assert.equal(formatSeat({ seatNote: '창가' }), '창가');
    assert.equal(formatSeat({}), '');

    assert.equal(formatAgeGender({ age: 85, gender: 'FEMALE' }), '85세 · 여');
    assert.equal(formatAgeGender({ age: 85 }), '85세');
    assert.equal(formatAgeGender({ gender: 'MALE' }), '남');
    assert.equal(formatAgeGender({}), '');
});

test('위험 칩 — 없음 기저귀는 칩을 만들지 않는다', () => {
    assert.deepEqual(riskChips({ fallRisk: true, pressureSore: true, diaperType: 'PAD', diaperIntermittent: true }).map(c => c.label),
        ['낙상', '욕창', '패드(간헐)']);
    assert.deepEqual(riskChips({ diaperType: 'NONE' }), []);
    assert.deepEqual(riskChips(null), []);
});

test('주민번호 — 입력 중 하이픈, 13자리 검증, 마스킹', () => {
    assert.equal(formatResidentNumberInput('410203'), '410203');
    assert.equal(formatResidentNumberInput('4102032'), '410203-2');
    assert.equal(formatResidentNumberInput('4102032830514'), '410203-2830514');
    // 이미 하이픈이 있는 값을 붙여넣어도 결과가 같다
    assert.equal(formatResidentNumberInput('410203-2830514'), '410203-2830514');
    // 13자리를 넘겨 치면 더 들어가지 않는다
    assert.equal(formatResidentNumberInput('41020328305149999'), '410203-2830514');
    assert.equal(formatResidentNumberInput(''), '');

    assert.equal(isValidResidentNumber('410203-2830514'), true);
    assert.equal(isValidResidentNumber('410203-283051'), false);
    assert.equal(isValidResidentNumber(null), false);

    assert.equal(maskResidentNumber('4102032830514'), '410203-2******');
    assert.equal(maskResidentNumber('410203'), '');
});

test('주민번호에서 생년월일·성별을 서버와 같은 규칙으로 파생한다', () => {
    assert.equal(birthDateFromResidentNumber('4102032830514'), '1941-02-03');
    assert.equal(genderFromResidentNumber('4102032830514'), 'FEMALE');
    assert.equal(birthDateFromResidentNumber('0503013000000'), '2005-03-01');
    assert.equal(genderFromResidentNumber('0503013000000'), 'MALE');
    assert.equal(birthDateFromResidentNumber('9901019000000'), '1899-01-01');
    // 뒷자리 5~8은 외국인등록번호다 — 서버가 5·6=19xx, 7·8=20xx로 파생하므로 화면도 같아야 한다
    assert.equal(genderFromResidentNumber('9901015000000'), 'MALE');
    assert.equal(genderFromResidentNumber('9901016000000'), 'FEMALE');
    assert.equal(birthDateFromResidentNumber('9901015000000'), '1999-01-01');
    assert.equal(birthDateFromResidentNumber('0503017000000'), '2005-03-01');
    assert.equal(genderFromResidentNumber('0503018000000'), 'FEMALE');
    assert.equal(birthDateFromResidentNumber('410203'), null);
    // 월·일이 말이 안 되면 파생하지 않는다
    assert.equal(birthDateFromResidentNumber('4199032830514'), null);
});
