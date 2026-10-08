import test from "node:test";
import assert from "node:assert/strict";

import { toEditorHtml } from "./noticeContent.ts";

test("평문 공지는 줄바꿈을 <br>로 살리고 꺾쇠를 이스케이프한다", () => {
    assert.equal(toEditorHtml("첫째\r\n둘째\n셋째"), "첫째<br>둘째<br>셋째");
    assert.equal(toEditorHtml("a < b & c"), "a &lt; b &amp; c");
});

test("이미 HTML이면 그대로 둔다", () => {
    assert.equal(toEditorHtml("<p>안녕</p>"), "<p>안녕</p>");
});

test("빈 값은 빈 문자열", () => {
    assert.equal(toEditorHtml(""), "");
});
