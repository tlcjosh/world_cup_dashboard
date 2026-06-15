# ⚽ World Cup 2026 Live Dashboard

A fully responsive single-page web application for tracking FIFA World Cup 2026, hosted on GitHub Pages. Uses a "Dynamic Static" architecture: a GitHub Actions workflow polls the football-data.org API every 30 seconds and commits updated match data to `src/data/data.json`. The frontend fetches that file and renders everything client-side — no server required.

## Live Site

`https://tlcjosh.github.io/world_cup_dashboard/`

## Architecture

```
┌─────────────────────────────────┐
│  GitHub Actions (every 5 min)   │
│  └─ 30s loop × 10 iterations    │
│     └─ update_tracker.js        │
│        └─ football-data.org API │
│           └─ commits data.json  │
└───────────────┬─────────────────┘
                │ git push → deploy to gh-pages
                ▼
┌─────────────────────────────────┐
│  GitHub Pages (gh-pages branch) │
│  └─ src/index.html + app.js     │
│     ├─ Dashboard (live clock)   │
│     ├─ Schedule                 │
│     ├─ Standings (A–L + 3rd)    │
│     └─ Knockout Bracket         │
└─────────────────────────────────┘
```

**Update latency**: data.json is polled up to 10 times per 5-minute window, but the GitHub Pages deploy only runs once after the full sync — expect ~5–7 minutes end-to-end.

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
│   ├── styles.css            # Dark sports-dashboard theme
│   ├── app.js                # All frontend logic (vanilla JS)
│   └── data/
│       ├── data.json         # Match data + standings (auto-updated)
│       └── combinations.json # 3rd-place wildcard lookup (static)
├── package.json
├── README.md
└── CLAUDE.md                 # AI assistant context
```

## Views

| View | Description |
|---|---|
| **Dashboard** | Live matches with browser-side ticking clock (`45+2′` stoppage time), recent results, next 5 fixtures, team search |
| **Schedule** | All 104 fixtures grouped by date (Pacific Time), live scores, status badges |
| **Standings** | Groups A–L tables + 3rd-place wildcard rankings with Official/Live toggle |
| **Bracket** | Round of 32 → Final grid; Live mode resolves placeholders from computed standings |

## Data Flow

### Self-Bootstrap
`update_tracker.js` checks for a missing or empty `data.json` on startup. If found, it bootstraps the full dataset from the API (group stage) + a hardcoded bracket template (knockout rounds), then commits. No manual seeding step required.

### Live Clock
`firstHalfStart` and `secondHalfStart` are UTC ISO timestamps set by `update_tracker.js` the first time a match transitions to `IN_PLAY`. The browser calculates elapsed minutes client-side with `setInterval` every second.

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
