// G13a: 대시보드에 수급자·종사자 현황 카드가 있는지.
import { WEB, read, want, done } from './_lib.mjs';

const src = read(`${WEB}/src/components/AdminDashboard.tsx`);
want(/수급자/.test(src), '수급자 카드가 없다');
want(/종사자/.test(src), '종사자 카드가 없다');
for (const w of ['출석', '결석', '근무', '휴무']) {
  want(new RegExp(w).test(src), `현황 카드에 "${w}"가 없다`);
}
// 총원이 두 카드 모두에 있어야 한다.
want((src.match(/총원/g) || []).length >= 2, '총원이 두 카드에 모두 있지 않다');

done('dashboard-cards-ok');
