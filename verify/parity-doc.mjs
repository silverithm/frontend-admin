// G10a: 앱·웹 기능 대조표가 근거와 함께 작성됐는지.
// "차이 없음"만 적힌 문서는 조사한 것이 아니다.
import { WEB, read, want, done } from './_lib.mjs';

const doc = read(`${WEB}/PARITY.md`);
for (const screen of ['홈', '채팅', '일정', '전자결재']) {
  want(new RegExp(screen).test(doc), `대조표에 ${screen} 화면이 없다`);
}
// 각 항목에 근거 파일 경로가 있어야 한다. 최소 12개.
const refs = doc.match(/(lib\/[\w/.-]+\.dart|src\/[\w/.-]+\.tsx?)(:\d+)?/g) || [];
want(refs.length >= 12,
     `근거 파일 경로가 ${refs.length}개뿐이다 — 코드로 확인한 조사가 아니다`);

done('parity-doc-ok');
