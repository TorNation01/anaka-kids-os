const { chromium } = require('playwright');
const path = require('path');
const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const OUTPUT = '/root/anaka-kids-screenshots';

const db = new sqlite3('/var/www/anaka-kids/data/anaka-kids.db');
db.exec("DELETE FROM profiles; DELETE FROM progress; DELETE FROM activity_log; DELETE FROM quests; DELETE FROM achievements;");
db.exec("INSERT INTO profiles (id, name, avatar, birth_year, daily_minutes, content_level) VALUES (1, 'Magnolia', '\u{1F431}', 2021, 120, 1)");
db.exec("INSERT INTO progress (profile_id, skill, level, xp, xp_to_next) VALUES (1, 'Math', 1, 0, 100), (1, 'Reading', 2, 50, 100), (1, 'Logic', 1, 30, 100), (1, 'Memory', 1, 10, 100), (1, 'Creativity', 2, 75, 100), (1, 'Typing', 1, 0, 100)");
db.exec("INSERT OR IGNORE INTO parent_config (id, screen_time_limit, bedtime_hour, voice_enabled, content_filter, password_hash) VALUES (1, 120, 20, 1, 'all', '')");
db.close();

const URL = 'http://127.0.0.1:3101';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Debug: What's on screen?
  const html = await page.content();
  const hasProfileCard = html.includes('profile-card');
  const hasProfileScreen = html.includes('profile-screen');
  const hasDesktopScreen = html.includes('desktop-screen');
  const hasProfileModal = html.includes('profile-modal');
  
  fs.writeFileSync('/tmp/html-before-click.html', html);
  
  console.log('Has profile-card class:', hasProfileCard);
  console.log('Has profile-screen id:', hasProfileScreen);
  console.log('Has desktop-screen id:', hasDesktopScreen);
  console.log('Has profile-modal id:', hasProfileModal);
  
  // Count elements
  const cards = await page.$$('.profile-card');
  console.log('Number of .profile-card elements:', cards.length);
  
  // Check visibility
  for (const card of cards) {
    const visible = await card.isVisible();
    const box = await card.boundingBox();
    console.log('  Card visible:', visible, 'Box:', JSON.stringify(box));
  }
  
  // Try clicking the profile-card
  if (cards.length > 0) {
    await cards[0].click();
    await page.waitForTimeout(3000);
    const html2 = await page.content();
    fs.writeFileSync('/tmp/html-after-click.html', html2);
    
    // Check what's visible now
    const hasDesktopScreen2 = html2.includes('desktop-screen');
    const hasAppGrid2 = html2.includes('app-grid');
    const tilesCount = (html2.match(/app-tile/g) || []).length;
    const closeBtn = html2.includes('game-close');
    const questsBtn = html2.includes('quests-btn');
    
    console.log('\nAfter click:');
    console.log('Has desktop-screen:', hasDesktopScreen2);
    console.log('Has app-grid class:', hasAppGrid2);
    console.log('Number of app-tile references:', tilesCount);
    console.log('Has game-close:', closeBtn);
    console.log('Has quests-btn:', questsBtn);
    
    // Check desktop screen visibility
    const desktopScreen = await page.$('#desktop-screen');
    if (desktopScreen) {
      const dVisible = await desktopScreen.isVisible();
      const dClass = await desktopScreen.getAttribute('class');
      console.log('Desktop screen visible:', dVisible, 'class:', dClass);
    }
    
    // Check profile modal visibility
    const profileModal = await page.$('#profile-modal');
    if (profileModal) {
      const pVisible = await profileModal.isVisible();
      const pClass = await profileModal.getAttribute('class');
      console.log('Profile modal visible:', pVisible, 'class:', pClass);
    }
    
    // Check header
    const header = await page.$('.header');
    if (header) {
      const hVisible = await header.isVisible();
      console.log('Header visible:', hVisible);
    }
    
    // Check app tiles
    const appTiles = await page.$$('.app-tile');
    console.log('Current .app-tile count:', appTiles.length);
    for (let i = 0; i < Math.min(appTiles.length, 3); i++) {
      const v = await appTiles[i].isVisible();
      console.log('  Tile', i, 'visible:', v);
    }
  }
  
  console.log('\nDebug complete!');
  await browser.close();
})();
