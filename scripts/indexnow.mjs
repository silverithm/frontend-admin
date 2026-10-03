#!/usr/bin/env node
/**
 * IndexNow — 새로 만들거나 고친 페이지를 검색엔진에 바로 알린다.
 *
 * 네이버·빙은 IndexNow 알림을 받으면 사이트맵을 다시 읽을 때까지 기다리지 않고 해당 URL을 수집하러 온다.
 * (구글은 IndexNow를 받지 않는다 — 구글은 사이트맵 lastmod와 서치콘솔 색인 요청으로만 앞당길 수 있다.)
 * 키 파일은 public/<키>.txt로 배포돼 있어야 한다. 배포가 끝난 뒤에 실행한다.
 *
 * 사용법:
 *   node scripts/indexnow.mjs https://carev.kr/ltc https://carev.kr/ltc/daycare-fee-2026   # 지정한 URL만
 *   node scripts/indexnow.mjs --sitemap                                                 # 사이트맵의 모든 URL
 *   node scripts/indexnow.mjs --sitemap --dry-run                                       # 보낼 목록만 출력
 */

const HOST = 'carev.kr';
const KEY = 'cbcbf5f05a34d64f144e27d2cbce18d6';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// IndexNow는 참여 엔진끼리 알림을 공유하지만, 네이버에는 직접도 보낸다 (수집이 가장 늦는 쪽이라).
const ENDPOINTS = ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function sitemapUrls() {
  const res = await fetch(`https://${HOST}/sitemap.xml`);
  if (!res.ok) throw new Error(`사이트맵을 받지 못했습니다: HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function main() {
  const urls = args.includes('--sitemap') ? await sitemapUrls() : args.filter((a) => a.startsWith('http'));
  const own = urls.filter((u) => new URL(u).hostname === HOST);
  if (own.length === 0) {
    console.error('보낼 URL이 없습니다. URL을 인자로 주거나 --sitemap을 쓰세요.');
    process.exit(1);
  }
  console.log(`${own.length}개 URL`);
  own.forEach((u) => console.log(`  ${u}`));
  if (dryRun) return;

  // 키 파일이 실제로 열리는지 먼저 본다 — 없으면 엔진이 403으로 거절하고 이유를 잘 알려 주지 않는다.
  const keyRes = await fetch(KEY_LOCATION);
  const keyBody = keyRes.ok ? (await keyRes.text()).trim() : '';
  if (keyBody !== KEY) {
    console.error(`키 파일이 배포돼 있지 않습니다: ${KEY_LOCATION} (HTTP ${keyRes.status})`);
    process.exit(1);
  }

  const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: own });
  let failed = false;
  for (const endpoint of ENDPOINTS) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
    });
    // 200·202 = 접수. 403 = 키 불일치, 422 = 호스트와 URL 불일치, 429 = 너무 자주 보냄.
    const ok = res.status === 200 || res.status === 202;
    if (!ok) failed = true;
    console.log(`${ok ? '접수' : '실패'} ${res.status} ${endpoint}${ok ? '' : ` ${(await res.text()).slice(0, 200)}`}`);
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
