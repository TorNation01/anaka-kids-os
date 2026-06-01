const { chromium } = require('playwright');
const path = require('path');
const OUTPUT = '/root/anaka-kids-screenshots';
const URL = 'http://127.0.0.1:3101';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

  // 1. Profile screen — wait for profile cards to load from XHR
  await page.waitForFunction(() => {
    return document.querySelectorAll('.profile-card').length > 0;
  }, { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUTPUT, '01-profile-big.png'), fullPage: false });
  console.log('1/5 Profile screen captured');

  // 2. Click first profile
  await page.evaluate(() => document.querySelector('.profile-card').click());
  await page.waitForFunction(() => {
    return document.querySelectorAll('.app-tile').length > 0;
  }, { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUTPUT, '02-desktop-big.png'), fullPage: false });
  console.log('2/5 Desktop captured');

  // 3. Click first game
  await page.evaluate(() => document.querySelector('.app-tile').click());
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT, '03-game-big.png'), fullPage: false });
  console.log('3/5 Game captured');

  // 4. Back → Quests
  await page.evaluate(() => document.querySelector('.game-back').click());
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.querySelector('.quests-btn').click());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT, '04-quests-big.png'), fullPage: false });
  console.log('4/5 Quests captured');

  // 5. Parent dashboard
  await page.evaluate(() => {
    const o = document.getElementById('quests-overlay');
    if (o) o.classList.remove('show');
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    // Find the parent button (has 🔒 icon)
    const btns = document.querySelectorAll('.header-btn');
    for (let b of btns) {
      if (b.textContent.includes('🔒')) { b.click(); break; }
    }
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT, '05-parent-big.png'), fullPage: false });
  console.log('5/5 Parent dashboard captured');

  console.log('ALL DONE');
  await browser.close();
})();