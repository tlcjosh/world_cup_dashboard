# ⚽ World Cup 2026 Live Dashboard

A fully responsive single-page web application for tracking FIFA World Cup 2026, hosted on GitHub Pages. Uses a "Dynamic Static" architecture with live score updates sourced directly from ESPN's public API — no backend server required.

## Live Site

`https://tlcjosh.github.io/world_cup_dashboard/`

## Architecture

```
┌─────────────────────────────────────┐
│  Browser (app.js)                   │
│  ├─ ESPN API (every 30s)            │  ← primary live score source
│  │   └─ scores, status, live clock  │
│  └─ data.json (every 2 min)         │  ← full schedule + standings fallback
│      └─ served from GitHub Pages    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  GitHub Actions (every 5 min)       │
│  └─ 30s loop × 10 iterations        │
│     └─ update_tracker.js            │
│        └─ football-data.org API     │
│           └─ commits data.json      │
└────────────────┬────────────────────┘
                 │ git push → deploy to gh-pages
                 ▼
┌─────────────────────────────────────┐
│  GitHub Pages (gh-pages branch)     │
│  └─ src/index.html + app.js         │
│     ├─ Dashboard (live clock)       │
│     ├─ Schedule                     │
│     ├─ Standings (A–L + 3rd)        │
│     └─ Knockout Bracket             │
└─────────────────────────────────────┘
```

**Update latency**: Live scores update every ~30 seconds via ESPN directly in the browser. The data.json fallback (GitHub Pages deploy) has ~5–7 minute end-to-end latency.

## Setup

### 1. Add the API secret
In GitHub → Settings → Secrets → Actions, add:
- **Name:** `FD_API_TOKEN`
- **Value:** your [football-data.org](https://www.football-data.org) API token

### 2. Enable GitHub Pages
In GitHub → Settings → Pages:
- Source: **Deploy from a branch**
- Branch: `gh-pages` / root

### 3. Trigger the first deploy
Push anything to `main`. The workflow will run, bootstrap `data.json` from the API if needed, and deploy to `gh-pages`.

## File Structure

```
world_cup_dashboard/
├── .github/workflows/
│   └── sync.yml              # Cron sync + gh-pages deploy
├── blueprint_data/           # Legacy CSVs (reference only, not used at runtime)
├── scripts/
│   └── update_tracker.js     # API sync + self-bootstrap (used by Actions)
├── src/
│   ├── index.html            # SPA shell
│   ├── styles.css            # Light modern theme (Anybody variable font, gradient accents)
│   ├── app.js                # All frontend logic (vanilla JS)
│   └── data/
│       ├── data.json         # Match data + standings (auto-updated by Actions)
│       └── combinations.json # 3rd-place wildcard lookup (static)
├── package.json
├── README.md
└── CLAUDE.md                 # AI assistant context
```

## Views

| View | Description |
|---|---|
| **Dashboard** | Hero banner with stage/day label and live/today/total stats; full-width Live & Today card; dynamic Group Standings panel for the current live game's group (falls back to most-played group); Up Next card; team search filter |
| **Schedule** | All 104 fixtures grouped by date (Pacific Time), live scores, group/stage label, winner highlighting |
| **Standings** | Groups A–L tables + 3rd-place wildcard rankings with Official/Live toggle; qualification rows color-coded |
| **Bracket** | Round of 32 → Final grid; slot-based vertical alignment per round; Live mode resolves placeholders from computed standings |

## Design

The UI uses a light, modern design system — no framework, pure CSS custom properties.

| Token | Value |
|---|---|
| Background | `#F5F4F0` warm off-white |
| Surface | `#FFFFFF` cards |
| Brand gradient | `135deg #2563EB → #7C3AED` (blue → violet) |
| Live gradient | `135deg #DC2626 → #EA580C` (red → orange) |
| Heading font | [Anybody](https://fonts.google.com/specimen/Anybody) variable (`wdth 75, weight 900`) |
| Body font | Inter 400/500/600 |

Match cards use a 5-column CSS grid (`1fr auto 96px auto 1fr`) so the score is always centered regardless of team name length. Completed matches show winner/loser styling on team names. The knockout bracket uses slot-based height doubling so each round's cards align vertically with their feeder matches.

## Data Flow

### Live Scores (ESPN)
`app.js` polls `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` every 30 seconds directly from the browser. No API key required — ESPN's public scoreboard API is CORS-friendly. Results are merged into the in-memory match list by team name matching. The sync indicator in the header shows "(ESPN)" when live data is active.

If ESPN is unavailable, the app falls back silently to `data.json` data.

### Schedule / Standings Fallback (data.json)
`update_tracker.js` runs via GitHub Actions every 5 minutes (inner 30s loop × 10). It fetches football-data.org, updates scores and standings, and commits `data.json`. The frontend re-fetches this file every 2 minutes to pick up any schedule changes or knockout match updates that ESPN's date-scoped scoreboard might not include.

### Self-Bootstrap
`update_tracker.js` checks for a missing or empty `data.json` on startup. If found, it bootstraps the full dataset from the API (group stage) + a hardcoded bracket template (knockout rounds), then commits. No manual seeding step required.

### Live Clock
During live matches, the browser ticks the clock forward every second using ESPN's `status.clock` (total elapsed seconds) plus real-time offset since the last fetch. Falls back to `firstHalfStart`/`secondHalfStart` timestamps from `data.json` if ESPN clock data isn't present.

### Cross-Group Matches
WC2026 groups G and H play cross-group matches in rounds 2 and 3 (e.g. Spain G vs Saudi Arabia H). These count toward each team's **own** group standings. The standings computation uses `TEAM_MASTER_DATA` to look up each team's group, not the match's group field.

### 3rd-Place Wildcards
8 of 12 third-place teams advance. The qualifying combination is determined by ranking all 12 third-place teams (pts → gd → gf), taking the top 8, sorting their group letters alphabetically (e.g. `"ABCDEFKL"`), and looking up the resulting string in `combinations.json`.

### Bracket Placeholder Resolution
Knockout match team slots use placeholders resolved at render time:
- `[1A]` → 1st place of Group A
- `[3ABCDF]` → 3rd-place wildcard (via combinations lookup)
- `[W73]` → winner of match #73
- `[L101]` → loser of match #101 (3rd-place match)

## Development

```bash
npm install

# Test API sync locally (bootstraps if data.json missing, otherwise updates)
FD_API_TOKEN=your_token node scripts/update_tracker.js

# Serve frontend
npx serve src/
```
