# Anaka Kids v2 Build Plan

## Architecture
- **Single-page app** in public/index.html (all UI/UX inline — JS, CSS, HTML)
- **Backend** in server.js (Express + better-sqlite3)
- **Sound** via Web Audio API oscillators (no external files)
- **Mascot** CSS-animated SVG star
- **Telegram** via fetch to a bot API (Felicity's notification channel)
- **World map** as CSS grid with zones

## File Structure
```
/var/www/anaka-kids/
├── server.js              ← Economy + banking + business + crypto + tg APIs
├── public/
│   ├── index.html         ← ALL frontend: mascot, world map, all zones, games
│   ├── parent.html        ← Upgraded parent dashboard
│   ├── manifest.json      ← PWA (already exists)
│   └── sw.js              ← Service worker (already exists)
├── data/
│   └── anaka-kids.db      ← SQLite (new tables added)
└── systemd/
    └── anaka-kiosk.service
```

## Build Order (Parallelizable)
1. **server.js overhaul** — Add all new DB tables + API endpoints
2. **index.html Phase A** — Mascot, world map, sound system, economy UI
3. **index.html Phase B** — Moneyville, Crypto Canyon, Market Street games
4. **index.html Phase C** — Daily rewards, Anaka Tree, animations, polish
5. **parent.html upgrade** — All new stats
6. **Deploy & verify**

## Key Technical Decisions
- All coins are `economy.coins` and `economy.bank_balance` integers
- Interest calculated daily at 5% in-memory on login
- Mascot is a div with CSS animations — no SVG needed, emoji-based
- Sound effects generated with Web Audio API oscillator + gain envelope (no files)
- World map is a CSS grid with zone cards that animate on hover
- Daily streak stored in `profiles.last_login` — compare dates
- Telegram via `https://api.telegram.org/bot${TOKEN}/sendMessage` (bot token comes from env var or config)
