// G9: 케어 정보가 등록→목록→수정→주민번호 열람→삭제까지 실제로 왕복하는지.
//
// 로컬 백엔드(8090, 체험 테넌트) 앞에 워크트리 웹 프록시(3017)를 두고, 화면이 부르는 경로
// 그대로 부른다 — 프록시 라우트가 빠져 404 HTML이 돌아오는 사고가 반복됐기 때문이다.
import { want, done, fail } from './_lib.mjs';

const BACKEND = process.env.ELDER_BACKEND || 'http://localhost:8090';
const WEB = process.env.ELDER_WEB || 'http://localhost:3017';

const demo = await fetch(`${BACKEND}/api/v1/demo/start`, { method: 'POST' }).then((r) => r.json()).catch((e) => fail(`백엔드가 안 떠 있다: ${e.message}`));
const token = demo?.tokenInfo?.accessToken;
const companyId = demo?.companyId;
if (!token || !companyId) fail(`체험 토큰을 못 받았다: ${JSON.stringify(demo).slice(0, 200)}`);
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function call(method, path, body) {
  const res = await fetch(`${WEB}${path}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML이면 프록시 라우트 누락 */ }
  return { status: res.status, json, text };
}

const marker = `검증어르신${Date.now() % 100000}`;
// 1) 등록 — 케어 정보 포함
const created = await call('POST', `/api/v1/elders/company?companyId=${companyId}`, {
  name: marker, homeAddress: '서울 중구', requiredFrontSeat: false,
  careProfile: {
    residentNumber: '410203-2830514', careGrade: 'GRADE_3', fallRisk: true, fallNote: '보행기 사용',
    diaperType: 'PANTY', diaperIntermittent: true, cognitionLevel: 'MILD', mealType: 'CHOPPED',
    morningSnack: false, afternoonSnack: true, dinner: true, mealNote: '복숭아 기피',
    bathTime: '9:40-50', medMorning: true, medMorningTime: '10시', medEvening: true,
    vehicleNote: '1호차', floor: 1, seatNote: 'TV 앞 좌측',
  },
});
want(created.status === 200, `등록 실패 ${created.status}: ${created.text.slice(0, 200)}`);

// 2) 목록 — 마스킹·파생값·원문 미노출
const list = await call('GET', `/api/v1/elders/company?companyId=${companyId}`);
want(list.json && Array.isArray(list.json.elders), `목록 응답이 {elders:[]}가 아니다: ${list.text.slice(0, 120)}`);
const me = list.json?.elders?.find((e) => e.name === marker);
want(!!me, '등록한 어르신이 목록에 없다');
const p = me?.careProfile;
want(p?.residentNumberMasked === '410203-2******', `마스킹이 틀리다: ${p?.residentNumberMasked}`);
want(!('residentNumber' in (p || {})) || p.residentNumber == null, '목록 응답에 주민번호 원문이 실려 있다');
want(!list.text.includes('2830514'), '목록 응답 본문 어딘가에 주민번호 뒷자리가 노출된다');
want(p?.birthDate === '1941-02-03' && p?.gender === 'FEMALE', `생년월일·성별 파생이 틀리다: ${p?.birthDate} ${p?.gender}`);
want(typeof p?.age === 'number' && p.age >= 84, `나이가 계산되지 않았다: ${p?.age}`);
want(p?.medMorningTime === '10시' && p?.medEvening === true && p?.morningSnack === false, '투약·간식 값이 그대로 돌아오지 않았다');
want(p?.floor === 1 && p?.seatNote === 'TV 앞 좌측' && p?.mealNote === '복숭아 기피', '자리·식사 메모가 그대로 돌아오지 않았다');

// 3) 케어 정보만 수정 — 주민번호는 안 보내도 유지돼야 한다
const upd = await call('PUT', `/api/v1/elders/company/elder/${me?.id}/care-profile`, {
  careGrade: 'GRADE_2', fallRisk: false, medMorning: false, medEvening: true, floor: 2, seatNote: '창가',
  morningSnack: true, afternoonSnack: true, dinner: false,
});
want(upd.status === 200, `케어 정보 수정 실패 ${upd.status}: ${upd.text.slice(0, 200)}`);
const u = upd.json?.careProfile ?? upd.json;
want(u?.careGrade === 'GRADE_2' && u?.floor === 2 && u?.dinner === false, `수정값이 반영되지 않았다: ${upd.text.slice(0, 200)}`);
want(u?.residentNumberMasked === '410203-2******', '케어 정보만 고쳤는데 주민번호가 사라졌다');

// 4) 이름 수정(PUT elder) — careProfile 없이 보내면 프로필이 남아야 한다
const rename = await call('PUT', `/api/v1/elders/company/elder/${me?.id}`, { name: `${marker}2`, homeAddress: '서울 중구', requiredFrontSeat: false });
want(rename.status === 200, `이름 수정 실패 ${rename.status}`);
const after = await call('GET', `/api/v1/elders/company?companyId=${companyId}`);
const me2 = after.json?.elders?.find((e) => e.id === me?.id);
want(me2?.careProfile?.careGrade === 'GRADE_2', '이름만 고쳤는데 케어 정보가 지워졌다');

// 5) 주민번호 전체 열람 — 체험 관리자는 AppUser라 허용
const reveal = await call('GET', `/api/v1/elders/company/elder/${me?.id}/resident-number`);
want(reveal.status === 200 && reveal.json?.residentNumber === '4102032830514', `주민번호 열람 실패 ${reveal.status}: ${reveal.text.slice(0, 120)}`);

// 6) 삭제 — 기관 검증 경로로, 목록에서 사라져야 한다
const del = await call('DELETE', `/api/v1/elders/company/elder/${me?.id}`);
want(del.status === 200, `삭제 실패 ${del.status}: ${del.text.slice(0, 120)}`);
const gone = await call('GET', `/api/v1/elders/company?companyId=${companyId}`);
want(!gone.json?.elders?.some((e) => e.id === me?.id), '삭제했는데 목록에 남아 있다');

// 7) 잘못된 주민번호는 400
const bad = await call('POST', `/api/v1/elders/company?companyId=${companyId}`, { name: `${marker}x`, careProfile: { residentNumber: '12345' } });
want(bad.status === 400, `13자리가 아닌 주민번호가 거절되지 않았다: ${bad.status}`);

done('ELDER_CARE_E2E_OK');
