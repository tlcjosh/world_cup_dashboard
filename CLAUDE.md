# World Cup 2026 Dashboard — Claude Context

## What This Is
A "Dynamic Static" single-page app tracking FIFA World Cup 2026. GitHub Actions polls the football-data.org API every 30 seconds (via a 10-iteration loop inside a 5-minute cron job) and commits updated match data to `src/data/data.json`. The frontend (GitHub Pages, serving the `src/` directory) fetches that file client-side. No backend server.

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
| `src/app.js` | Entire frontend. Vanilla ES module, no framework. Has its own `TEAM_MASTER_DATA` copy. |
| `src/data/data.json` | Auto-updated by Actions. Contains `matches[]`, `standings{}`, `lastUpdated`. |
| `src/data/combinations.json` | Static. 495 entries keyed by 8-letter sorted group string (e.g. `"ABCDEFKL"`). Values map opponent keys (`"1A"` through `"1L"`) to team codes (`"3F"`). Never changes. |
| `blueprint_data/` | Legacy CSV files. No longer used at runtime — reference only. |
| `scripts/bootstrap.js` | Legacy CSV parser. No longer used — `update_tracker.js` self-bootstraps from API. |

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
`update_tracker.js` sets `firstHalfStart` (UTC ISO) the first time a match goes `IN_PLAY`.
If status was `PAUSED` and transitions back to `IN_PLAY`, `secondHalfStart` is set.
Browser computes elapsed minutes in `getMatchMinute()` using `Date.now()`.
Stoppage time: if elapsed > 45 min in first half → `45+N′`; if elapsed > 90 min total → `90+N′`.

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

## API Integration
- Endpoint: `https://api.football-data.org/v4/competitions/WC/matches?season=2026`
- Auth header: `X-Auth-Token: {FD_API_TOKEN}`
- Token stored in GitHub secret `FD_API_TOKEN`; never hardcoded
- Match lookup: by `matchId` first, falls back to `cleanName()` normalization
- Self-heals `matchId: null` entries on knockout matches via name matching

## Update Latency
The 30-second inner loop captures score changes within each 5-minute cron window (up to 10 API snapshots). However, data only reaches users after the full sync job + GitHub Pages deploy — typically **5–7 minutes** end-to-end. There is no way to push updates faster within this architecture.

## Known Issues / Watch Points
1. **Cross-group match standings**: must use `TEAM_MASTER_DATA[team].group`, not `m.group` — see above
2. **Knockout matchId population**: R32+ matches start with `matchId: null`. Self-healed via name matching once the API returns them.
3. **Half-time timestamp source**: `firstHalfStart`/`secondHalfStart` are set by the Actions runner clock, not the API — accurate to within one 30-second polling interval
4. **Group standings sort**: always use `Object.keys().sort()` when iterating groups — key order in JSON is not guaranteed

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
