/**
 * 월간일정 '일정 필터' — `node --test src/lib/scheduleFilter.test.ts`
 *
 * 여기서 못 박는 것:
 * - 담당자로 고르면 일정 담당자·할 일 담당자 어느 쪽이든 잡히고, 참석자만인 일정은 안 잡힌다
 * - 직원 9번과 관리자 9번은 다른 사람이다
 * - 구분과 담당자를 같이 고르면 둘 다 맞아야 보인다(같은 묶음 안은 하나만 맞아도)
 * - 서버가 실어 보내는 빈 label({id:null})도 '구분 없음'으로 잡힌다
 * - 담당자 목록은 이름순, 완료 수는 일정 단위, 골라 둔 사람은 이번 달에 없어도 남는다
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
    collectPersonOptions,
    matchesScheduleFilter,
    personFilterValue,
    labelFilterValue,
    MY_SCHEDULES_FILTER,
    NO_LABEL_FILTER,
    type FilterableSchedule,
} from "./scheduleFilter.ts";

interface S extends FilterableSchedule {
    id: string;
    participants?: { memberId: number }[];
}

const bath: S = {
    id: "bath",
    label: { id: 7 },
    managerId: 9,
    managerType: "MEMBER",
    managerName: "김요양",
    isCompleted: true,
};
const program: S = {
    id: "program",
    label: { id: 8 },
    managerId: 3,
    managerType: "ADMIN",
    managerName: "박원장",
    tasks: [
        { assigneeMemberId: 9, assigneeName: "김요양" },
        { assigneeMemberId: 12, assigneeName: "이사회" },
    ],
};
// 서버는 구분 없는 일정에도 빈 label을 붙여 보낸다
const meeting: S = { id: "meeting", label: { id: null }, participants: [{ memberId: 9 }] };
const legacy: S = { id: "legacy", label: null, managerId: 12, managerName: "이사회", isCompleted: true };
const all = [bath, program, meeting, legacy];

const nobodyIsMe = () => false;
const ids = (values: string[], isMine: (s: FilterableSchedule) => boolean = nobodyIsMe) =>
    all.filter((s) => matchesScheduleFilter(s, values, isMine)).map((s) => s.id);

test("아무것도 안 고르면 전부 보인다", () => {
    assert.deepEqual(ids([]), ["bath", "program", "meeting", "legacy"]);
});

test("담당자 — 일정 담당자와 할 일 담당자 둘 다 잡고, 참석자만인 일정은 뺀다", () => {
    assert.deepEqual(ids([personFilterValue("MEMBER:9")]), ["bath", "program"]);
    assert.deepEqual(ids([personFilterValue("MEMBER:12")]), ["program", "legacy"]);
});

test("직원 3번과 관리자 3번은 다른 사람", () => {
    assert.deepEqual(ids([personFilterValue("ADMIN:3")]), ["program"]);
    assert.deepEqual(ids([personFilterValue("MEMBER:3")]), []);
});

test("같은 묶음 안은 하나만 맞아도 보인다", () => {
    assert.deepEqual(ids([personFilterValue("MEMBER:9"), personFilterValue("ADMIN:3")]), ["bath", "program"]);
    assert.deepEqual(ids([labelFilterValue(7), labelFilterValue(8)]), ["bath", "program"]);
});

test("구분과 담당자를 같이 고르면 둘 다 맞아야 보인다", () => {
    assert.deepEqual(ids([labelFilterValue(7), personFilterValue("MEMBER:12")]), []);
    assert.deepEqual(ids([labelFilterValue(8), personFilterValue("MEMBER:9")]), ["program"]);
});

test("'구분 없음'은 label이 없거나 id가 빈 일정", () => {
    assert.deepEqual(ids([NO_LABEL_FILTER]), ["meeting", "legacy"]);
});

test("'나'는 화면이 넘긴 판정을 쓴다", () => {
    const mine = (s: FilterableSchedule) => !!(s as S).participants?.some((p) => p.memberId === 9);
    assert.deepEqual(ids([MY_SCHEDULES_FILTER], mine), ["meeting"]);
    assert.deepEqual(ids([MY_SCHEDULES_FILTER, personFilterValue("MEMBER:12")], mine), ["program", "meeting", "legacy"]);
});

test("모르는 값만 남아 있으면 거르지 않는다", () => {
    assert.deepEqual(ids(["something-old"]), ["bath", "program", "meeting", "legacy"]);
});

test("담당자 목록 — 이름순, 일정 단위 완료 수", () => {
    assert.deepEqual(collectPersonOptions(all, []), [
        { key: "MEMBER:9", name: "김요양", total: 2, done: 1 },
        { key: "ADMIN:3", name: "박원장", total: 1, done: 0 },
        { key: "MEMBER:12", name: "이사회", total: 2, done: 1 },
    ]);
});

test("골라 둔 사람은 이번 달에 맡은 일정이 없어도 남는다", () => {
    const options = collectPersonOptions([bath], [personFilterValue("MEMBER:40")], (key) =>
        key === "MEMBER:40" ? "최간호" : undefined,
    );
    assert.deepEqual(options, [
        { key: "MEMBER:9", name: "김요양", total: 1, done: 1 },
        { key: "MEMBER:40", name: "최간호", total: 0, done: 0 },
    ]);
    assert.equal(collectPersonOptions([], [personFilterValue("MEMBER:41")])[0].name, "이름 없음");
});
