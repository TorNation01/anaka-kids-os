const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const app = express();
const PORT = 3101;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new Database(path.join(__dirname, 'data', 'anaka-kids.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '🐱',
    birth_year INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    daily_minutes INTEGER DEFAULT 120,
    content_level INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    activity TEXT,
    duration_seconds INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    skill TEXT,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_to_next INTEGER DEFAULT 100
  );
  CREATE TABLE IF NOT EXISTS parent_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screen_time_limit INTEGER DEFAULT 120,
    bedtime_hour INTEGER DEFAULT 20,
    voice_enabled INTEGER DEFAULT 1,
    content_filter TEXT DEFAULT 'all',
    password_hash TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    skill TEXT,
    xp_reward INTEGER DEFAULT 50,
    required_count INTEGER DEFAULT 1,
    current_count INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    description TEXT,
    unlocked_at TEXT
  );
  CREATE TABLE IF NOT EXISTS activity_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    type TEXT,
    payload TEXT,
    processed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS learning_path (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    milestone TEXT,
    skill TEXT,
    age_group TEXT DEFAULT '5',
    completed INTEGER DEFAULT 0,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS difficulty_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    skill TEXT,
    difficulty INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    UNIQUE(profile_id, skill)
  );
`);

// Seed default profile if empty
const profileCount = db.prepare('SELECT COUNT(*) as c FROM profiles').get();
if (profileCount.c === 0) {
  db.prepare('INSERT INTO profiles (name, avatar, birth_year) VALUES (?, ?, ?)').run('Magnolia', '🐱', 2021);
  db.prepare('INSERT INTO parent_config (id) VALUES (1)').run();
}

// Seed default progress for first profile
const progressCount = db.prepare('SELECT COUNT(*) as c FROM progress WHERE profile_id = 1').get();
if (progressCount.c === 0) {
  const skills = ['Math', 'Reading', 'Logic', 'Creativity', 'Memory', 'Typing'];
  skills.forEach(s => {
    db.prepare('INSERT INTO progress (profile_id, skill, level, xp, xp_to_next) VALUES (1, ?, 1, 0, 100)').run(s);
  });
}

// API endpoints
app.get('/api/profiles', (req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles').all();
  res.json(profiles);
});

app.get('/api/progress/:profileId', (req, res) => {
  const progress = db.prepare('SELECT * FROM progress WHERE profile_id = ?').all(req.params.profileId);
  res.json(progress);
});

app.post('/api/xp', (req, res) => {
  const { profile_id, skill, xp, activity, duration } = req.body;
  const prog = db.prepare('SELECT * FROM progress WHERE profile_id = ? AND skill = ?').get(profile_id, skill);
  if (prog) {
    let newXp = prog.xp + xp;
    let newLevel = prog.level;
    let newXpToNext = prog.xp_to_next;
    while (newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = Math.floor(newXpToNext * 1.3);
    }
    db.prepare('UPDATE progress SET xp = ?, level = ?, xp_to_next = ? WHERE id = ?')
      .run(newXp, newLevel, newXpToNext, prog.id);
    db.prepare('INSERT INTO activity_log (profile_id, activity, duration_seconds, xp_earned) VALUES (?, ?, ?, ?)')
      .run(profile_id, activity, duration || 0, xp);
    res.json({ success: true, level: newLevel, xp: newXp, xpToNext: newXpToNext });
  } else {
    res.status(404).json({ error: 'Progress not found' });
  }
});

app.get('/api/stats/:profileId', (req, res) => {
  const today = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total_time,
           COALESCE(SUM(xp_earned), 0) as total_xp
    FROM activity_log
    WHERE profile_id = ? AND date(timestamp) = date('now')
  `).get(req.params.profileId);
  
  const recent = db.prepare(`
    SELECT activity, duration_seconds, xp_earned, timestamp
    FROM activity_log
    WHERE profile_id = ?
    ORDER BY timestamp DESC LIMIT 20
  `).all(req.params.profileId);
  
  res.json({ today, recent });
});

app.get('/api/config', (req, res) => {
  const config = db.prepare('SELECT * FROM parent_config WHERE id = 1').get();
  res.json(config);
});

