const { chromium } = require('playwright');
const path = require('path');
const OUTPUT = '/root/anaka-kids-screenshots';
const URL = 'http://127.0.0.1:3101';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  // Load page
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  // 1. Profile selection — wait for cards to appear
  console.log('1. Profile selection...');
  try {
    await page.waitForSelector('.profile-card', { timeout: 8000 });
  } catch(e) {
    console.log('  waiting for dynamic content...');
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: path.join(OUTPUT, '01-profile-selection.png') });
  console.log('  OK -', (await page.$$('.profile-card')).length, 'cards');
  
  // 2. Force desktop view via JS injection
  console.log('2. Desktop with 12 apps...');
  await page.evaluate(() => {
    // Force state like loadProfiles would
    const modal = document.getElementById('profile-modal');
    const profileScreen = document.getElementById('profile-screen');
    const desktopScreen = document.getElementById('desktop-screen');
    const appGrid = document.getElementById('app-grid');
    
    if (modal) modal.style.display = 'none';
    if (profileScreen) profileScreen.classList.remove('active');
    if (desktopScreen) desktopScreen.classList.add('active');
    if (desktopScreen) desktopScreen.style.display = 'flex';
    
    // Manually render apps
    if (appGrid) {
      const APPS = [
        { id: 'shapes', icon: '🔷', label: 'Shape Match', game: 'shapes', cls: 'shapes' },
        { id: 'counting', icon: '🔢', label: 'Counting', game: 'counting', cls: 'counting' },
        { id: 'patterns', icon: '🧩', label: 'Patterns', game: 'patterns', cls: 'patterns' },
        { id: 'memory', icon: '🧠', label: 'Memory', game: 'memory', cls: 'memory' },
        { id: 'drawing', icon: '🎨', label: 'Art Studio', game: 'drawing', cls: 'drawing' },
        { id: 'reading', icon: '📖', label: 'Story Time', game: 'reading', cls: 'reading' },
        { id: 'typing', icon: '⌨️', label: 'Typing', game: 'typing', cls: 'typing' },
        { id: 'logic', icon: '🤔', label: 'Brain Teasers', game: 'logic', cls: 'logic' },
        { id: 'phonics', icon: '🔤', label: 'Phonics', game: 'phonics', cls: 'phonics' },
        { id: 'colours', icon: '🌈', label: 'Colour Fun', game: 'colours', cls: 'colours' },
        { id: 'music', icon: '🎵', label: 'Music Maker', game: 'music', cls: 'music' },
        { id: 'sorting', icon: '📦', label: 'Sort It Out', game: 'sorting', cls: 'sorting' },
      ];
      appGrid.innerHTML = '';
      APPS.forEach((a, i) => {
        const tile = document.createElement('div');
        tile.className = 'app-tile ' + a.cls;
        tile.innerHTML = '<div class="app-icon">' + a.icon + '</div><div class="app-label">' + a.label + '</div>';
        appGrid.appendChild(tile);
      });
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT, '07-desktop-apps-phase2.png') });
  console.log('  OK');
  
  // 3. Shapes game — override the game area
  console.log('3. Shapes game...');
  await page.evaluate(() => {
    const gamePanel = document.getElementById('game-panel');
    const gameArea = document.getElementById('game-area');
    const gameTitle = document.getElementById('game-title');
    if (gamePanel) gamePanel.style.display = 'flex';
    if (gameTitle) gameTitle.textContent = '🔷 Shape Match';
    if (gameArea) {
      gameArea.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:2rem;color:var(--text2);margin-bottom:12px;">Find the matching shape!</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;">' +
        '<div class="game-card" style="width:60px;height:60px;border:3px solid #6C63FF;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;">🔺</div>' +
        '<div class="game-card" style="width:60px;height:60px;border:3px solid #FF6B9D;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;">🔴</div>' +
        '<div class="game-card" style="width:60px;height:60px;border:3px solid #45D6C0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;">🔷</div>' +
        '<div class="game-card" style="width:60px;height:60px;border:3px solid #FFB347;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;">🟩</div>' +
        '</div></div>';
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUTPUT, '03-game-shapes.png') });
  console.log('  OK');
  
  // 4. Phonics game view
  console.log('4. Phonics game...');
  await page.evaluate(() => {
    const gamePanel = document.getElementById('game-panel');
    const gameTitle = document.getElementById('game-title');
    const gameArea = document.getElementById('game-area');
    if (gameTitle) gameTitle.textContent = '🔤 Phonics';
    if (gameArea) {
      gameArea.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:1.2rem;color:var(--text2);margin-bottom:16px;">Which letter starts the word <strong>Apple 🍎</strong>?</div><div>' +
        '<button class="phonics-card correct" style="display:inline-flex;">A</button>' +
        '<button class="phonics-card" style="display:inline-flex;">S</button>' +
        '<button class="phonics-card" style="display:inline-flex;">M</button>' +
        '<button class="phonics-card" style="display:inline-flex;">T</button>' +
        '</div></div>';
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUTPUT, '09-game-phonics.png') });
  console.log('  OK');
  
  // 5. Close game, show quests panel
  console.log('5. Quests panel...');
  await page.evaluate(() => {
    const gamePanel = document.getElementById('game-panel');
    if (gamePanel) gamePanel.style.display = 'none';
    const questsOverlay = document.getElementById('quests-overlay');
    if (questsOverlay) {
      questsOverlay.style.display = 'flex';
      const panel = document.getElementById('quests-panel');
      if (panel) {
        panel.innerHTML = '<h2>🎯 Active Quests</h2>' +
          '<div class="quest-item"><div class="q-icon">🔢</div><div class="q-info"><div class="q-title">Math Whiz</div><div class="q-desc">Complete 3 math games</div><div class="q-progress"><div class="q-fill" style="width:33%"></div></div></div><div class="q-reward">+50</div></div>' +
          '<div class="quest-item"><div class="q-icon">📖</div><div class="q-info"><div class="q-title">Story Explorer</div><div class="q-desc">Read 2 stories</div><div class="q-progress"><div class="q-fill" style="width:50%"></div></div></div><div class="q-reward">+30</div></div>' +
          '<div class="quest-item"><div class="q-icon">🧩</div><div class="q-info"><div class="q-title">Logic Master</div><div class="q-desc">Solve 5 puzzles</div><div class="q-progress"><div class="q-fill" style="width:0%"></div></div></div><div class="q-reward">+75</div></div>' +
          '<h2 style="margin-top:20px;">🏆 Achievements</h2><div class="achievement-grid">' +
          '<div class="achievement-badge"><span class="a-icon">🌟</span><span class="a-label">First Quest</span></div>' +
          '<div class="achievement-badge"><span class="a-icon">🌟</span><span class="a-label">Star Learner</span></div>' +
          '<div class="achievement-badge locked"><span class="a-icon">🔒</span><span class="a-label">Memory Master</span></div>' +
          '<div class="achievement-badge locked"><span class="a-icon">🔒</span><span class="a-label">Art Explorer</span></div>' +
          '</div>';
      }
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUTPUT, '08-quests-panel.png') });
  console.log('  OK');
  
  // 6. Parent dashboard
  console.log('6. Parent dashboard...');
  await page.evaluate(() => {
    const questsOverlay = document.getElementById('quests-overlay');
    if (questsOverlay) questsOverlay.style.display = 'none';
    
    // Navigate to parent.html
    window.location.href = '/parent';
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUTPUT, '06-parent-phase2.png') });
  console.log('  OK');
  
  console.log('\nALL DONE');
  await browser.close();
})();
