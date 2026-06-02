# Anaka Kids OS v2 — Powerhouse Edition

## Goal
Transform Anaka Kids OS from a learning game collection into an **immersive, kid-addictive world** that teaches finance, crypto, blockchain, banking, and business basics alongside core skills — giving Magnolia (and every child) the tools to be an absolute powerhouse.

## Design Principles
- **Ages 5-10** — everything must be playable by a 5yo, deep enough for a 10yo
- **Voice-first** — the mascot talks to them, reads everything aloud
- **Immediate dopamine** — every action has a reward animation/sound
- **Progressive complexity** — finance concepts start as "collect coins" at 5, become "invest in businesses" at 10
- **No boring screens** — every page has animation, interaction, or a game

---

## PHASE 1: Immersive World & Mascot

### 1.1 Mascot Guide — "Astra the Star" 🌟
- Animated star character that greets the child, guides them, celebrates wins
- SVG animated character with expressions (happy, thinking, celebration, sleepy)
- Speaks using SpeechSynthesis — narrates everything
- Sits in corner or pops up on events
- Has a name (child can rename them!)
- Grows / gets new accessories as child levels up

### 1.2 Main World View
Replace the flat app grid with a **kid-friendly world / island map**:
- Center: Home base / treehouse (where the child's avatar lives)
- Around it: Zones they can tap to enter:
  - 🌳 **Learning Grove** (reading, math, science games)
  - 🏦 **Moneyville** (finance, crypto, banking)
  - 🏪 **Market Street** (business, trading, shops)
  - 🎨 **Art Studio** (drawing, music, creativity)
  - 🏆 **Achievement Hall** (trophies, badges, progress)
- Paths light up as they unlock new areas
- Seasonal decorations (Christmas, Easter, birthdays)

### 1.3 Sound & Music System
- Background music (gentle, switchable themes)
- Sound effects for: correct answer, wrong answer, level up, coin earned, achievement
- Voice narration toggle
- Volume controls in parent dashboard

### 1.4 Pet/Reward System
- Virtual pet that lives in the treehouse
- Pet levels up as child learns
- Pet needs care (feed = do lessons)
- Different pets to unlock

---

## PHASE 2: Finance & Crypto Basics

### 2.1 Coin Economy (already partially exists with XP)
- Rename XP to **AnakaCoins** 🪙
- Coins earned from every game/lesson
- Visual coin counter always visible
- Coin shower animation on earning

### 2.2 "Moneyville" — Finance Learning Zone
- **Piggy Bank** — drag coins into piggy, watch it fill up. Teaches savings.
- **Earn & Spend** — earn coins for chores/lessons, spend on pet accessories, themes, decorations
- **Savings Goals** — "I want the rocket ship toy! It costs 500 coins." Shows progress bar.
- **Simple Interest** — "Put coins in the Bank and they GROW!" 5% daily interest
- **Needs vs Wants** — sorting game: is this a need (food) or a want (toy)?

### 2.3 "Crypto Canyon" — Blockchain Basics
- **Block Builder** — tap blocks to build a chain. Each block has a "magic number" (hash). Shows how blocks connect.
- **Mining Game** — "Dig for digital gold!" Simple puzzle game. Each solve = "mined a block" = earns coins.
- **My Wallet** — shows their balance, transaction history as cute icons
  - "You got 10 coins from Phonics!"
  - "You sent 5 coins to Piggy Bank!"
- **NFT Gallery** — their achievements are "NFTs" (digital badges) they can view
- Simple concept: "Just like your piggy bank is for coins, a blockchain wallet is for digital coins"

### 2.4 "Anaka Bank" — Banking Basics
- Virtual bank building in Moneyville
- **Deposit/Withdraw** — move coins from pocket to bank
- **Interest** — "The bank pays you for keeping coins here!"
- **Loan Basics** — "Borrow 100 coins, pay back 110" — simple story about borrowing
- **Bank Teller Game** — count coins, give correct change

---

## PHASE 3: Business & Entrepreneurship

### 3.1 "Market Street" — Business Zone
- **Lemonade Stand** — classic: buy lemons, set price, serve customers
  - Weather affects sales (hot day = more customers)
  - Set your own price — too high? Too low?
  - Profit/loss tracking
- **Cookie Shop** — bake and decorate, sell to customers
- **Toy Stall** — trade/barter with virtual friends
- **My Shop** — custom shop with name, logo, products
- **Supply & Demand** — simple: "Everyone wants cookies today! You can charge more!"

### 3.2 Entrepreneur Quests
- "Start your first business!" quest chain
- Business plan template for kids (draw/write what you'll sell)
- Profit tracker with charts
- Business leveling system (lemonade stand → shop → franchise)

### 3.3 Basic Economics
- **Supply & Demand** game — "There are 5 toys but 10 kids want them. What happens to the price?"
- **Budgeting** — "You have 100 coins. Buy supplies for your shop AND save for the toy you want."
- **Charity/Community** — donate coins to "plant a tree" in the virtual world

---

## PHASE 4: Polish & Engagement Loop

### 4.1 Daily Rewards
- Calendar: login each day for a streak bonus
- Day 7: big reward (new pet accessory, theme, etc.)
- Streak counter on home screen

### 4.2 Growth System
- **Anaka Tree** 🌳 — a tree that grows as the child learns. Each lesson = water/nutrients. Tree progresses from seed → sapling → tree → blossoming → magical tree
- All children on the device see the same tree (family tree concept)

### 4.3 Achievement Animations
- Every achievement triggers a mini celebration:
  - Confetti burst
  - Mascot does a happy dance
  - Sound effect
  - "SHARE" button to show parents

### 4.4 Parent Dashboard Upgrades
- Finance tracker: "Magnolia saved 150 coins this week!"
- Business report: "Her lemonade stand made 45 coins profit!"
- Time spent per zone
- Milestone notifications to parent's phone
- Goal setting: parent sets learning goals, child sees them

---

## Technical Implementation Plan

### Files to Modify
- `/var/www/anaka-kids/public/index.html` — main UI (this is where ALL changes go)
- `/var/www/anaka-kids/server.js` — backend endpoints for economy, banking, business

### New Files to Create
- `/var/www/anaka-kids/public/mascot.js` — Astra mascot character + animations
- `/var/www/anaka-kids/public/economy.js` — coin/banking/business game logic
- `/var/www/anaka-kids/public/world-map.js` — island world map view
- `/var/www/anaka-kids/public/sounds/` — sound effect files (or generate with Web Audio API)

### Database Schema Additions
```sql
-- Economy
CREATE TABLE IF NOT EXISTS economy (
  child_id INTEGER PRIMARY KEY,
  coins INTEGER DEFAULT 0,
  bank_balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER,
  type TEXT,
  name TEXT,
  level INTEGER DEFAULT 1,
  profit INTEGER DEFAULT 0,
  inventory INTEGER DEFAULT 10,
  price INTEGER DEFAULT 5
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER,
  type TEXT,
  amount INTEGER,
  description TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);
```

### Implementation Order
1. First: Economy system (coins, bank, transactions) — this underpins everything
2. Second: Mascot guide + world map — the immersive shell
3. Third: Moneyville finance games
4. Fourth: Market Street business games
5. Fifth: Crypto Canyon blockchain basics
6. Sixth: Polish — daily rewards, animations, tree growth, parent dashboard