app.post('/api/config', (req, res) => {
  const { screen_time_limit, bedtime_hour, voice_enabled, content_filter } = req.body;
  db.prepare('UPDATE parent_config SET screen_time_limit = ?, bedtime_hour = ?, voice_enabled = ?, content_filter = ? WHERE id = 1')
    .run(screen_time_limit || 120, bedtime_hour || 20, voice_enabled ? 1 : 0, content_filter || 'all');
  res.json({ success: true });
});

// ═══════ PROFILE UPDATE API ═══════
app.put('/api/profile/update', (req, res) => {
  const { profile_id, name, avatar, birth_year } = req.body;
  db.prepare('UPDATE profiles SET name = COALESCE(?, name), avatar = COALESCE(?, avatar), birth_year = COALESCE(?, birth_year) WHERE id = ?')
    .run(name, avatar, birth_year, profile_id);
  res.json({ success: true });
});

// ═══════ ML STORY GENERATOR API ═══════
app.post('/api/story/generate', async (req, res) => {
  const { theme } = req.body || {};
  try {
    const llmResp = await fetch('https://llm.anakatech.llc/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-ana...2026' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'You are a children\'s story writer. Write a short story for a 5-year-old child. The story must be exactly 3-4 paragraphs, use simple words, have a kind message, and include animal characters or friendly creatures. Use emojis in the title. Respond ONLY with the story text, no preamble.' },
          { role: 'user', content: theme ? `Write a story about ${theme}` : 'Write a story about a friendly dragon who loves to dance' }
        ],
        max_tokens: 500,
        temperature: 0.8
      })
    });
    const data = await llmResp.json();
    const story = data.choices?.[0]?.message?.content || 'Once upon a time, in a land of imagination, a little star named Astra danced across the sky and made all the children smile. The end! 🌟';
    res.json({ story });
  } catch (e) {
    res.json({ story: 'Once upon a time, a little cloud named Fluffy floated over a rainbow. All the animals looked up and smiled. The end! 🌈' });
  }
});

app.get('/api/leaderboard/:profileId', (req, res) => {
  const leaderboard = db.prepare(`
    SELECT p.name, p.avatar, sk.skill, sk.level, sk.xp, sk.xp_to_next
    FROM progress sk
    JOIN profiles p ON p.id = sk.profile_id
    WHERE sk.profile_id = ?
    ORDER BY sk.level DESC, sk.xp DESC
  `).all(req.params.profileId);
  res.json(leaderboard);
});

// ═══════ ADAPTIVE DIFFICULTY API ═══════
app.get('/api/difficulty/:profileId', (req, res) => {
  const diffs = db.prepare('SELECT * FROM difficulty_state WHERE profile_id = ?').all(req.params.profileId);
  // Seed if empty
  if (diffs.length === 0) {
    const skills = ['Math', 'Reading', 'Logic', 'Creativity', 'Memory', 'Typing'];
    const ins = db.prepare('INSERT OR IGNORE INTO difficulty_state (profile_id, skill, difficulty, streak, total_attempts, total_correct) VALUES (?, ?, 1, 0, 0, 0)');
    skills.forEach(s => ins.run(req.params.profileId, s));
    const seeded = db.prepare('SELECT * FROM difficulty_state WHERE profile_id = ?').all(req.params.profileId);
    return res.json(seeded);
  }
  res.json(diffs);
});

