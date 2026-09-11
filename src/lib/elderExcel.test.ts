/**
 * 어르신 엑셀 해석 규칙 테스트 — `node --test src/lib/elderExcel.test.ts`
 *
 * 왜 이걸 테스트하나: 기관이 쓰던 표를 그대로 올리는 것이 이 기능의 전부다.
 * 열 이름 하나가 안 맞으면 케어 정보가 통째로 빈 채 등록되고, 그 사실은
 * 수백 명을 다 넣은 뒤에야 드러난다. 파일을 만들지 않고도 규칙만 검증하려고
 * 행 해석을 parseElderRows로 갈라 놨다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseBoolCell,
    parseCareGrade,
    parseCognition,
    parseDiaper,
    parseElderRows,
    TEMPLATE_COLUMNS,
    parseGender,
    parseMealType,
} from './elderExcel.ts';

/** 헤더 한 줄 + 데이터 행들로 격자를 만든다 */
const grid = (header: string[], ...rows: string[][]) => [header, ...rows];

test('헤더 별칭 — 쓰던 표의 다른 이름도 같은 열로 읽는다', () => {
    const rows = parseElderRows(grid(
        ['성명', '자택주소', '주민등록번호', '장기요양등급', '자리위치', '저녁', '식사메모'],
        ['김복순', '서울시 강남구 1', '410203-2830514', '3등급', 'TV 앞', 'X', '생선 기피'],
    ));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'ok');
    assert.equal(rows[0].name, '김복순');
    assert.equal(rows[0].homeAddress, '서울시 강남구 1');
    assert.deepEqual(rows[0].careProfile, {
        residentNumber: '4102032830514',
        careGrade: 'GRADE_3',
        seatNote: 'TV 앞',
        dinner: false,
        mealNote: '생선 기피',
    });
});

test('헤더에 별표·괄호·공백이 섞여 있어도 찾는다', () => {
    const rows = parseElderRows(grid(
        ['이 름*', '주소(선택)', '투약 아침'],
        ['박말순', '', 'O(10시)'],
    ));
    assert.equal(rows[0].name, '박말순');
    assert.equal(rows[0].careProfile?.medMorning, true);
    assert.equal(rows[0].careProfile?.medMorningTime, '10시');
});

test('O/X 칸 — 시간이 괄호로 붙어 와도 둘 다 읽는다', () => {
    assert.deepEqual(parseBoolCell('O(10시)'), { value: true, time: '10시' });
    assert.deepEqual(parseBoolCell('O'), { value: true, time: undefined });
    assert.deepEqual(parseBoolCell('예'), { value: true, time: undefined });
    assert.deepEqual(parseBoolCell('TRUE'), { value: true, time: undefined });
    assert.deepEqual(parseBoolCell('x'), { value: false });
    assert.deepEqual(parseBoolCell('아니오'), { value: false });
    assert.deepEqual(parseBoolCell('N'), { value: false });
    // 빈 칸은 '아니오'가 아니라 '입력하지 않음' — 여기서 false로 굳히면 기본값(간식 O)이 뒤집힌다
    assert.deepEqual(parseBoolCell(''), {});
    assert.deepEqual(parseBoolCell('   '), {});
    // 시간만 적힌 칸도 준다는 뜻으로 본다
    assert.deepEqual(parseBoolCell('14시'), { value: true, time: '14시' });
});

test('투약 세 칸이 각자의 시간을 가진다', () => {
    const rows = parseElderRows(grid(
        ['이름', '투약아침', '투약점심', '투약저녁', '투약메모'],
        ['김복순', 'O(10시)', 'O(14시)', 'X', '혈압약 식후 30분'],
    ));
    const p = rows[0].careProfile!;
    assert.equal(p.medMorning, true);
    assert.equal(p.medMorningTime, '10시');
    assert.equal(p.medLunch, true);
    assert.equal(p.medLunchTime, '14시');
    assert.equal(p.medEvening, false);
    assert.equal(p.medEveningTime, undefined);
    assert.equal(p.medNote, '혈압약 식후 30분');
});

