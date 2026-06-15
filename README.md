# ⚽ World Cup 2026 Live Dashboard

A fully responsive single-page web application for tracking FIFA World Cup 2026, hosted on GitHub Pages. Uses a "Dynamic Static" architecture: a GitHub Actions workflow polls the football-data.org API every 30 seconds and commits updated match data to `src/data/data.json`. The frontend fetches that file and renders everything client-side — no server required.

## Live Site

Deployed at: `https://tlcjosh.github.io/world_cup_dashboard/`

## Architecture

```
┌─────────────────────────────────┐
│  GitHub Actions (every 5 min)   │
│  └─ 30s loop × 10 iterations    │
│     └─ update_tracker.js        │
│        └─ football-data.org API │
│           └─ commits data.json  │
└───────────────┬─────────────────┘
                │ git push
                ▼
┌─────────────────────────────────┐
│  src/data/data.json  (static)   │
│  src/data/combinations.json     │
└───────────────┬─────────────────┘
                │ fetch every 30s
                ▼
┌─────────────────────────────────┐
│  GitHub Pages (src/ directory)  │
│  └─ index.html + app.js         │
│     ├─ Dashboard (live clock)   │
│     ├─ Schedule                 │
│     ├─ Standings (A–L + 3rd)    │
│     └─ Knockout Bracket         │
└─────────────────────────────────┘
```

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
The workflow runs on every push to `main` and on a 5-minute cron schedule. Merging the PR will trigger the first deploy automatically.

### 4. Bootstrap (one-time, already done)
```bash
npm install
node scripts/bootstrap.js
```
This parses the blueprint CSVs and generates the initial `src/data/data.json` and `src/data/combinations.json`. Only needs to be re-run if you reset match data.

## File Structure

```
world_cup_dashboard/
├── .github/workflows/
│   └── sync.yml              # Cron sync + gh-pages deploy
├── blueprint_data/           # Source CSVs (reference only)
│   ├── schedule_sheet.csv.csv
│   ├── standings_sheet.csv
│   ├── knockout_bracket_sheet.csv
│   ├── third_place_combinations_sheet.csv
│   ├── 3rd_place_rankings_sheet.csv
│   └── example_sheet_formulas.md
├── scripts/
│   ├── bootstrap.js          # One-time CSV parser → data.json
│   └── update_tracker.js     # API sync script (run by Actions)
├── src/
│   ├── index.html            # SPA shell
│   ├── styles.css            # Dark sports-dashboard theme
│   ├── app.js                # All frontend logic (vanilla JS)
│   └── data/
│       ├── data.json         # Match data + standings (auto-updated)
│       └── combinations.json # 3rd-place wildcard lookup (static)
├── package.json
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

### Live Clock
`firstHalfStart` and `secondHalfStart` are UTC ISO timestamps set by `update_tracker.js` the first time a match transitions to `IN_PLAY`. The browser calculates elapsed minutes client-side with `setInterval` every second.

### 3rd-Place Wildcards
8 of 12 third-place teams advance. The qualifying combination is determined by ranking all 12 third-place teams (pts → gd → gf), taking the top 8, sorting their group letters alphabetically (e.g. `"ABCDEFKL"`), and looking up the resulting string in `combinations.json` to determine which team fills each of 8 specific bracket slots.

### Bracket Placeholder Resolution
Knockout match team slots use placeholders resolved at render time:
- `[1A]` → 1st place of Group A from computed standings
- `[3ABCDF]` → 3rd-place wildcard (via combinations lookup)
- `[W73]` → winner of match #73
- `[L101]` → loser of match #101 (3rd-place match)

## Development

```bash
npm install

# Regenerate data.json from CSVs
node scripts/bootstrap.js

# Test API sync locally (requires FD_API_TOKEN env var)
FD_API_TOKEN=your_token node scripts/update_tracker.js
```

The frontend is plain HTML/CSS/JS — open `src/index.html` directly in a browser or serve with any static file server:
```bash
npx serve src/
```
