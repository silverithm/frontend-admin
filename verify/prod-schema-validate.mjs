// 마이그레이션이 만든 컬럼 타입과 엔티티의 enum 매핑이 어긋나지 않는지.
//
// 2026-09-12에 이걸로 배포가 막혔다. `@Enumerated(EnumType.STRING)`만 붙이면 Hibernate 6은
// 컬럼이 MySQL ENUM이길 기대하는데 우리 마이그레이션은 VARCHAR로 만들었다. 운영은
// ddl-auto: validate라 마이그레이션은 적용된 채 기동만 실패했다(블루그린이라 무중단 롤백).
// 컬럼을 VARCHAR로 만들었으면 엔티티에 `@JdbcTypeCode(SqlTypes.VARCHAR)`(또는 columnDefinition)를
// 달아야 한다. 반대로 진짜 MySQL ENUM 컬럼(notifications.type 등)에는 달면 안 된다.
//
// 마이그레이션에 선언이 없는 컬럼은 Flyway 이전 베이스라인이라 여기서 판정하지 않는다.
import { readdirSync, readFileSync } from 'node:fs';
import { API, want, done } from './_lib.mjs';

const migDir = `${API}/src/main/resources/db/migration`;
const sql = readdirSync(migDir).filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(`${migDir}/${f}`, 'utf8')).join('\n').toLowerCase();

/** 마이그레이션이 그 컬럼을 무슨 타입으로 선언했는지 — varchar | enum | null(선언 없음) */
function declaredType(column) {
  const re = new RegExp(`[\`\\s(]${column}\\s+(varchar|enum)\\b`, 'g');
  const kinds = new Set();
  let m;
  while ((m = re.exec(sql)) !== null) kinds.add(m[1]);
  if (kinds.size !== 1) return null; // 없거나(베이스라인) 여러 번 바뀐 컬럼은 판정 보류
  return [...kinds][0];
}

const entityDir = `${API}/src/main/java/com/silverithm/vehicleplacementsystem/entity`;
let checked = 0;
for (const file of readdirSync(entityDir).filter((f) => f.endsWith('.java'))) {
  const src = readFileSync(`${entityDir}/${file}`, 'utf8');
  for (const block of src.match(/@Enumerated\(EnumType\.STRING\)[\s\S]{0,400}?;/g) || []) {
    const field = /private\s+\w+\s+(\w+)\s*;/.exec(block)?.[1];
    if (!field) continue;
    // @Column(name = "...")이 있으면 그 이름, 없으면 필드명을 스네이크로
    const column = (/@Column\([^)]*name\s*=\s*"([^"]+)"/.exec(block)?.[1]
      ?? field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)).toLowerCase();
    const declared = declaredType(column);
    if (!declared) continue;
    checked += 1;
    const mappedVarchar = /@JdbcTypeCode\(SqlTypes\.VARCHAR\)/.test(block)
      || /columnDefinition\s*=\s*"varchar/i.test(block);
    if (declared === 'varchar') {
      want(mappedVarchar,
        `${file}의 ${field}(${column}): 마이그레이션은 VARCHAR인데 엔티티에 VARCHAR 매핑이 없다 — validate에서 기동이 막힌다`);
    } else {
      want(!mappedVarchar,
        `${file}의 ${field}(${column}): 마이그레이션은 MySQL ENUM인데 엔티티가 VARCHAR로 매핑했다`);
    }
  }
}
want(checked >= 5, `대조한 컬럼이 ${checked}개뿐이다 — 추출이 깨졌는지 확인하라`);
done('prod-schema-validate-ok');