test('등급·기저귀·인지·식사형태·성별 값 해석', () => {
    assert.equal(parseCareGrade('1등급'), 'GRADE_1');
    assert.equal(parseCareGrade('5'), 'GRADE_5');
    assert.equal(parseCareGrade('인지지원'), 'COGNITIVE_SUPPORT');
    assert.equal(parseCareGrade('없음'), 'NONE');
    assert.equal(parseCareGrade('6등급'), undefined);
    assert.equal(parseCareGrade(''), undefined);

    assert.equal(parseDiaper('팬티'), 'PANTY');
    assert.equal(parseDiaper('패드'), 'PAD');
    assert.equal(parseDiaper('둘다'), 'BOTH');
    assert.equal(parseDiaper('팬티+패드'), 'BOTH');
    assert.equal(parseDiaper('없음'), 'NONE');

    assert.equal(parseCognition('정상'), 'NORMAL');
    assert.equal(parseCognition('경도'), 'MILD');
    assert.equal(parseCognition('중등도'), 'MODERATE');
    assert.equal(parseCognition('중증'), 'SEVERE');

    assert.equal(parseMealType('일반식'), 'REGULAR');
    assert.equal(parseMealType('다진식'), 'CHOPPED');
    assert.equal(parseMealType('죽'), 'PORRIDGE');
    assert.equal(parseMealType('비빔식'), 'MIXED');

    assert.equal(parseGender('여'), 'FEMALE');
    assert.equal(parseGender('남자'), 'MALE');
    assert.equal(parseGender('F'), 'FEMALE');
    assert.equal(parseGender('무응답'), undefined);
});

test('주민번호가 13자리가 아니면 그 행은 등록하지 않는다', () => {
    const rows = parseElderRows(grid(
        ['이름', '주민번호'],
        ['김복순', '410203-283051'],
        ['박말순', '4102032830514'],
        ['이순자', ''],
    ));
    assert.equal(rows[0].status, 'invalid');
    assert.match(rows[0].message!, /13자리/);
    // 잘못된 번호는 프로필째 보내지 않는다 — 반쪽짜리로 들어가면 나중에 찾기 어렵다
    assert.equal(rows[0].careProfile, undefined);

    assert.equal(rows[1].status, 'ok');
    assert.equal(rows[1].careProfile?.residentNumber, '4102032830514');

    // 케어 열이 비어 있으면 프로필 자체를 만들지 않는다 (빈 프로필 생성 방지)
    assert.equal(rows[2].status, 'ok');
    assert.equal(rows[2].careProfile, undefined);
});

test('층은 숫자만 받는다 (1층/2 모두 허용, 글자는 거부)', () => {
    const rows = parseElderRows(grid(
        ['이름', '층'],
        ['김복순', '1층'],
        ['박말순', '2'],
        ['이순자', '위층'],
    ));
    assert.equal(rows[0].careProfile?.floor, 1);
    assert.equal(rows[1].careProfile?.floor, 2);
    assert.equal(rows[2].status, 'invalid');
    assert.match(rows[2].message!, /층은 숫자/);
});

test('생년월일은 여러 표기를 받는다', () => {
    const rows = parseElderRows(grid(
        ['이름', '생년월일'],
        ['가', '1941-02-03'],
        ['나', '1941.2.3'],
        ['다', '1941년 2월 3일'],
    ));
    assert.equal(rows[0].careProfile?.birthDate, '1941-02-03');
    assert.equal(rows[1].careProfile?.birthDate, '1941-02-03');
    assert.equal(rows[2].careProfile?.birthDate, '1941-02-03');
});

test('기존 검증(빈 이름·중복)은 케어 열이 붙어도 그대로 동작한다', () => {
    const rows = parseElderRows(
        grid(
            ['이름', '주소', '낙상'],
            ['', '서울시 1', 'O'],
            ['김복순', '서울시 2', 'O'],
            ['김복순', '서울시 2', 'X'],
            ['이순자', '서울시 3', ''],
        ),
        [{ id: 1, name: '이순자', homeAddressName: '서울시 3', requiredFrontSeat: false }],
    );
    assert.equal(rows[0].status, 'invalid');
    assert.equal(rows[1].status, 'ok');
    assert.equal(rows[2].status, 'duplicateInFile');
    assert.match(rows[2].message!, /3행/); // 엑셀에서 보이는 행 번호 그대로
    assert.equal(rows[3].status, 'duplicateExisting');
});

test('제목 행이 위에 있어도 헤더를 찾고, 빈 행은 건너뛴다', () => {
    const rows = parseElderRows(grid(
        ['2026년 어르신 명단'],
        [],
        ['이름', '주소', '등급'],
        ['김복순', '서울시 1', '2등급'],
        ['', '', ''],
    ));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rowNumber, 4);
    assert.equal(rows[0].careProfile?.careGrade, 'GRADE_2');
});

