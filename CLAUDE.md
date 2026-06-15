# World Cup 2026 Dashboard — Claude Context

## What This Is
A "Dynamic Static" single-page app tracking FIFA World Cup 2026. GitHub Actions polls the football-data.org API every 30 seconds (via a 10-iteration loop inside a 5-minute cron job) and commits updated match data to `src/data/data.json`. The frontend (GitHub Pages, serving the `src/` directory) fetches that file client-side. No backend server.

## Active PR
**PR #1** — `claude/inspiring-wright-ve5sb8` → `main`
Push all changes to `claude/inspiring-wright-ve5sb8` and they'll update the PR.

## Key Files

| File | Role |
|---|---|
| `scripts/bootstrap.js` | One-time seeder. Parses blueprint CSVs → `src/data/data.json` + `src/data/combinations.json`. Run with `node scripts/bootstrap.js`. |
| `scripts/update_tracker.js` | API sync. Called by Actions workflow (no git ops of its own — workflow handles commit). Reads `data.json`, hits football-data.org, updates scores/status/half-timestamps, rewrites file. |
| `.github/workflows/sync.yml` | Cron `*/5 * * * *`, inner `sleep 30` loop × 10. Git config runs BEFORE the sync script. Deploy job pushes `src/` to `gh-pages` branch after sync. |
| `src/app.js` | Entire frontend. Vanilla ES module, no framework. |
| `src/data/data.json` | Auto-updated by Actions. Contains `matches[]`, `standings{}`, `lastUpdated`. |
| `src/data/combinations.json` | Static. 495 entries keyed by 8-letter sorted group string (e.g. `"ABCDEFKL"`). Values map opponent keys (`"1A"` through `"1L"`) to team codes (`"3F"`). Generated once by bootstrap, never changes. |
| `blueprint_data/` | Source CSVs used by bootstrap. Reference only — not used at runtime. |

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
- Knockout matches use placeholder strings for teams: `[1A]`, `[2C]`, `[3ABCDF]`, `[W73]`, `[L101]`
- `matchNum` 1–72 = Group Stage; 73–88 = R32; 89–96 = R16; 97–100 = QF; 101–102 = SF; 103 = 3rd Place; 104 = Final

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

### 3rd-Place Wildcard
8 of 12 third-place teams advance. Logic in `app.js` → `computeThirdPlaceRankings()`:
1. Get position-3 team from each group's standings
2. Sort all 12 by pts → gd → gf
3. Top 8 qualify; their group letters sorted alphabetically = combination string (e.g. `"ABCDEFKL"`)
4. `combinations.json[combString]` maps `"1A"` ... `"1L"` → `"3X"` team codes

### Bracket Slot Mapping
Each 3rd-place bracket slot placeholder encodes its possible sources AND determines lookup column:
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
`update_tracker.js` sets `firstHalfStart` (UTC ISO) the first time a match goes `IN_PLAY`.
If status was `PAUSED` and transitions back to `IN_PLAY`, `secondHalfStart` is set.
Browser computes elapsed minutes in `getMatchMinute()` using `Date.now()`.
Stoppage time: if elapsed > 45 min in first half → `45+N′`; if elapsed > 90 min total → `90+N′`.

### Official vs Live Toggle
- **Official**: standings computed from `FINISHED` matches only
- **Live**: standings computed from `FINISHED` + `IN_PLAY` + `PAUSED` (uses current score)
- Toggle affects: Standings view, 3rd-place wildcard table, Bracket placeholder resolution
- State stored in `state.liveMode` (boolean), toggled via `#live-mode-toggle` checkbox

## Team Master Data
All 48 teams with group assignments and ISO codes are embedded in both `scripts/bootstrap.js`, `scripts/update_tracker.js`, and `src/app.js` as `TEAM_MASTER_DATA`.
- Scotland: `iso: "scotland"` → flag rendered as `gb-sct` on flagcdn.com
- England: `iso: "england"` → flag rendered as `gb-eng` on flagcdn.com
- All others: standard 2-letter ISO → `https://flagcdn.com/24x18/{iso}.png`

## API Integration
- Endpoint: `https://api.football-data.org/v4/competitions/WC/matches?season=2026`
- Auth header: `X-Auth-Token: {FD_API_TOKEN}`
- Token stored in GitHub secret `FD_API_TOKEN`; never hardcoded
- Match lookup: by `matchId` first, falls back to `cleanName()` normalization
- Home/away reversal: detected when API home team ≠ our stored home team; scores swapped accordingly

## Known Issues / Watch Points
1. **`update_tracker.js` `cleanName` regex** uses raw combining diacritics range — if name matching breaks for accented teams, check this regex first
2. **Knockout matchId population**: R32+ matches have `matchId: null` in bootstrap. `update_tracker.js` self-heals these via name matching once the API returns them
3. **Group standings sort order** in `data.json` may differ from `standings{}` keys order — always use `Object.keys().sort()` when iterating groups
4. **Half-time timestamp source**: `firstHalfStart`/`secondHalfStart` are set by the Actions runner clock, not the API — they'll be accurate to within one 30-second polling interval

## Running Locally
```bash
npm install
node scripts/bootstrap.js           # regenerate data.json from CSVs
FD_API_TOKEN=xxx node scripts/update_tracker.js  # test API sync
npx serve src/                      # serve frontend at localhost:3000
```

## Deployment
1. Merge PR to `main` → triggers workflow → deploys to `gh-pages` branch
2. GitHub Pages serves `gh-pages` branch root
3. Site URL: `https://tlcjosh.github.io/world_cup_dashboard/`
4. Workflow cron: `*/5 * * * *` with 30-second inner loop (10 API calls per 5-min window)