app.post('/api/difficulty/update', (req, res) => {
  const { profile_id, skill, correct } = req.body;
  if (!profile_id || !skill) return res.status(400).json({ error: 'Missing params' });

  // Ensure row exists
  db.prepare('INSERT OR IGNORE INTO difficulty_state (profile_id, skill, difficulty, streak, total_attempts, total_correct) VALUES (?, ?, 1, 0, 0, 0)').run(profile_id, skill);

  const state = db.prepare('SELECT * FROM difficulty_state WHERE profile_id = ? AND skill = ?').get(profile_id, skill);
  if (!state) return res.status(404).json({ error: 'Not found' });

  let newStreak = correct ? state.streak + 1 : 0;
  let newDifficulty = state.difficulty;
  let newCorrect = state.total_correct + (correct ? 1 : 0);
  let newAttempts = state.total_attempts + 1;

  // Adjust difficulty based on streak
  if (newStreak >= 5 && newDifficulty < 5) {
    newDifficulty = Math.min(5, state.difficulty + 1);
  } else if (newStreak === 0 && state.difficulty > 1 && state.total_attempts > 5) {
    // Drop difficulty if wrong and have some history
    newDifficulty = Math.max(1, state.difficulty - 1);
  }

  db.prepare('UPDATE difficulty_state SET streak = ?, difficulty = ?, total_attempts = ?, total_correct = ? WHERE id = ?')
    .run(newStreak, newDifficulty, newAttempts, newCorrect, state.id);

  res.json({
    difficulty: newDifficulty,
    streak: newStreak,
    total_attempts: newAttempts,
    total_correct: newCorrect,
    accuracy: Math.round((newCorrect / newAttempts) * 100)
  });
});

app.get('/api/history/:profileId', (req, res) => {
  const days = req.query.days || 7;
  const history = db.prepare(`
    SELECT date(timestamp) as day,
           SUM(duration_seconds) as total_time,
           SUM(xp_earned) as total_xp,
           COUNT(*) as activities
    FROM activity_log
    WHERE profile_id = ? AND timestamp >= datetime('now', '-' || ? || ' days')
    GROUP BY date(timestamp)
    ORDER BY day DESC
  `).all(req.params.profileId, days);
  res.json(history);
});

// Routes
app.get('/parent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'parent.html'));
});

// ═══════ QUESTS API ═══════
app.get('/api/quests/:profileId', (req, res) => {
  const active = db.prepare('SELECT * FROM quests WHERE profile_id = ? AND completed = 0 ORDER BY created_at DESC LIMIT 5').all(req.params.profileId);
  const completed = db.prepare('SELECT * FROM quests WHERE profile_id = ? AND completed = 1 ORDER BY created_at DESC LIMIT 20').all(req.params.profileId);
  res.json({ active, completed });
});

app.post('/api/quests/generate', (req, res) => {
  const { profile_id } = req.body;
  // Generate age-appropriate quests based on content_level
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile_id);
  const level = profile ? profile.content_level : 1;
  const questTemplates = [
    { title: 'Shape Explorer', desc: 'Match 3 pairs of shapes', skill: 'Math', xp: 30, count: 3 },
    { title: 'Counting Champion', desc: 'Count correctly 5 times', skill: 'Math', xp: 40, count: 5 },
    { title: 'Pattern Detective', desc: 'Complete 3 patterns', skill: 'Logic', xp: 35, count: 3 },
    { title: 'Memory Master', desc: 'Match all cards in memory game', skill: 'Memory', xp: 50, count: 1 },
    { title: 'Story Explorer', desc: 'Read 2 stories', skill: 'Reading', xp: 30, count: 2 },
    { title: 'Art Creator', desc: 'Make 2 drawings', skill: 'Creativity', xp: 25, count: 2 },
    { title: 'Keyboard Hero', desc: 'Type 5 words correctly', skill: 'Typing', xp: 40, count: 5 },
    { title: 'Brain Builder', desc: 'Solve 3 puzzles', skill: 'Logic', xp: 45, count: 3 },
  ];
  // Clear old uncompleted quests
  db.prepare('DELETE FROM quests WHERE profile_id = ? AND completed = 0').run(profile_id);
  // Assign 2-3 random quests
  const shuffled = questTemplates.sort(() => Math.random() - 0.5).slice(0, 2 + level);
  const insert = db.prepare('INSERT INTO quests (profile_id, title, description, skill, xp_reward, required_count) VALUES (?, ?, ?, ?, ?, ?)');
  shuffled.forEach(q => insert.run(profile_id, q.title, q.desc, q.skill, q.xp, q.count));
  const quests = db.prepare('SELECT * FROM quests WHERE profile_id = ? AND completed = 0').all(profile_id);
  res.json(quests);
});