test("이름 열이 없으면 읽기를 포기한다", () => {
    assert.throws(() => parseElderRows(grid(['성함', '주소'], ['김복순', '서울'])), /헤더 행을 찾을 수 없습니다/);
});

test('계약의 메모 칸은 모두 엑셀 열이 있다 — 인지 메모가 한 번 빠져 있었다', () => {
    const rows = parseElderRows(grid(
        ['이름', '인지', '인지메모', '기피식품', '목욕비고', '투약메모', '비고'],
        ['김복순', '중등도', '오후에 혼란 심해짐', '복숭아 기피', '방문목욕', '혈압약', '보호자 통화는 저녁에'],
    ));
    assert.equal(rows[0].status, 'ok');
    assert.equal(rows[0].careProfile?.cognitionNote, '오후에 혼란 심해짐');
    assert.equal(rows[0].careProfile?.mealNote, '복숭아 기피');
    assert.equal(rows[0].careProfile?.bathNote, '방문목욕');
    assert.equal(rows[0].careProfile?.medNote, '혈압약');
    assert.equal(rows[0].careProfile?.careNote, '보호자 통화는 저녁에');
});

test('양식에 케어 열이 하나도 빠지지 않는다', () => {
    const headers = TEMPLATE_COLUMNS.map((c) => c.header);
    for (const need of ['주민번호', '등급', '층', '자리', '낙상', '욕창', '기저귀', '인지', '인지메모',
        '식사형태', '오전간식', '오후간식', '저녁식사', '기피식품', '목욕시간', '목욕비고',
        '투약아침', '투약점심', '투약저녁', '투약메모', '차량', '비고']) {
        assert.ok(headers.includes(need), `양식에 '${need}' 열이 없다`);
    }
});

test('이미 등록된 어르신과 이름이 같고 케어 값이 있으면 새로 만들지 않고 채운다', () => {
    const rows = parseElderRows(
        grid(
            ['이름', '주소', '등급', '낙상'],
            ['김복순', '', '3등급', 'O'],          // 주소가 없어도 이름으로 지목한다
            ['박말순', '다른 주소 99', '2등급', ''], // 주소가 달라도 이름이 같으면 채우기
            ['최영자', '서울시 9', '1등급', ''],     // 기존에 없는 이름 — 새로 등록
        ),
        [
            { id: 11, name: '김복순', homeAddressName: '서울시 강남구 1', requiredFrontSeat: false },
            { id: 22, name: '박말순', homeAddressName: '서울시 서초구 2', requiredFrontSeat: false },
        ],
    );
    assert.equal(rows[0].status, 'fillExisting');
    assert.equal(rows[0].existingId, 11);
    assert.equal(rows[0].careProfile?.careGrade, 'GRADE_3');
    assert.equal(rows[0].careProfile?.fallRisk, true);

    assert.equal(rows[1].status, 'fillExisting');
    assert.equal(rows[1].existingId, 22);
    // 엑셀 주소는 읽어 두되 채우기에는 쓰지 않는다 (배차 좌표가 딸린 기존 주소를 덮지 않는다)
    assert.equal(rows[1].homeAddress, '다른 주소 99');

    assert.equal(rows[2].status, 'ok');
    assert.equal(rows[2].existingId, undefined);
});

test('같은 이름이 둘 이상 등록돼 있으면 지목할 수 없어 채우지 않는다', () => {
    const rows = parseElderRows(
        grid(
            ['이름', '주소', '등급'],
            ['김복순', '서울시 1', '3등급'],
        ),
        [
            { id: 11, name: '김복순', homeAddressName: '서울시 1', requiredFrontSeat: false },
            { id: 12, name: '김복순', homeAddressName: '서울시 2', requiredFrontSeat: false },
        ],
    );
    assert.notEqual(rows[0].status, 'fillExisting');
    assert.equal(rows[0].status, 'duplicateExisting');
    assert.equal(rows[0].existingId, undefined);
    assert.match(rows[0].message!, /둘 이상 등록돼 있어 지목할 수 없습니다/);
});

test('이름만 있고 케어 값이 없는 행은 채울 것이 없어 기존 중복 그대로다', () => {
    const rows = parseElderRows(
        grid(
            ['이름', '주소'],
            ['이순자', '서울시 3'],
        ),
        [{ id: 33, name: '이순자', homeAddressName: '서울시 3', requiredFrontSeat: false }],
    );
    assert.equal(rows[0].status, 'duplicateExisting');
    assert.equal(rows[0].existingId, undefined);
    assert.equal(rows[0].careProfile, undefined);
});
