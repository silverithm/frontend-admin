import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

try {
  await page.fill('input[type="email"], input[placeholder*="이메일"]', 'ggprgrkjh@naver.com', { timeout: 10000 });
  await page.fill('input[type="password"], input[placeholder*="비밀번호"]', 'rlawnfpr12');
  await page.click('button:has-text("로그인")');
  await page.waitForTimeout(5000);

  // Call members API
  const data = await page.evaluate(async () => {
    const t = localStorage.getItem('authToken');
    const cid = localStorage.getItem('companyId');
    const res = await fetch(`/api/admin/users/members?companyId=${cid}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    return res.json();
  });

  const arr = Array.isArray(data) ? data : data.members || [];
  console.log('Total members:', arr.length);
  console.log('\nFirst member keys:', Object.keys(arr[0] || {}));
  console.log('\nFirst 3 members:');
  arr.slice(0, 3).forEach((m, i) => {
    console.log(`  [${i}]`, JSON.stringify(m, null, 2));
  });

} catch(e) {
  console.log('Error:', e.message);
}

await browser.close();
