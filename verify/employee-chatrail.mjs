// G11a: 직원 화면에도 채팅 레일이 붙었는지. 관리자에만 있었다.
//
// 렌더만 확인하면 부족하다. 레일은 폭 264px의 flex 형제라, 본문과 같은 '행'에 서지
// 않으면 세로로 깔려 사실상 안 보인다. 그래서 행 래퍼와 그 CSS 규칙까지 본다.
import { WEB, read, want, done } from './_lib.mjs';

const admin = read(`${WEB}/src/app/admin/page.tsx`);
want(/<ChatRail/.test(admin), '기준으로 삼을 관리자 화면 ChatRail이 없다');

const employee = read(`${WEB}/src/app/employee/page.tsx`);
want(/<ChatRail/.test(employee), '직원 화면이 ChatRail을 렌더하지 않는다');

// 본문과 레일이 한 행에 서는가
const bodyClass = /className="carev-emp-body"/.test(employee);
want(bodyClass, '직원 화면에 본문+레일 행 래퍼(carev-emp-body)가 없다 — 레일이 아래로 깔린다');

const css = read(`${WEB}/src/app/globals.css`);
const rowRule = /\.carev-emp-body\s*(?:,[^{]*)?\{[^}]*display:\s*flex/.test(css)
  || /\.carev-admin-body,\s*\n?\.carev-emp-body\s*\{[^}]*display:\s*flex/.test(css);
want(rowRule, 'carev-emp-body가 display:flex 행이 아니다');

// 채팅 탭에서 중복되지 않게 숨기고, 레일에서 연 방을 채팅 탭이 이어받는가
want(/hidden=\{activeMainTab === 'chat'\}/.test(employee), '채팅 탭에서 레일을 숨기지 않는다 — 같은 목록이 두 번 나온다');
want(/initialRoomId=\{railRoomId\}/.test(employee), '레일에서 연 방을 채팅 탭이 이어받지 않는다');
want(/onUnreadChange=\{setChatUnread\}/.test(employee), '안 읽음 수가 셸로 올라오지 않는다');

// 플로팅 버튼과 레일이 같이 뜨면 채팅 입구가 둘이 된다
want(!/<FloatingChat\s*\/>/.test(employee), '플로팅 채팅 위젯이 레일과 함께 남아 있다 — 입구가 둘이다');

done('employee-chatrail-ok');