app.post('/api/quests/progress', (req, res) => {
  const { profile_id, skill } = req.body;
  const quest = db.prepare('SELECT * FROM quests WHERE profile_id = ? AND skill = ? AND completed = 0 LIMIT 1').get(profile_id, skill);
  if (quest) {
    const newCount = quest.current_count + 1;
    if (newCount >= quest.required_count) {
      // Complete quest
      db.prepare('UPDATE quests SET current_count = ?, completed = 1 WHERE id = ?').run(newCount, quest.id);
      // Award bonus XP + check achievements
      const bonusXp = quest.xp_reward;
      db.prepare('UPDATE progress SET xp = xp + ? WHERE profile_id = ? AND skill = ?').run(bonusXp, profile_id, skill);
      db.prepare('INSERT INTO activity_log (profile_id, activity, duration_seconds, xp_earned) VALUES (?, ?, ?, ?)').run(profile_id, 'Quest: ' + quest.title, 0, bonusXp);
      // Check for achievement
      const completedCount = db.prepare('SELECT COUNT(*) as c FROM quests WHERE profile_id = ? AND completed = 1').get(profile_id).c;
      if (completedCount === 1) {
        const exists = db.prepare('SELECT id FROM achievements WHERE profile_id = ? AND name = ?').get(profile_id, 'First Quest');
        if (!exists) db.prepare('INSERT INTO achievements (profile_id, name, icon, description, unlocked_at) VALUES (?, ?, ?, ?, datetime(\'now\'))').run(profile_id, 'First Quest', '🌟', 'Completed first quest!');
      }
      res.json({ completed: true, bonus: bonusXp, title: quest.title });
    } else {
      db.prepare('UPDATE quests SET current_count = ? WHERE id = ?').run(newCount, quest.id);
      res.json({ completed: false, current: newCount, required: quest.required_count });
    }
  } else {
    res.json({ noQuest: true });
  }
});

// ═══════ ACHIEVEMENTS API ═══════
app.get('/api/achievements/:profileId', (req, res) => {
  const achievements = db.prepare('SELECT * FROM achievements WHERE profile_id = ? ORDER BY unlocked_at DESC').all(req.params.profileId);
  res.json(achievements);
});

// ═══════ LEARNING PATH API ═══════
app.get('/api/learning-path/:profileId', (req, res) => {
  const milestones = db.prepare('SELECT * FROM learning_path WHERE profile_id = ? ORDER BY id').all(req.params.profileId);
  if (milestones.length === 0) {
    // Seed learning path for age 5
    const seed = [
      { milestone: 'Recognise Shapes', skill: 'Math', age: '5' },
      { milestone: 'Count to 10', skill: 'Math', age: '5' },
      { milestone: 'Letter Recognition', skill: 'Reading', age: '5' },
      { milestone: 'Simple Patterns', skill: 'Logic', age: '5' },
      { milestone: 'Colour Identification', skill: 'Creativity', age: '5' },
      { milestone: 'Follow Instructions', skill: 'Logic', age: '5' },
      { milestone: 'Use Mouse/Touch', skill: 'Typing', age: '5' },
      { milestone: 'Match Pairs', skill: 'Memory', age: '5' },
    ];
    const ins = db.prepare('INSERT INTO learning_path (profile_id, milestone, skill, age_group) VALUES (?, ?, ?, ?)');
    seed.forEach(m => ins.run(req.params.profileId, m.milestone, m.skill, m.age));
    const seeded = db.prepare('SELECT * FROM learning_path WHERE profile_id = ? ORDER BY id').all(req.params.profileId);
    res.json(seeded);
  } else {
    res.json(milestones);
  }
});

app.post('/api/learning-path/complete', (req, res) => {
  const { profile_id, milestone_id } = req.body;
  db.prepare('UPDATE learning_path SET completed = 1, completed_at = datetime(\'now\') WHERE id = ? AND profile_id = ?').run(milestone_id, profile_id);
  // Check if all milestones complete
  const remaining = db.prepare('SELECT COUNT(*) as c FROM learning_path WHERE profile_id = ? AND completed = 0').get(profile_id).c;
  if (remaining === 0) {
    const exists = db.prepare('SELECT id FROM achievements WHERE profile_id = ? AND name = ?').get(profile_id, 'Ready for Age 6');
    if (!exists) db.prepare('INSERT INTO achievements (profile_id, name, icon, description, unlocked_at) VALUES (?, ?, ?, ?, datetime(\'now\'))').run(profile_id, 'Ready for Age 6', '🎓', 'Completed all age 5 milestones!');
  }
  res.json({ success: true, remaining });
});

