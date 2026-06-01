const { chromium } = require('playwright');
const path = require('path');
const OUTPUT = '/root/anaka-kids-screenshots';
const URL = 'http://127.0.0.1:3101';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait then check what's there
  await page.waitForTimeout(3000);

  const title = await page.title();
  const bodySize = await page.evaluate(() => document.body.innerHTML.length);
  const cardCount = await page.evaluate(() => document.querySelectorAll('.profile-card').length);
  const tileCount = await page.evaluate(() => document.querySelectorAll('.app-tile').length);
  console.log(`Title: "${title}"`);
  console.log(`Body HTML size: ${bodySize} chars`);
  console.log(`Profile cards: ${cardCount}`);
  console.log(`App tiles: ${tileCount}`);

  // Take screenshot no matter what
  await page.screenshot({ path: path.join(OUTPUT, '01-profile-big.png') });
  
  // Try clicking profile
  await page.evaluate(() => {
    const card = document.querySelector('.profile-card');
    if (card) {
      console.log('Found profile card, clicking');
      card.click();
    } else {
      console.log('No profile card found, trying selectProfile directly');
      window.selectProfile(1, 'Magnolia', '🐱');
    }
  });
  await page.waitForTimeout(3000);
  
  const tileCount2 = await page.evaluate(() => document.querySelectorAll('.app-tile').length);
  console.log(`After select - App tiles: ${tileCount2}`);

  await page.screenshot({ path: path.join(OUTPUT, '02-desktop-big.png') });
  
  console.log('FILESIZE CHECK:');
  await browser.close();
})();