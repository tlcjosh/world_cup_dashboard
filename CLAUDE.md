# World Cup 2026 Dashboard — Claude Context

## What This Is
A "Dynamic Static" single-page app tracking FIFA World Cup 2026. The frontend polls ESPN's public scoreboard API every 30 seconds directly from the browser for live scores. GitHub Actions backs this up by polling football-data.org every 5 minutes and committing `src/data/data.json`, which the frontend uses for the full match schedule and standings. No backend server.

## Repo & Deployment
- **Repo**: `tlcjosh/world_cup_dashboard` (public)
- **Branch**: push changes to `main` directly
- **Site**: `https://tlcjosh.github.io/world_cup_dashboard/`
- **Pages**: served from `gh-pages` branch root (auto-deployed by Actions after each sync)

## Key Files

| File | Role |
|---|---|
| `scripts/update_tracker.js` | Single pipeline script. Bootstraps `data.json` from API if missing; otherwise syncs scores/status. Run by Actions. Has `TEAM_MASTER_DATA` and `BRACKET_TEMPLATE` embedded. |
| `.github/workflows/sync.yml` | Cron `*/5 * * * *`, inner `sleep 30` loop × 10. Git config runs BEFORE the sync script. Deploy job pushes `src/` to `gh-pages` after sync. |
| `src/app.js` | Entire frontend. Vanilla ES module, no framework. Has its own `TEAM_MASTER_DATA` copy. Includes ESPN integration block at the top. Render functions: `matchCardHtml()`, `renderDashboard()`, `renderSchedule()`, `renderStandings()`, `renderBracket()`. |
| `src/styles.css` | Light modern design system. CSS custom properties in `:root`. Anybody variable font for headings (wdth 75, weight 900), Inter for body. |
| `src/data/data.json` | Auto-updated by Actions. Contains `matches[]`, `standings{}`, `lastUpdated`. Used as schedule backbone and fallback. |
| `src/data/combinations.json` | Static. 495 entries keyed by 8-letter sorted group string (e.g. `"ABCDEFKL"`). Values map opponent keys (`"1A"` through `"1L"`) to team codes (`"3F"`). Never changes. |
| `blueprint_data/` | Legacy CSV files. No longer used at runtime — reference only. |
| `scripts/bootstrap.js` | Legacy CSV parser. No longer used — `update_tracker.js` self-bootstraps from API. |

## Frontend Design System

Light modern theme — no CSS framework. All design tokens live in `:root` in `styles.css`.

### Key CSS Variables
```css
--bg: #F5F4F0          /* warm off-white page background */
--surface: #FFFFFF      /* card surfaces */
--surface-2: #EEECE8    /* secondary surface (finished badge bg) */
--border: #E0DDD7       /* subtle borders */
--ink / --ink-2 / --ink-3  /* text hierarchy */
--grad-brand: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)  /* blue→violet */
--grad-live:  linear-gradient(135deg, #DC2626 0%, #EA580C 100%)  /* red→orange */
--r: 12px               /* default border-radius */
--bs: 96px              /* bracket slot base height */
```

### Fonts
- **Headings**: `Anybody` variable font, `font-variation-settings: 'wdth' 75; font-weight: 900`. Loaded from Google Fonts with full axis range (`ital,wdth,wght@0,50..100,100..900`).
- **Body**: `Inter` 400/500/600

### Match Card Layout
`.match-card` uses `display: flex` with two children:
1. `.match-inner` — 5-column grid: `1fr auto 96px auto 1fr` (home name | home flag | score | away flag | away name). Ensures score is always centered regardless of name lengths.
2. `.match-status` — fixed `width: 160px`, right-aligned; contains badge + venue text.

Live cards get a CSS gradient border via `background: linear-gradient(surface, surface) padding-box, grad-live border-box`.

Winner/loser classes on team names: `.team-name.winner` (bold) / `.team-name.loser` (muted).

### Bracket Slot Layout
Each match in the bracket is wrapped in `.b-slot`. Slot heights double per round so cards center vertically between their feeder matches:
- `r32`: `height: var(--bs)` (96px)
- `r16`: `height: calc(2 * var(--bs))`
- `rqf`: `height: calc(4 * var(--bs))`
- `rsf` / `rfin`: `height: calc(8 * var(--bs))`

Round containers: `.bracket-round.r32`, `.bracket-round.r16`, etc.

### Standings Row Classes
- `q1` — 1st place (green left border)
- `q2` — 2nd place (green left border)
- `q3` — 3rd place (amber left border, potential wildcard)
- `wildcard-qualify` — top 8 third-place teams in wildcard table (blue left border)

### CSS Class Reference (app.js → styles.css)
| Element | Class |
|---|---|
| Match card | `.match-card`, `.match-card.live` |
| 5-col grid | `.match-inner` |
| Home/away cells | `.match-home`, `.match-away` |
| Score column | `.score-col > .score`, `.score-sub.live.match-clock` |
| Status column | `.match-status > .venue` |
| Team name | `.team-name`, `.team-name.winner`, `.team-name.loser` |
| Brackets | `.b-match`, `.b-slot`, `.b-team`, `.b-team-name`, `.b-score`, `.b-num`, `.b-div` |
| Round wrapper | `.bracket-round.r32/.r16/.rqf/.rsf/.rfin` |
| Group header | `.group-header > .group-pill + .group-name` |
| Position | `.pos` |

