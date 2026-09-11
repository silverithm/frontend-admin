// G3: 케어 프로필 마이그레이션이 V1.91.0 하나로만 있고, 같은 번호가 다른 곳에 없는지.
//
// 여러 세션이 같은 리포를 동시에 만지므로 Flyway 번호가 충돌한 전례가 있다(V1.49/1.50).
// 로컬 파일 목록과 origin/main 트리를 함께 본다.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { want, done } from './_lib.mjs';

const API_WT = '/Users/gimjunhyeong/Develop/silverithm/api-server/.claude/worktrees/elder-care-info';
const dir = `${API_WT}/src/main/resources/db/migration`;
const files = readdirSync(dir).filter((f) => f.startsWith('V1.91.0__'));
want(files.length === 1, `V1.91.0 파일이 정확히 하나여야 하는데 ${files.length}개: ${files.join(', ')}`);
if (files.length === 1) {
  const sql = readFileSync(`${dir}/${files[0]}`, 'utf8');
  want(/CREATE TABLE elder_care_profile/i.test(sql), '마이그레이션이 elder_care_profile 테이블을 만들지 않는다');
  want(/ON DELETE CASCADE/i.test(sql), '어르신 삭제 시 프로필이 같이 지워지지 않는다');
  want(/resident_number\s+VARCHAR\(2048\)/i.test(sql), '주민번호 컬럼이 암호문 길이(2048)로 잡혀 있지 않다');
}

execFileSync('git', ['-C', API_WT, 'fetch', '-q', 'origin']);
const tree = execFileSync('git', ['-C', API_WT, 'ls-tree', '--name-only', 'origin/main', 'src/main/resources/db/migration/'], { encoding: 'utf8' });
want(!/V1\.91\.0__/.test(tree), 'origin/main에 이미 V1.91.0이 있다 — 번호를 다시 배정해야 한다');
const versions = readdirSync(dir).map((f) => /^V([\d.]+)__/.exec(f)?.[1]).filter(Boolean);
const dup = versions.filter((v, i) => versions.indexOf(v) !== i);
want(dup.length === 0, `로컬에 중복 버전이 있다: ${dup.join(', ')}`);

done('MIGRATION_OK');