// ═══════ LITELLM VOICE API ═══════
app.post('/api/voice/command', async (req, res) => {
  const { text, profile_id } = req.body;
  if (!text) return res.json({ action: null, response: '' });
  
  const cmd = text.toLowerCase().trim();
  
  // Parse natural language commands
  if (cmd.includes('shape') || cmd.includes('match')) {
    return res.json({ action: 'open_game', payload: 'shapes', response: 'Opening Shape Match! Let us find matching shapes together.' });
  }
  if (cmd.includes('count') || cmd.includes('number') || cmd.includes('how many')) {
    return res.json({ action: 'open_game', payload: 'counting', response: 'Let us count some fun things!' });
  }
  if (cmd.includes('pattern') || cmd.includes('next')) {
    return res.json({ action: 'open_game', payload: 'patterns', response: 'Time to find the pattern!' });
  }
  if (cmd.includes('memory') || cmd.includes('remember') || cmd.includes('card')) {
    return res.json({ action: 'open_game', payload: 'memory', response: 'Can you remember where the cards are?' });
  }
  if (cmd.includes('draw') || cmd.includes('art') || cmd.includes('paint') || cmd.includes('colour') || cmd.includes('color')) {
    return res.json({ action: 'open_game', payload: 'drawing', response: 'Time to create a masterpiece!' });
  }
  if (cmd.includes('story') || cmd.includes('read') || cmd.includes('book')) {
    return res.json({ action: 'open_game', payload: 'reading', response: 'Let us read a wonderful story together!' });
  }
  if (cmd.includes('type') || cmd.includes('keyboard') || cmd.includes('word')) {
    return res.json({ action: 'open_game', payload: 'typing', response: 'Let us practice some words!' });
  }
  if (cmd.includes('puzzle') || cmd.includes('brain') || cmd.includes('teaser') || cmd.includes('riddle')) {
    return res.json({ action: 'open_game', payload: 'logic', response: 'Time for some brain teasers!' });
  }
  if (cmd.includes('home') || cmd.includes('back') || cmd.includes('desktop') || cmd.includes('menu')) {
    return res.json({ action: 'go_home', payload: '', response: 'Going back to the home screen!' });
  }
  if (cmd.includes('parent') || cmd.includes('mummy') || cmd.includes('daddy') || cmd.includes('mum') || cmd.includes('dad')) {
    return res.json({ action: 'open_parent', payload: '', response: 'Opening the parent dashboard!' });
  }
  if (cmd.includes('quest') || cmd.includes('mission') || cmd.includes('challenge')) {
    return res.json({ action: 'show_quests', payload: '', response: 'Here are your quests!' });
  }
  if (cmd.includes('hello') || cmd.includes('hi') || cmd.includes('hey')) {
    return res.json({ action: 'speak', payload: '', response: 'Hello! What do you want to play today?' });
  }
  
  // LiteLLM integration for complex commands
  try {
    const llmResponse = await fetch('https://llm.anakatech.llc/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-ana...2026' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'You are Anaka, a friendly AI assistant for a 5-year-old child. Respond in a warm, simple, and encouraging way. Keep responses under 2 sentences. Use emojis. Never mention complex topics.' },
          { role: 'user', content: cmd }
        ],
        max_tokens: 100
      })
    });
    const data = await llmResponse.json();
    const reply = data.choices?.[0]?.message?.content || 'I am not sure what you mean! Try saying "shapes" or "stories"!';
    const action = (cmd.includes('play') || cmd.includes('game')) ? 'speak' : 'speak';
    res.json({ action, payload: '', response: reply });
  } catch (e) {
    res.json({ action: 'speak', payload: '', response: 'I did not understand. Try saying shapes, counting, or stories!' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Anaka Kids OS running on port ${PORT}`);
});