### Badge Classes
| Status | Class |
|---|---|
| Live | `.badge.badge-live` |
| Half-time | `.badge.badge-ht` |
| Full-time | `.badge.badge-ft` |
| Scheduled | `.badge.badge-soon` |

## Live Score Architecture

### Primary: ESPN API (browser-side, every 30s)
`fetchESPN()` in `app.js` polls:
```
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```
No API key required. CORS-friendly — works directly from browser JS. Returns only **today's** matches, so it overlays live data on top of the full schedule from `data.json`.

`mergeESPNData()` matches ESPN events to `state.matches` by team display name, updates `status`/`homeScore`/`awayScore`, and stores `_espnClock`/`_espnPeriod`/`_espnFetchedAt` for the live clock tick.

### Fallback: data.json (every 2 minutes)
`fetchData()` re-fetches `data.json` every 2 minutes to pick up schedule changes, knockout match updates, and standings corrections. If ESPN is unavailable, data.json is the sole data source.

### ESPN Team Name Map
`ESPN_NAME_MAP` in `app.js` normalizes ESPN display names to our `TEAM_MASTER_DATA` keys. Known mismatches:
- `"Cape Verde"` → `"Cape Verde Islands"`

Add new entries here as mismatches are discovered during the tournament.

### ESPN Status Map
ESPN status names → our internal status values:
- `STATUS_SCHEDULED` → `SCHEDULED`
- `STATUS_FIRST_HALF` / `STATUS_SECOND_HALF` → `IN_PLAY`
- `STATUS_HALFTIME` → `PAUSED`
- `STATUS_FULL_TIME` / `STATUS_FINAL_AET` / `STATUS_FINAL_PEN` → `FINISHED`

## Data Structures

### `data.json` match object
```json
{
  "matchId": 537327,
  "matchNum": 1,
  "stage": "Group Stage",
  "group": "A",
  "homeTeam": "Mexico",
  "homeIso": "mx",
  "awayTeam": "South Africa",
  "awayIso": "za",
  "venue": "Estadio Azteca, Mexico City",
  "kickoff": "2026-06-11T19:00:00.000Z",
  "homeScore": 2,
  "awayScore": 0,
  "status": "FINISHED",
  "firstHalfStart": null,
  "secondHalfStart": null
}
```
- All timestamps are UTC ISO strings
- Scores are `null` for unplayed matches, integers (including 0) when played
- Status values: `FINISHED` | `IN_PLAY` | `PAUSED` | `SCHEDULED`
- `group` on a match is set from the home team's group (for display in Schedule). Cross-group matches (e.g. Spain G vs Saudi Arabia H) will show under the home team's group.
- Knockout matches use placeholder strings for teams: `[1A]`, `[2C]`, `[3ABCDF]`, `[W73]`, `[L101]`
- `matchNum` 1–72 = Group Stage; 73–88 = R32; 89–96 = R16; 97–100 = QF; 101–102 = SF; 103 = 3rd Place; 104 = Final

### In-memory match fields added by ESPN (not in data.json)
| Field | Type | Description |
|---|---|---|
| `_espnClock` | number | Total elapsed seconds from kickoff at last ESPN fetch |
| `_espnPeriod` | number | 1 = first half, 2 = second half |
| `_espnFetchedAt` | number | `Date.now()` at last ESPN fetch, for real-time clock tick |

### `data.json` standings object
```json
{
  "A": [
    { "team": "Mexico", "iso": "mx", "played": 1, "won": 1, "drawn": 0, "lost": 0, "gf": 2, "ga": 0, "gd": 2, "pts": 3 }
  ]
}
```
Teams sorted: pts → gd → gf → team name alphabetically.

## Tournament Logic

### Cross-Group Matches (WC2026 format)
Groups G and H (and possibly others) play cross-group matches in rounds 2 and 3. For example, Spain (G) plays Saudi Arabia (H). These count toward each team's **own** group standings — Spain's result goes to Group G, Saudi Arabia's to Group H.

**Critical**: `computeStandings()` in both `update_tracker.js` and `app.js` uses `TEAM_MASTER_DATA[team].group` to determine each team's group — NOT the match's `group` field. This is what makes cross-group matches score correctly.

ESPN's `altGameNote` field (e.g. `"FIFA World Cup, Group H"`) reflects the home team's group — consistent with our `data.json` convention.

### Group Assignments (Groups G & H — easy to confuse)
- **Group G**: Spain, Cape Verde Islands, Belgium, Egypt
- **Group H**: Saudi Arabia, Uruguay, Iran, New Zealand

