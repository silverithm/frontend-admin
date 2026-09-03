// G20: 열람 대상이 지정된 결재 양식을 고칠 때 500이 나지 않는지.
//
// 원인: applyDefaultViewers가 clear() 후 addAll()이었다. 한 번의 flush 안에서 Hibernate가
// INSERT를 DELETE보다 먼저 내보내므로, 유지되는 열람자가 있으면 유니크 키에 걸린다.
//   Duplicate entry '217-POSITION-79' for key 'approval_template_viewers.uk_approval_template_viewers'
// 운영에서 실제로 재현했고 로그로 확인했다.
import { readFileSync, existsSync } from 'node:fs';
import { want, done } from './_lib.mjs';

const API = '/Users/gimjunhyeong/Develop/silverithm/api-server';
const f = `${API}/src/main/java/com/silverithm/vehicleplacementsystem/service/ApprovalTemplateService.java`;
want(existsSync(f), '양식 서비스 파일을 못 찾았다');
const src = readFileSync(f, 'utf8');

// applyDefaultViewers 본문만 떼어 본다 — 파일 다른 곳의 clear()에 걸리지 않게.
const start = src.indexOf('private void applyDefaultViewers');
want(start > 0, 'applyDefaultViewers를 못 찾았다');
const body = src.slice(start, src.indexOf('\n    }', start));

want(!/getDefaultViewers\(\)\.clear\(\)/.test(body),
     '열람자를 통째로 지우고 다시 넣는다 — 유지되는 열람자가 있으면 유니크 키에 걸려 500이 난다');
want(/removeIf/.test(body),
     '빠진 열람자만 골라 지우지 않는다');
want(/existing\.contains|existing\.add/.test(body),
     '이미 있는 열람자를 건너뛰는 처리가 없다 — 그대로 두는 행을 다시 넣으면 중복이다');

// 유니크 키가 실제로 있어야 이 게이트가 지키는 대상이 존재한다
const mig = `${API}/src/main/resources/db/migration`;
let hasUk = false;
if (existsSync(mig)) {
    const { readdirSync } = await import('node:fs');
    for (const name of readdirSync(mig)) {
        const t = readFileSync(`${mig}/${name}`, 'utf8');
        if (/uk_approval_template_viewers/i.test(t)) { hasUk = true; break; }
    }
}
want(hasUk, '유니크 키 uk_approval_template_viewers를 만드는 마이그레이션을 못 찾았다');

done('template-viewer-ok');
