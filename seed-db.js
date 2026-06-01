const sqlite3 = require('better-sqlite3');
const db = new sqlite3('./data/anaka-kids.db');
db.exec('DELETE FROM profiles');
db.exec('DELETE FROM progress');
db.exec('DELETE FROM activity_log');
db.exec('DELETE FROM quests');
db.exec('DELETE FROM achievements');
db.prepare('INSERT INTO profiles (id, name, avatar, birth_year, daily_minutes, content_level) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Magnolia', '🐱', 2021, 120, 1);
const skills = [
  [1, 'Math', 1, 0, 100],
  [1, 'Reading', 2, 50, 100],
  [1, 'Logic', 1, 30, 100],
  [1, 'Memory', 1, 10, 100],
  [1, 'Creativity', 2, 75, 100],
  [1, 'Typing', 1, 0, 100]
];
const ins = db.prepare('INSERT INTO progress (profile_id, skill, level, xp, xp_to_next) VALUES (?, ?, ?, ?, ?)');
for (const s of skills) ins.run(...s);
db.prepare('INSERT OR IGNORE INTO parent_config (id, screen_time_limit, bedtime_hour, voice_enabled, content_filter, password_hash) VALUES (?, ?, ?, ?, ?, ?)').run(1, 120, 20, 1, 'all', '');
db.close();
console.log('DB SEEDED OK');
