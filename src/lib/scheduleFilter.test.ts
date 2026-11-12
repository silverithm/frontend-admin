/**
 * 월간일정 '일정 필터' — `node --test src/lib/scheduleFilter.test.ts`
 *
 * 여기서 못 박는 것:
 * - 담당자로 고르면 일정 담당자·할 일 담당자 어느 쪽이든 잡히고, 참석자만인 일정은 안 잡힌다
 * - 직원 9번과 관리자 9번은 다른 사람이다
 * - 구분과 담당자를 같이 고르면 둘 다 맞아야 보인다(같은 묶음 안은 하나만 맞아도)
 * - 서버가 실어 보내는 빈 label({id:null})도 '구분 없음'으로 잡힌다
 * - 담당자 목록은 이름순, 완료 수는 일정 단위, 골라 둔 사람은 이번 달에 없어도 남는다
 * - 일정 탭(월간·연간)의 '나': 작성자·담당자·할 일 담당·참석자. 관리자 번호를 직원 번호로 읽지 않는다
 * - 저장 키는 기관별, 깨진 저장값은 전체 보기로 읽는다
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
    collectPersonOptions,
    isMineOnScheduleTab,
    matchesScheduleFilter,
    parseStoredScheduleFilter,
    readScheduleViewer,
    scheduleFilterStorageKey,
    personFilterValue,
    labelFilterValue,
    scheduleFilterButtonLabel,
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

test("단추 글자 — 한 사람만 고르면 이름, 그 밖에는 개수", () => {
    assert.equal(scheduleFilterButtonLabel([], all), "일정 필터");
    assert.equal(scheduleFilterButtonLabel([personFilterValue("MEMBER:9")], all), "일정 필터 · 김요양");
    assert.equal(scheduleFilterButtonLabel([MY_SCHEDULES_FILTER], all), "일정 필터 · 나");
    assert.equal(scheduleFilterButtonLabel([labelFilterValue(7)], all), "일정 필터 (1)");
    assert.equal(scheduleFilterButtonLabel([personFilterValue("MEMBER:9"), labelFilterValue(7)], all), "일정 필터 (2)");
});

// ── 일정 탭(월간·연간)의 '나' ──

const storage = (values: Record<string, string>) => (key: string) => values[key] ?? null;

test("직원 로그인의 userId는 직원 번호, 관리자 로그인의 userId는 관리자 번호로만 읽는다", () => {
    assert.deepEqual(
        readScheduleViewer(storage({ userId: "9", loginType: "employee", userEmail: "kim@example.com" })),
        { email: "kim@example.com", memberId: 9, adminId: null },
    );
    assert.deepEqual(
        readScheduleViewer(storage({ userId: "9", loginType: "admin", userEmail: "boss@example.com" })),
        { email: "boss@example.com", memberId: null, adminId: 9 },
    );
    // 번호가 없거나 숫자가 아니면 아무도 아니다
    assert.deepEqual(readScheduleViewer(storage({ loginType: "employee" })), { email: "", memberId: null, adminId: null });
    assert.deepEqual(readScheduleViewer(storage({ userId: "abc" })), { email: "", memberId: null, adminId: null });
});

test("일정 탭의 '나'는 작성자·담당자·할 일 담당·참석자 어느 쪽이든 잡힌다", () => {
    const me = { email: "kim@example.com", memberId: 9, adminId: null };
    assert.equal(isMineOnScheduleTab({ authorId: "kim@example.com" }, me), true);
    assert.equal(isMineOnScheduleTab({ managerId: 9, managerType: "MEMBER" }, me), true);
    assert.equal(isMineOnScheduleTab({ managerId: 9 }, me), true); // 종류가 비어 있으면 직원으로 본다
    assert.equal(isMineOnScheduleTab({ tasks: [{ assigneeMemberId: 9 }] }, me), true);
    assert.equal(isMineOnScheduleTab({ participants: [{ memberId: 9 }] }, me), true);
    assert.equal(isMineOnScheduleTab({ participants: [{ userId: "9" }] }, me), true);
    assert.equal(isMineOnScheduleTab({ authorId: "lee@example.com", managerId: 10, managerType: "MEMBER" }, me), false);
    assert.equal(isMineOnScheduleTab({}, me), false);
});

test("관리자 9번은 직원 9번의 일정을 자기 것으로 보지 않는다(그 반대도)", () => {
    const admin = { email: "boss@example.com", memberId: null, adminId: 9 };
    const member = { email: "kim@example.com", memberId: 9, adminId: null };
    const memberJob = { managerId: 9, managerType: "MEMBER", tasks: [{ assigneeMemberId: 9 }], participants: [{ memberId: 9 }] };
    const adminJob = { managerId: 9, managerType: "ADMIN" };
    assert.equal(isMineOnScheduleTab(memberJob, admin), false);
    assert.equal(isMineOnScheduleTab(adminJob, admin), true);
    assert.equal(isMineOnScheduleTab(adminJob, member), false);
    assert.equal(isMineOnScheduleTab(memberJob, member), true);
    // 로그인 정보가 없으면(이메일도 빈 값) 작성자 없는 일정이 '나'로 잡히지 않는다
    assert.equal(isMineOnScheduleTab({ authorId: "" }, { email: "", memberId: null, adminId: null }), false);
});

test("저장 키는 기관별이고, 깨진 저장값은 전체 보기로 읽는다", () => {
    assert.equal(scheduleFilterStorageKey("12"), "carev.scheduleFilter.12");
    assert.equal(scheduleFilterStorageKey(null), null);
    assert.equal(scheduleFilterStorageKey(""), null);
    assert.deepEqual(parseStoredScheduleFilter('["myTasks","person:MEMBER:9"]'), ["myTasks", "person:MEMBER:9"]);
    assert.deepEqual(parseStoredScheduleFilter(null), []);
    assert.deepEqual(parseStoredScheduleFilter("{깨짐"), []);
    assert.deepEqual(parseStoredScheduleFilter('{"a":1}'), []);
    assert.deepEqual(parseStoredScheduleFilter('["label:7", 3, null]'), ["label:7"]);
});
