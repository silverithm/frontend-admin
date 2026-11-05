import test from "node:test";
import assert from "node:assert/strict";

import { normalizeEditorHtml } from "./richText.ts";

test("블록 끝의 가짜 <br>는 지운다", () => {
    assert.equal(
        normalizeEditorHtml("<div>첫째<br></div><div>둘째<br></div>"),
        "<div>첫째</div><div>둘째</div>",
    );
    assert.equal(normalizeEditorHtml("<p>가<br/></p><p>나</p>"), "<p>가</p><p>나</p>");
    assert.equal(normalizeEditorHtml("<li>가<br></li><li>나</li>"), "<li>가</li><li>나</li>");
});

test("내용이 <br> 하나뿐인 블록은 일부러 넣은 빈 줄이므로 보존한다", () => {
    assert.equal(
        normalizeEditorHtml("<div>첫째</div><div><br></div><div>둘째</div>"),
        "<div>첫째</div><div><br></div><div>둘째</div>",
    );
    assert.equal(
        normalizeEditorHtml("<div>첫째<br></div><div><br></div><div>둘째<br></div>"),
        "<div>첫째</div><div><br></div><div>둘째</div>",
    );
});

test("문서 끝의 빈 꼬리는 지운다", () => {
    assert.equal(normalizeEditorHtml("<div>첫째</div><div><br></div>"), "<div>첫째</div>");
    assert.equal(normalizeEditorHtml("<div>첫째</div><p><br></p>"), "<div>첫째</div>");
    assert.equal(normalizeEditorHtml("<div>첫째</div><div></div><p></p>  "), "<div>첫째</div>");
    assert.equal(normalizeEditorHtml("<div>첫째</div><div><br></div><div><br></div>"), "<div>첫째</div>");
});

test("끝에 <br><br>만 있으면 지운다", () => {
    assert.equal(normalizeEditorHtml("내용<br><br>"), "내용");
    assert.equal(normalizeEditorHtml("내용<br> <br>\n"), "내용");
});

test("블록 밖의 <br>는 줄바꿈이므로 그대로 둔다", () => {
    assert.equal(normalizeEditorHtml("첫째<br>둘째"), "첫째<br>둘째");
    assert.equal(normalizeEditorHtml("첫째<br><br>둘째"), "첫째<br><br>둘째");
});

test("글자와 서식 태그는 건드리지 않는다", () => {
    const kept = '<div><b>굵게</b> <span style="color:#ff0000">빨강</span></div><ul><li>하나</li></ul>';
    assert.equal(normalizeEditorHtml(kept), kept);
    assert.equal(
        normalizeEditorHtml('<div><a href="https://a.b">링크</a><br></div>'),
        '<div><a href="https://a.b">링크</a></div>',
    );
});

test("중첩·연속이 있어도 안쪽까지 훑는다", () => {
    assert.equal(
        normalizeEditorHtml("<blockquote><div>가<br></div><br></blockquote>"),
        "<blockquote><div>가</div></blockquote>",
    );
    // 글자 뒤의 <br>만 가짜 — 그 앞의 연속 <br>는 사용자가 만든 빈 줄이라 남긴다
    assert.equal(normalizeEditorHtml("<div>가<br><br></div>"), "<div>가<br><br></div>");
});

test("빈 값과 통째로 빈 문서", () => {
    assert.equal(normalizeEditorHtml(""), "");
    assert.equal(normalizeEditorHtml("<div><br></div>"), "");
    assert.equal(normalizeEditorHtml("<br>"), "");
});

test("멱등 — 두 번 돌려도 결과가 같다", () => {
    const inputs = [
        "",
        "<div>첫째<br></div><div>둘째<br></div>",
        "<div>첫째</div><div><br></div><div>둘째</div><div><br></div>",
        "내용<br><br>",
        "첫째<br>둘째",
        "<div>가<br><br><br></div>",
        "<blockquote><div>가<br></div><br></blockquote>",
        '<div><b>굵게</b><br></div><ul><li>하나<br></li></ul><div><br></div>',
        "<p>가</p>",
    ];
    for (const input of inputs) {
        const once = normalizeEditorHtml(input);
        assert.equal(normalizeEditorHtml(once), once, `멱등 실패: ${input}`);
    }
});
