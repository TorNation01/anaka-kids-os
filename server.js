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

// History activity log for parent dashboard
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Anaka Kids OS running on port ${PORT}`);
});
