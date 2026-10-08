/** 결재 승인 의견 정리 규칙 — `node --test src/lib/approvalComment.test.ts` */
import test from "node:test";
import assert from "node:assert/strict";

import {
    APPROVAL_COMMENT_MAX_LENGTH,
    buildApproveBody,
    isApprovalCommentTooLong,
    normalizeApprovalComment,
} from "./approvalComment.ts";

test("앞뒤 공백을 지우고, 비면 undefined", () => {
    assert.equal(normalizeApprovalComment("  확인했습니다 \n"), "확인했습니다");
    assert.equal(normalizeApprovalComment("   "), undefined);
    assert.equal(normalizeApprovalComment(null), undefined);
    assert.equal(normalizeApprovalComment(undefined), undefined);
});

test("1000자까지는 통과, 넘으면 초과", () => {
    assert.equal(isApprovalCommentTooLong("가".repeat(APPROVAL_COMMENT_MAX_LENGTH)), false);
    assert.equal(isApprovalCommentTooLong("가".repeat(APPROVAL_COMMENT_MAX_LENGTH + 1)), true);
    // 공백 패딩은 세지 않는다
    assert.equal(isApprovalCommentTooLong(` ${"가".repeat(APPROVAL_COMMENT_MAX_LENGTH)} `), false);
});

test("승인 본문: 서명·의견이 없으면 본문 없음", () => {
    assert.equal(buildApproveBody(), undefined);
    assert.equal(buildApproveBody({ comment: "  " }), undefined);
});

test("승인 본문: 의견만, 서명만, 둘 다", () => {
    assert.deepEqual(buildApproveBody({ comment: " 검토 완료 " }), { comment: "검토 완료" });
    assert.deepEqual(buildApproveBody({ signatureBase64: "data:x" }), { signatureBase64: "data:x" });
    assert.deepEqual(
        buildApproveBody({ signatureBase64: "data:x", comment: "ok" }),
        { signatureBase64: "data:x", comment: "ok" },
    );
});
