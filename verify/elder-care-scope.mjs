// 어르신 케어 정보의 기관 경계와 '최종 수정' 시각이 지켜지는지.
//
// 완결성 감사에서 나온 구멍들이다: 생성·대량등록에만 기관 검증이 빠져 있어 인증만 되면
// 남의 기관에 어르신을 심을 수 있었고, 수정 응답의 updatedAt이 flush 전 값이라
// 앱 상세의 '최종 수정'이 한 박자 늦게 보였다. 로컬 백엔드(8090)가 떠 있어야 돈다.
const B='http://localhost:8090';
const a = await fetch(`${B}/api/v1/demo/start`,{method:'POST'}).then(r=>r.json());
const b = await fetch(`${B}/api/v1/demo/start`,{method:'POST'}).then(r=>r.json());
const H = t => ({Authorization:`Bearer ${t.tokenInfo.accessToken}`,'Content-Type':'application/json'});
const bad=[];

// 1) 남의 기관에 어르신 생성 차단 (POST)
let r = await fetch(`${B}/api/v1/elders/company/${b.companyId}`,{method:'POST',headers:H(a),body:JSON.stringify({name:'침입자'})});
if (r.status !== 403) bad.push(`POST 타기관 생성이 막히지 않았다: ${r.status}`);

// 2) 남의 기관에 대량등록 차단 (bulk)
r = await fetch(`${B}/api/v1/elders/company/${b.companyId}/bulk`,{method:'POST',headers:H(a),body:JSON.stringify([{name:'침입자2'}])});
if (r.status !== 403) bad.push(`bulk 타기관 등록이 막히지 않았다: ${r.status}`);

// 3) 자기 기관 생성은 여전히 된다
r = await fetch(`${B}/api/v1/elders/company/${a.companyId}`,{method:'POST',headers:H(a),body:JSON.stringify({name:'정상등록',careProfile:{careGrade:'GRADE_3',cognitionNote:'오후에 혼란'}})});
if (!r.ok) bad.push(`자기 기관 생성이 막혔다: ${r.status} ${(await r.text()).slice(0,120)}`);

// 4) 수정 응답의 최종 수정 시각이 갱신된 값인지
const list = await fetch(`${B}/api/v1/elders/company/${a.companyId}`,{headers:H(a)}).then(r=>r.json());
const me = list.elders.find(e=>e.name==='정상등록');
if (!me) bad.push('방금 만든 어르신이 목록에 없다');
else {
  if (me.careProfile?.cognitionNote !== '오후에 혼란') bad.push(`인지 메모가 저장되지 않았다: ${me.careProfile?.cognitionNote}`);
  const before = me.careProfile?.updatedAt;
  await new Promise(r=>setTimeout(r,1100));
  const put = await fetch(`${B}/api/v1/elders/company/elder/${me.id}/care-profile`,{method:'PUT',headers:H(a),body:JSON.stringify({careGrade:'GRADE_2'})}).then(r=>r.json());
  const after = (put.careProfile ?? put)?.updatedAt;
  const reread = await fetch(`${B}/api/v1/elders/company/${a.companyId}`,{headers:H(a)}).then(r=>r.json());
  const fresh = reread.elders.find(e=>e.id===me.id)?.careProfile?.updatedAt;
  if (after === before) bad.push(`수정 응답의 최종 수정 시각이 갱신 전 값이다: ${after}`);
  // 응답은 메모리의 나노초, 재조회는 DATETIME(6)의 마이크로초라 문자열이 다르다 — 같은 순간인지만 본다
  const ms = (t) => Date.parse(String(t).replace(/(\.\d{3})\d+$/, '$1'));
  if (Math.abs(ms(after) - ms(fresh)) > 1) {
    bad.push(`수정 응답(${after})과 재조회(${fresh})의 최종 수정 시각이 다르다`);
  }
  await fetch(`${B}/api/v1/elders/company/elder/${me.id}`,{method:'DELETE',headers:H(a)});
}

if (bad.length) { for (const m of bad) console.error('FAIL '+m); process.exit(1); }
console.log('FIXES_OK');
