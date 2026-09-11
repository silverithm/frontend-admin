// 엑셀 채우기가 기존 값을 지우지 않는지. 화면 수정은 반대로 덮어써야 한다.
//
// 현장 명단은 시트마다 담는 항목이 다르다. 자리 시트만 올렸다고 투약이 지워지면,
// 화면에는 '미입력'으로만 보여 며칠 뒤에야 알아챈다. 그래서 두 방식을 갈라 두고 여기서 못박는다.
import { want, done, fail } from './_lib.mjs';

const B = process.env.ELDER_BACKEND || 'http://localhost:8090';
const demo = await fetch(`${B}/api/v1/demo/start`, { method: 'POST' }).then((r) => r.json())
  .catch((e) => fail(`백엔드가 안 떠 있다: ${e.message}`));
const H = { Authorization: `Bearer ${demo.tokenInfo.accessToken}`, 'Content-Type': 'application/json' };
const cid = demo.companyId;

const name = `병합검증${Date.now() % 100000}`;
await fetch(`${B}/api/v1/elders/company/${cid}`, { method: 'POST', headers: H, body: JSON.stringify({
  name, careProfile: { careGrade: 'GRADE_3', floor: 1, seatNote: 'TV 앞', bathTime: '9:40-50',
    medMorning: true, medMorningTime: '10시', medNote: '혈압약', diaperType: 'PANTY',
    morningSnack: false, residentNumber: '410203-2830514' } }) });
const list1 = await fetch(`${B}/api/v1/elders/company/${cid}`, { headers: H }).then((r) => r.json());
const me = list1.elders.find((e) => e.name === name);
if (!me) fail('만든 어르신을 못 찾았다');

// 1) 채우기 — 자리만 담은 요청. 투약·목욕·기저귀·간식·주민번호는 그대로여야 한다
await fetch(`${B}/api/v1/elders/company/elder/${me.id}/care-profile?merge=true`, { method: 'PUT', headers: H,
  body: JSON.stringify({ floor: 2, seatNote: '창가' }) });
const after = (await fetch(`${B}/api/v1/elders/company/${cid}`, { headers: H }).then((r) => r.json()))
  .elders.find((e) => e.id === me.id).careProfile;
want(after.floor === 2 && after.seatNote === '창가', `채우기가 자리를 안 바꿨다: ${after.floor}/${after.seatNote}`);
want(after.medMorning === true, '채우기가 투약을 지웠다');
want(after.medMorningTime === '10시', `채우기가 투약 시간을 지웠다: ${after.medMorningTime}`);
want(after.medNote === '혈압약', '채우기가 투약 메모를 지웠다');
want(after.bathTime === '9:40-50', '채우기가 목욕 시간을 지웠다');
want(after.diaperType === 'PANTY', '채우기가 기저귀를 지웠다');
want(after.careGrade === 'GRADE_3', '채우기가 등급을 지웠다');
want(after.morningSnack === false, '채우기가 오전간식 X를 되돌렸다');
want(after.residentNumberMasked === '410203-2******', '채우기가 주민번호를 지웠다');

// 2) 화면 수정(merge 없음) — 담지 않은 항목은 지워져야 한다. 안 그러면 스위치를 못 끈다
await fetch(`${B}/api/v1/elders/company/elder/${me.id}/care-profile`, { method: 'PUT', headers: H,
  body: JSON.stringify({ floor: 2, seatNote: '창가' }) });
const replaced = (await fetch(`${B}/api/v1/elders/company/${cid}`, { headers: H }).then((r) => r.json()))
  .elders.find((e) => e.id === me.id).careProfile;
want(replaced.medMorning === false, '덮어쓰기인데 투약이 남았다 — 화면에서 스위치를 끌 수 없게 된다');
want(replaced.bathTime === null, `덮어쓰기인데 목욕 시간이 남았다: ${replaced.bathTime}`);
want(replaced.residentNumberMasked === '410203-2******', '덮어쓰기가 주민번호를 지웠다 — 안 보낸 주민번호는 유지여야 한다');

await fetch(`${B}/api/v1/elders/company/elder/${me.id}`, { method: 'DELETE', headers: H });
done('ELDER_CARE_MERGE_OK');
