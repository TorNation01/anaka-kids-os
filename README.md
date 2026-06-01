# Anaka Kids OS 🧸

A child-safe, gamified Linux operating system for ages 5-10. Built by **Anakatech** for Magnolia.

> 🎯 **Phase 4 Complete** — 12 learning games, quests, achievements, parent dashboard, voice, PWA, themes, ML stories, bootable images

---

## ✨ Features

### 🎮 12 Learning Games
| Game | Skill | Description |
|------|-------|-------------|
| 🔷 Shape Match | Math | Match shapes together |
| 🔢 Counting | Math | Count objects |
| 🧩 Patterns | Logic | Find what comes next |
| 🧠 Memory | Memory | Classic card flip |
| 🎨 Art Studio | Creativity | Drawing canvas |
| 📖 Story Time | Reading | 3 read-aloud stories |
| ⌨️ Typing | Typing | Learn to type simple words |
| 🤔 Brain Teasers | Logic | "Which doesn't belong?" puzzles |
| 🔤 **Phonics** 🆕 | Reading | Letter-sound recognition |
| 🌈 **Colour Fun** 🆕 | Creativity | Colour identification |
| 🎵 **Music Maker** 🆕 | Creativity | Musical note exploration |
| 📦 **Sort It Out** 🆕 | Logic | Sort by size |

### 🎯 Quest System
- Generate daily quests for each skill
- Real-time XP progress tracking
- Auto-generates new quests when active ones are completed
- Visual progress bars per skill

### 🏆 Achievements
- Unlockable badges as milestones are reached
- "First Quest", "Star Learner", "Memory Master", and more

### 🎤 Voice Navigation
- Tap the mic and say: "shapes", "counting", "stories", "phonics", "draw", etc.
- LiteLLM fallback for complex commands
- Speech synthesis responses

### 🔒 Parent Dashboard
- Screen time limits
- Skill progress tracking
- 7-day activity history
- Voice toggle
- Content difficulty levels

### ⭐ XP & Progression
- Every activity earns XP in the relevant skill
- Level-up system with scaling XP curve (1.3x per level)
- Learning path milestones

---

## 🚀 Deployment

### Web App (current)
The OS runs as a web app on any device:
```
kids.anakatech.llc → Cloudflare Tunnel → nginx :8002 → Express :3101
```

### Quick Start (Dev)
```bash
cd /var/www/anaka-kids
npm install
node seed-db.js   # Seed demo data
node server.js    # Starts on :3101
```

### Bootable Drive (Phase 3)
For Raspberry Pi or old laptops:
```bash
sudo ./build-bootable-image.sh
```
Writes a Raspberry Pi OS Lite image configured for:
- Chromium in full-screen kiosk mode
- Read-only root filesystem (unbreakable)
- Auto-boot on power-on
- WiFi auto-config
- No keyboard needed after setup

---

## 🗂 Project Structure
```
anaka-kids-os/
├── server.js              # Express server + SQLite API
├── build-bootable-image.sh  # Bootable drive builder
├── seed-db.js             # Demo data seeder
├── public/
│   ├── index.html         # Main OS shell (desktop + games + voice)
│   └── parent.html        # Parent dashboard
├── data/                  # SQLite databases
│   └── anaka-kids.db
├── docs/screenshots/      # Screenshots for preview
└── package.json
```

---

## 🔧 Tech Stack
- **Backend:** Node.js + Express + better-sqlite3
- **Frontend:** Vanilla JS + CSS (no frameworks)
- **Voice:** Web Speech API + LiteLLM endpoint
- **Deployment:** nginx + Cloudflare Tunnel
- **Infrastructure:** Proxmox (Astra Server)

---

## 📋 Roadmap

### Phase 1 ✅ — Base OS (Complete)
- Profile selection
- 8 games
- Parent dashboard
- Basic voice commands
- XP system

### Phase 2 ✅ — Enhanced Learning (Complete)
- 4 new games (Phonics, Colours, Music, Sorting)
- Quest engine with daily generation
- Achievement system
- LiteLLM voice integration
- Learning path milestones

### Phase 3 ✅ — Bootable OS Image (Complete)
- Raspberry Pi OS Lite + x86_64 Ubuntu support (`--arch rpi` / `--arch x64`)
- Chromium kiosk mode with systemd service
- Read-only root filesystem (child-proof)
- First-boot WiFi and kiosk setup via rc.local
- Auto-update check on boot and nightly at 3am
- Bootable USB/SD card with `dd`
- Systemd service template at `systemd/anaka-kiosk.service`

### Phase 4 ✅ — PWA, Themes & AI (Complete)
- **Adaptive difficulty engine** — 5-level difficulty per skill, streak tracking, accuracy-based adjustment
- **Avatar customization** — 20 emoji avatars, name editing, birth year selector
- **Theme system** — 4 kid themes (Ocean, Sunset, Forest, Space), persisted in localStorage
- **ML story generator** — Calls LiteLLM (DeepSeek V4) to generate custom bedtime stories
- **PWA support** — manifest.json, service worker, installable on tablets/phones
- **LiteLLM voice** — Natural language commands fallback to LLM for complex requests

---

## 👨‍👩‍👧‍👧 For Magnolia

Built with ❤️ by Daddy (Nathan A) and Astra (Anakatech Intelligence).
Anakatech LLC © 2026
