// G12a: 역할별 인원 집계가 관리자(app_user)를 포함하는지.
// 사장님 계정은 시설장인데 0명으로 나왔다 — 직원(members)만 세고 있었다.
import { WEB, read, want, done } from './_lib.mjs';

const api = read(`${WEB}/src/lib/apiService.ts`);
want(/includeAdmins=true/.test(api), '관리자를 포함해 회원을 받아오는 경로가 없다');
want(/export async function getMembersIncludingAdmins/.test(api),
     '관리자 포함 조회에 이름이 없다 — 일정 담당자 전용 함수를 돌려쓰면 의도가 안 드러난다');

const pm = read(`${WEB}/src/components/PositionManagement.tsx`);

// 인원을 세는 목록이 관리자 포함 경로에서 온다
want(/getMembersIncludingAdmins\(\)/.test(pm), '역할관리가 관리자 포함 목록을 불러오지 않는다');
want(!/getMemberUsers\(\)/.test(pm), '직원만 받는 옛 경로가 아직 남아 있다');
want(/const getMemberCountForPosition[\s\S]{0,200}?members\.filter/.test(pm),
     '인원 집계가 members 상태를 세지 않는다 — 위 목록과 연결이 끊겼다');

// 관리자와 직원은 id가 겹친다. 배정을 그대로 열어 두면 엉뚱한 직원이 바뀐다(V1.88).
want(/facility_admin/.test(pm), '관리자 구분자가 없다');
want(/key=\{`\$\{member\.role\}-\$\{member\.id\}`\}/.test(pm),
     '목록 키가 id뿐이다 — 관리자와 직원의 id가 겹치면 행이 사라진다');
want(/isFacilityAdmin\(member\)\s*\?/.test(pm),
     '관리자 행에도 역할 배정 입력이 열려 있다 — 같은 번호의 직원 역할이 바뀐다');

done('role-count-ok');