### 3rd-Place Wildcard
8 of 12 third-place teams advance. Logic in `app.js` → `computeThirdPlaceRankings()`:
1. Get position-3 team from each group's standings
2. Sort all 12 by pts → gd → gf
3. Top 8 qualify; their group letters sorted alphabetically = combination string (e.g. `"ABCDEFKL"`)
4. `combinations.json[combString]` maps `"1A"` ... `"1L"` → `"3X"` team codes

### Bracket Slot Mapping
Each 3rd-place bracket slot placeholder determines which combinations.json column to look up:
```
"[3CEFHI]" → faces 1A → combinations["1A"]
"[3EFGIJ]" → faces 1B → combinations["1B"]
"[3BEFIJ]" → faces 1D → combinations["1D"]
"[3ABCDF]" → faces 1E → combinations["1E"]
"[3AEHIJ]" → faces 1G → combinations["1G"]
"[3CDFGH]" → faces 1I → combinations["1I"]
"[3DEIJL]" → faces 1K → combinations["1K"]
"[3EHIJK]" → faces 1L → combinations["1L"]
```
Defined in `app.js` as `SLOT_TO_OPPONENT`.

### Live Clock
`getMatchMinute()` prefers ESPN clock data when available:
- `elapsedSec = _espnClock + (Date.now() - _espnFetchedAt) / 1000`
- Period 1: `Math.floor(elapsedSec / 60)` → capped at `45+N′`
- Period 2: same → capped at `90+N′`

Falls back to `firstHalfStart`/`secondHalfStart` timestamps from `data.json` if ESPN clock data is absent.

`update_tracker.js` still sets `firstHalfStart`/`secondHalfStart` as before — these remain valid fallback anchors.

### Official vs Live Toggle
- **Official**: standings computed from `FINISHED` matches only
- **Live**: standings computed from `FINISHED` + `IN_PLAY` + `PAUSED` (uses current score)
- Toggle affects: Standings view, 3rd-place wildcard table, Bracket placeholder resolution
- State stored in `state.liveMode` (boolean), toggled via `#live-mode-toggle` checkbox

## TEAM_MASTER_DATA
All 48 teams with group assignments and ISO codes are embedded in both `scripts/update_tracker.js` and `src/app.js`. If you change a group assignment, update **both** files.
- Scotland: `iso: "scotland"` → flag rendered as `gb-sct` on flagcdn.com
- England: `iso: "england"` → flag rendered as `gb-eng` on flagcdn.com
- All others: standard 2-letter ISO → `https://flagcdn.com/24x18/{iso}.png`

## BRACKET_TEMPLATE
Matches 73–104 (knockout bracket) are hardcoded in `update_tracker.js` as `BRACKET_TEMPLATE`. These are pure tournament structure: placeholder team strings, kickoff times, venues. The API does not provide these until matches are actually scheduled.

## Bootstrap Behavior
`update_tracker.js` checks if `data.json` is missing or empty on startup. If so, it:
1. Fetches the API for all group stage matches
2. Sorts by kickoff time (secondary: home team name) and assigns `matchNum` 1–72
3. Appends `BRACKET_TEMPLATE` as matches 73–104
4. Writes and commits `data.json`

## API Integration (football-data.org)
- Endpoint: `https://api.football-data.org/v4/competitions/WC/matches?season=2026`
- Auth header: `X-Auth-Token: {FD_API_TOKEN}`
- Token stored in GitHub secret `FD_API_TOKEN`; never hardcoded
- Match lookup: by `matchId` first, falls back to `cleanName()` normalization
- Self-heals `matchId: null` entries on knockout matches via name matching

## Update Latency
- **Live scores**: ~30 seconds (ESPN, browser-direct)
- **data.json / standings**: ~5–7 minutes end-to-end (Actions cron → gh-pages deploy)

## Known Issues / Watch Points
1. **ESPN name mismatches**: If a match isn't getting ESPN updates, check `ESPN_NAME_MAP` in `app.js`. Add the mapping and push to fix.
2. **ESPN scoreboard is date-scoped**: Only returns today's matches. Full 104-match schedule always comes from `data.json`.
3. **Cross-group match standings**: must use `TEAM_MASTER_DATA[team].group`, not `m.group` — see above
4. **Knockout matchId population**: R32+ matches start with `matchId: null`. Self-healed via name matching once the API returns them.
5. **Half-time timestamp source**: `firstHalfStart`/`secondHalfStart` are set by the Actions runner clock, not the API — accurate to within one 30-second polling interval. ESPN clock is preferred when available.
6. **Group standings sort**: always use `Object.keys().sort()` when iterating groups — key order in JSON is not guaranteed

## Running Locally
```bash
npm install

# Test API sync (bootstraps data.json if missing, otherwise updates)
FD_API_TOKEN=xxx node scripts/update_tracker.js

# Serve frontend
npx serve src/
```

## Deployment
1. Push to `main` → triggers workflow → syncs data → deploys to `gh-pages`
2. GitHub Pages serves `gh-pages` branch root
3. Site: `https://tlcjosh.github.io/world_cup_dashboard/`
4. Cron: `*/5 * * * *` with 30-second inner loop (10 API calls per 5-min window)
