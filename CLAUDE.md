# World Cup 2026 Dashboard — Claude Context

## What This Is
A "Dynamic Static" single-page app tracking FIFA World Cup 2026. The frontend polls ESPN's public scoreboard API every 10 seconds directly from the browser for live scores. GitHub Actions backs this up by polling football-data.org every 5 minutes and committing `src/data/data.json`, which the frontend uses for the full match schedule and standings. No backend server.

## Repo & Deployment
- **Repo**: `tlcjosh/world_cup_dashboard` (public)
- **Branch**: push changes to `main` directly
- **Site**: `https://tlcjosh.github.io/world_cup_dashboard/`
- **Pages**: served from `gh-pages` branch root (auto-deployed by Actions after each sync)

## Key Files

| File | Role |
|---|---|
| `scripts/update_tracker.js` | Single pipeline script. Bootstraps `data.json` from API if missing; otherwise syncs scores/status, then syncs fair play points for newly-finished matches via ESPN. Run by Actions. Has `TEAM_MASTER_DATA` (with `espnId` per team), `ESPN_NAME_MAP`, and `BRACKET_TEMPLATE` embedded. |
| `.github/workflows/sync.yml` | Cron `*/5 * * * *`, inner `sleep 30` loop × 10. Git config runs BEFORE the sync script. Deploy job pushes `src/` to `gh-pages` after sync. |
| `src/app.js` | Entire frontend. Vanilla ES module, no framework. Has its own `TEAM_MASTER_DATA` copy. Includes ESPN integration block at the top. Render functions: `matchCardHtml()`, `renderDashboard()`, `renderSchedule()`, `renderStandings()`, `renderBracket()`. Dashboard also calls `getTodayMatches()` and `computeStandings()` for the live group widget. Top of file also has `APP_VERSION`/`APP_UPDATED`, rendered into the footer — **bump on every `src/` change**, see "PWA / Service Worker" below. |
| `src/styles.css` | Light modern design system. CSS custom properties in `:root`. Anybody variable font for headings (wdth 75, weight 900), Inter for body. |
| `src/data/data.json` | Auto-updated by Actions. Contains `matches[]`, `standings{}`, `lastUpdated`. Used as schedule backbone and fallback. |
| `src/data/combinations.json` | Static. 495 entries keyed by 8-letter sorted group string (e.g. `"ABCDEFKL"`). Values map opponent keys (`"1A"` through `"1L"`) to team codes (`"3F"`). Never changes. |
| `src/sounds/` | MP3 audio files: `whistle.mp3`, `cheer.mp3`, `double-whistle.mp3`. Played by notifications; fall back to synthesized Web Audio tones if unavailable. |
| `src/sw.js` | Service worker. Cache-first for static assets, network-first for data/API calls. Powers installability and Android system notifications. **Bump its `CACHE` version string any time a static file changes** — see "PWA / Service Worker" below. |
| `src/manifest.json` | PWA manifest (name, icons, theme color, display mode) — enables "Add to Home Screen" / Android install. |
| `src/icons/`, `src/favicon.ico`, `src/favicon.svg` | App icons for the PWA manifest, favicon, and notification icon/badge. |
| `src/vendor/idiomorph.esm.js` | Vendored [Idiomorph](https://github.com/bigskysoftware/idiomorph) DOM-morphing library (`morphInto()` in `app.js`). Patches existing DOM nodes to match newly-rendered HTML instead of replacing `innerHTML` wholesale — avoids flag image re-decode flicker and restarting in-flight CSS animations (e.g. the live-card gradient border, sync pill pulse) on every poll. |
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
--grad-green: linear-gradient(135deg, #16A34A 0%, #0EA5E9 100%)  /* green→sky */
--r: 12px               /* default border-radius */
--bs: 96px              /* bracket slot base height */
--max-w: 1160px         /* main content max-width */
```

### Fonts
- **Headings**: `Anybody` variable font, `font-variation-settings: 'wdth' 75; font-weight: 900`. Loaded from Google Fonts with full axis range (`ital,wdth,wght@0,50..100,100..900`).
- **Body**: `Inter` 400/500/600

### Match Card Layout
`.match-card` is a flex column with this structure:

1. **`.match-meta-bar`** — `space-between` flex row:
   - Left: `.match-meta-left` — status badge + optional group label
   - Right: `.match-meta-right` — venue text (small, muted)

2. **`.match-teams`** — 3-column CSS grid: `1fr auto 1fr`
   - `.match-home` — flex row, right-aligned: team name then flag
   - `.score-col` — centered; contains `.score` (30px Anybody) and optional `.score-sub.live.match-clock`
   - `.match-away` — flex row, left-aligned: flag then team name

3. **`.match-events`** (optional) — 2-column grid for goal scorers: `.me-home` left, `.me-away` right. Each scorer is a `.goal-event` span with ⚽ icon. Rendered by `espnEventsHtml()` when match has scored events.

4. **`.match-stats`** (optional) — inset pill (`rgba(0,0,0,.03)` bg, border-radius 8px) containing:
   - `.stats-poss` grid: home %, possession bar (two-tone team-color gradient), away %, "Possession" label
   - `.stats-grid`: shot/corner/card rows via `.sg-h` / `.sg-l` / `.sg-a`
   - `.ycard` / `.rcard` — yellow/red card icons with counts
   Rendered by `espnStatsHtml()` for any match that has ESPN stat data (not just live).

5. **`.match-headline`** (optional) — italic ESPN recap summary sentence.

6. **Live commentary** (optional, in-play only) — most recent comment from ESPN summary endpoint, rendered beneath the headline, with `‹`/`›` scroll buttons (`.mc-btn`) and an `N/total` counter (`.mc-count`) to step back through older comments. Fetched separately via `fetchESPNCommentary()` for each in-play match that has an `espnEventId`; last 5 comments stored in `match._espnCommentary`. Rendered by `commentaryInnerHtml()`, which tracks the displayed comment by `match._commentarySeq` (not a raw index) so the position survives refetches, snapping back to the latest comment if it scrolls out of the 5-item buffer. The fade-in on text change is the `mc-fade-in` keyframe animation, replayed via the `.mc-anim` class toggle.

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

### Dashboard Layout
The Dashboard view renders:
1. **Hero** (`.page-hero`) — gradient banner with eyebrow (stage/day), title, and three stat callouts (live count, today count, total matches).
2. **Live & Today card** — full-width; all matches with `IN_PLAY`/`PAUSED` status plus remaining today's matches. Meta line shows "N in play · N upcoming".
3. **2-column grid** (`.dashboard-grid`):
   - **Group Standings** — condensed table (`.condensed`) showing the group of the first live match. Falls back to the most-played group when nothing is live. Label reads "Live group" or "Most played group". Respects `state.liveMode` toggle.
   - **Up Next** — next 5 scheduled matches.
4. **Team search** — filters the whole dashboard to a single team's matches.

`getTodayMatches()` filters `state.matches` by Pacific Time date to populate the hero "Today" stat and the Live & Today card.

### CSS Class Reference (app.js → styles.css)
| Element | Class |
|---|---|
| Hero banner | `.page-hero`, `.hero-eyebrow`, `.hero-title`, `.hero-stats`, `.hero-stat`, `.hero-stat-num`, `.hero-stat-label` |
| Match card | `.match-card`, `.match-card.live` |
| Meta bar | `.match-meta-bar`, `.match-meta-left`, `.match-meta-right` |
| Teams 3-col grid | `.match-teams` |
| Home/away cells | `.match-home`, `.match-away` |
| Score column | `.score-col > .score`, `.score-sub.live.match-clock` |
| Team name | `.team-name`, `.team-name.winner`, `.team-name.loser` |
| Goal events | `.match-events`, `.me-home`, `.me-away`, `.goal-event` |
| Stats pill | `.match-stats`, `.stats-poss`, `.stats-poss-bar`, `.stats-grid`, `.sg-h/.sg-l/.sg-a` |
| Card icons | `.ycard`, `.rcard` |
| Headline | `.match-headline` |
| Live commentary | `.match-commentary`, `.mc-text`, `.mc-nav`, `.mc-btn`, `.mc-count`, `.mc-anim` |
| Condensed table | `.condensed` (reduced padding, smaller font — used in dashboard standings widget) |
| Brackets | `.b-match`, `.b-slot`, `.b-team`, `.b-team-name`, `.b-score`, `.b-num`, `.b-div` |
| Round wrapper | `.bracket-round.r32/.r16/.rqf/.rsf/.rfin` |
| Group header | `.group-header > .group-pill + .group-name` |
| Standings header | `.standings-header`, `.standings-title` |
| Position | `.pos` |

### Badge Classes
| Status | Class |
|---|---|
| Live | `.badge.badge-live` |
| Half-time | `.badge.badge-ht` |
| Full-time | `.badge.badge-ft` |
| Scheduled | `.badge.badge-soon` |

### Mobile Header Layout (`@media (max-width: 768px)`)
`#app-header` wraps into 3 stacked rows via flexbox `order`:
1. `.brand` (left) + `.header-right` — notification bell + sync pill (right)
2. `.toggle-wrap` (Live Standings toggle) — centered, full width. Hidden via `#app-header[data-view="schedule"] .toggle-wrap { display: none }` since `state.liveMode` only affects Dashboard/Standings/Bracket, not Schedule.
3. `.nav-tabs` — full-width row of equal-width (`flex: 1`) nav buttons

`renderView()` sets `header.dataset.view = state.currentView` on every render so the CSS above can target the active view. Desktop layout (`.header-right { order: 3 }`, toggle inline) is untouched above the breakpoint.

## Live Score Architecture

### Primary: ESPN API (browser-side, every 10s)
`fetchESPN()` in `app.js` polls:
```
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```
No API key required. CORS-friendly — works directly from browser JS. Returns only **today's** matches, so it overlays live data on top of the full schedule from `data.json`.

`mergeESPNData()` matches ESPN events to `state.matches` by **ESPN team ID first** (`ESPN_ID_TO_TEAM` reverse map from `TEAM_MASTER_DATA[team].espnId`), falling back to display name normalization via `ESPN_NAME_MAP`. This ID-first approach avoids name mismatch issues. After matching, enriches each match with:
- `status`, `homeScore`, `awayScore` — always updated
- `espnEventId` — ESPN's match ID, used for commentary fetches and historical stat lookups
- `_espnClock`, `_espnDisplayClock`, `_espnPeriod`, `_espnFetchedAt` — live clock: elapsed seconds, formatted string (e.g. `"45'+2'"`), period, fetch timestamp
- `_espnEvents` — goal scorer labels parsed from `competitions[0].details[]` (scoring plays only), e.g. `"E. Ashour 20'"`, `"M. Hany 66' (og)"`
- `_espnStats` — possession %, shots, on-target, corners; card counts derived from `details[]` (not the stats array). Keys: `possessionPct`, `totalShots`, `shotsOnTarget`, `wonCorners`, `yellowCards`, `redCards`.
- `_espnColors` — hex brand colors for each team; auto-falls back to `alternateColor` when primary is near-white. Used for the possession gradient bar.
- `_espnHeadline` — recap text from `competitions[0].headlines[0].description`
- `homeFairPlay`, `awayFairPlay` — FIFA fair-play disciplinary deduction for this match only (e.g. `-1`, `-4`), derived from `competitions[0].details[]` card events via `classifyMatchFairPlay()`. Live preview while ESPN is tracking the match; see "Fair Play Tiebreaker" below.

**Swapped teams**: When ESPN's home/away order differs from `data.json`, a `swapped` flag reverses all score/stat/color assignments.

**Important**: `mergeESPNData()` always calls `renderView()` after every sync (not just when scores change), so stats and headlines appear immediately on first page load even when all matches are already FINISHED.

### ESPN Live Commentary (per in-play match)
After each scoreboard poll, `fetchESPNCommentary(match)` is called for every in-play match with an `espnEventId`. Hits the ESPN summary endpoint:
```
{ESPN_SCOREBOARD_URL.replace('/scoreboard', '/summary')}?event={espnEventId}
```
Parses `data.commentary[]`, sorts by sequence, stores last 5 comments in `match._espnCommentary`. Renders on live match cards beneath the headline. Fails silently if unavailable.

**Scrolling through commentary**: each card shows one comment at a time (latest by default) plus `‹`/`›` buttons to step through the buffered last 5. A delegated click handler (`.mc-btn`) finds the match by `data-matchnum`, moves `match._commentarySeq` to the next/previous item's `sequence`, and re-renders just that card's `.match-commentary` node (via `commentaryInnerHtml()`) rather than the whole view, replaying the `mc-fade-in` animation. `_commentarySeq` is preserved across `mergeESPNData()` (object mutated in place) and across `fetchData()`'s `data.json` merges (listed in `ESPN_FIELDS`), so a user's scroll position survives both the 10s ESPN poll and the 2-minute data.json refresh — unless the comment they were viewing ages out of the 5-item buffer, in which case it snaps back to the latest comment.

### ESPN Date Cache (historical data)
`fetchESPNDate(dateStr)` fetches `?dates=YYYYMMDD` and caches the result in `state._espnDateCache[dateStr]`. Used when opening team profile modals to get per-match stat breakdowns for historical matches that are no longer in today's scoreboard feed.

### Fallback: data.json (every 2 minutes)
`fetchData()` re-fetches `data.json` every 2 minutes to pick up schedule changes, knockout match updates, and standings corrections.

- **Source-of-truth precedence**: while ESPN is reachable (`state.espnSynced`), it's authoritative for any match it's actively tracking (`espnEventId` set) — `status`/`homeScore`/`awayScore` plus clock/stats/events/commentary fields (`ESPN_FIELDS` / `ESPN_AUTHORITATIVE_FIELDS` in `fetchData()`) are preserved from the in-memory match rather than overwritten by data.json. data.json becomes authoritative only once ESPN is unreachable, or for matches ESPN's date-scoped scoreboard doesn't cover at all.
- **No-op skip**: if `data.lastUpdated` is unchanged since the last fetch (most 2-minute ticks, since Actions only commits every ~5 minutes), `fetchData()` returns immediately without rebuilding matches/standings or re-rendering.
- `combinations.json` is fetched once at startup (`fetchCombinations()`), not on every poll — it's static and never changes at runtime.

### PWA Resume Handling
Installed Android PWAs throttle or fully suspend `setInterval` timers while backgrounded (screen off, app switched away), leaving the UI on stale data until the next throttled tick. `resyncNow()` forces an immediate `fetchData()` + `fetchESPN()` and restarts both poll intervals (so their next tick is measured from "now"), triggered by:
- `visibilitychange` → `visible`
- `online` event
- `pageshow` with `event.persisted` true (back/forward-cache restore — the common case when resuming an installed PWA)

### ESPN Team Name Map
`ESPN_NAME_MAP` in `app.js` normalizes ESPN display names to our `TEAM_MASTER_DATA` keys. Known mismatches:
- `"Cape Verde"` → `"Cape Verde Islands"`

Add new entries here as mismatches are discovered during the tournament. ID-based matching (`espnId` in `TEAM_MASTER_DATA`) takes precedence and bypasses this map entirely.

### ESPN Status Map
ESPN status names → our internal status values:
- `STATUS_SCHEDULED` → `SCHEDULED`
- `STATUS_FIRST_HALF` / `STATUS_SECOND_HALF` → `IN_PLAY`
- `STATUS_HALFTIME` / `STATUS_END_PERIOD` / `STATUS_SUSPENDED` / `STATUS_DELAY` → `PAUSED`
- `STATUS_FULL_TIME` / `STATUS_FINAL_AET` / `STATUS_FINAL_PEN` → `FINISHED`
- `STATUS_POSTPONED` / `STATUS_CANCELED` / `STATUS_DELAYED` → `SCHEDULED`

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
| `espnEventId` | string | ESPN's match ID. Used for commentary fetches and historical summary lookups. |
| `_espnClock` | number | Total elapsed seconds from kickoff at last ESPN fetch |
| `_espnDisplayClock` | string | Formatted clock string, e.g. `"45'+2'"` |
| `_espnPeriod` | number | 1 = first half, 2 = second half |
| `_espnFetchedAt` | number | `Date.now()` at last ESPN fetch, for real-time clock interpolation |
| `_espnEvents` | `{home:string[], away:string[]}` | Goal scorer labels per side, e.g. `"E. Ashour 20'"`, `"M. Hany 66' (og)"` |
| `_espnStats` | `{home:{}, away:{}}` | Keyed stat values. Keys: `possessionPct`, `totalShots`, `shotsOnTarget`, `wonCorners`, `yellowCards`, `redCards`. Cards derived from `details[]`, not the stats array. |
| `_espnColors` | `{home:string, away:string}` | Hex color strings (`#rrggbb`) for each team. Auto-falls back to `alternateColor` when primary is near-white. Used for the possession bar gradient. |
| `_espnHeadline` | string\|null | Recap summary from `competitions[0].headlines[0].description`. Shown as italic sentence below stats. |
| `_espnCommentary` | string[]\|null | Last 5 live commentary lines from ESPN summary endpoint. Only populated for in-play matches. |
| `_commentarySeq` | number\|undefined | `sequence` of the commentary item currently displayed (user's scroll position). Undefined = show latest (index 0). |
| `homeFairPlay`, `awayFairPlay` | number | FIFA fair-play disciplinary deduction for this match only, e.g. `-1`, `-4`. Set live by `mergeESPNData()` (preview) and permanently by `update_tracker.js`'s `syncFairPlayPoints()` once the match is `FINISHED`. See "Fair Play Tiebreaker" below. |

### `data.json` standings object
```json
{
  "A": [
    { "team": "Mexico", "iso": "mx", "played": 1, "won": 1, "drawn": 0, "lost": 0, "gf": 2, "ga": 0, "gd": 2, "pts": 3, "fairPlayPoints": -1 }
  ]
}
```
Teams sorted: pts → gd → gf → fair play → team name alphabetically. `fairPlayPoints` is the sum of `homeFairPlay`/`awayFairPlay` across the team's matches, computed by `computeStandings()`.

## Tournament Logic

### Group Source of Truth
`computeStandings()` in both `update_tracker.js` and `app.js` uses `TEAM_MASTER_DATA[team].group` to determine each team's group — NOT the match's `group` field (which is only set once, cosmetically, at match creation for the Schedule view's group label). This is defensive: it guarantees standings are always computed from the single source of truth for group membership, regardless of what's cached on a given match record.

ESPN's `altGameNote` field (e.g. `"FIFA World Cup, Group H"`) reflects the home team's group — consistent with our `data.json` convention.

**Note on history**: an earlier version of this doc described a "Cross-Group Matches (WC2026 format)" quirk where Groups G and H supposedly played cross-group fixtures in rounds 2–3. That was a misdiagnosis — there is no such format quirk in WC2026. It was a previous Claude session rationalizing the symptom of a real data bug: `TEAM_MASTER_DATA` had Spain/Cape Verde Islands and Iran/New Zealand swapped between groups G and H (see Known Issues below). Once the swap was corrected, every match in the schedule resolves to a standard intra-group fixture — zero actual cross-group matches exist anywhere in the 104-match schedule.

### Group Assignments (Groups G & H — easy to mix up, see Known Issues)
- **Group G**: New Zealand, Iran, Belgium, Egypt
- **Group H**: Uruguay, Saudi Arabia, Spain, Cape Verde Islands

### 3rd-Place Wildcard
8 of 12 third-place teams advance. Logic in `app.js` → `computeThirdPlaceRankings()`:
1. Get position-3 team from each group's standings
2. Sort all 12 by pts → gd → gf → fair play
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
- Fair play points need no special-casing for this toggle: `homeFairPlay`/`awayFairPlay` are summed inside the same `includeStatuses`-gated loop as pts/gd/gf in `computeStandings()`, so in-progress cards are picked up automatically in Live mode and ignored in Official mode, just like the current score.

### Fair Play Tiebreaker
Group standings (and the 3rd-place wildcard ranking) use FIFA's disciplinary-points tiebreaker as the 4th sort key, after points → goal difference → goals for and before alphabetical fallback: 1 yellow card = `-1`, an indirect red (second yellow) = `-3`, a straight red = `-4`, a yellow plus a straight red in the same match = `-5`. Less negative wins.

- **Source**: football-data.org has no card data at all, so this is computed entirely from ESPN's `competitions[0].details[]` — the same array already used for goal scorers and the live stats pill. `classifyMatchFairPlay(details, ourHomeTeamId)` groups card events by athlete within a match to tell straight reds apart from second-yellow dismissals. Implemented identically in both `app.js` and `scripts/update_tracker.js`.
- **Per-match, not per-team-total**: each match stores `homeFairPlay`/`awayFairPlay` (the deduction for that match only, e.g. `-1`, `-4`), exactly like `homeScore`/`awayScore`. `computeStandings()` sums these into each team's `fairPlayPoints`.
- **Frontend (live)**: `mergeESPNData()` in `app.js` derives `homeFairPlay`/`awayFairPlay` from the same 10s ESPN poll already used for live scores/stats, for any match it's actively tracking — a live preview that self-corrects on the next poll as `details[]` fills in (same lag behavior as goal events). `ESPN_AUTHORITATIVE_FIELDS` in `fetchData()` includes both fields so data.json never clobbers the live ESPN value while a match is tracked.
- **Backend (permanent)**: `update_tracker.js`'s `syncFairPlayPoints()` fetches ESPN's date-scoped scoreboard once per matchday (only for newly-`FINISHED` Group Stage matches missing these fields), finds the matching event via `findESPNEvent()` (ESPN team ID first, `ESPN_NAME_MAP` fallback — same pattern as `app.js`), and bakes the result into `data.json` permanently. Card events never change after the final whistle, so each match is fetched only once, ever. This required porting `espnId` (added to every `TEAM_MASTER_DATA` entry), `ESPN_NAME_MAP`, and ESPN-fetch helpers into `update_tracker.js`, which previously had no ESPN integration at all.
- **Known limitation**: ESPN's `details[]` doesn't flag "this red card was a second yellow" explicitly. When a single athlete has exactly one yellow and one red logged in the same match, `classifyMatchFairPlay()` assumes it's an indirect red (`-3`) rather than yellow + straight red (`-5`), since that's the far more common real case — this hasn't been validated against a confirmed second-yellow example yet.

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
- **Live scores**: ~10 seconds (ESPN, browser-direct)
- **data.json / standings**: ~5–7 minutes end-to-end (Actions cron → gh-pages deploy)

## Notification & Sound System

Three notification types are queued via `queueNotif()` and displayed one at a time. Audio is armed on the first user click/keydown (browser autoplay policy); falls back to synthesized Web Audio tones if MP3 files fail.

| Event | Trigger | Sound | Animation |
|---|---|---|---|
| **Kickoff** | `SCHEDULED` → `IN_PLAY` | `whistle.mp3` (single) | `launchBalls()` — 7 footballs arc across screen |
| **Goal** | `_espnEvents` array grows (see below) | `cheer.mp3` | `launchConfetti()` — 90 colored pieces |
| **Full time** | `IN_PLAY`/`PAUSED` → `FINISHED` | `double-whistle.mp3` | — (stat summary shown in notification card) |

### Goal notification timing
ESPN's `details[]` (scorer events) updates ~30 seconds before the competitor `score` field. The notification system uses two dedup keys to fire immediately:
- `_seenGoalEvents` — keyed `matchNum:homeEventCount:awayEventCount`. Fires the moment `_espnEvents` gains a new entry, even if the score integer hasn't updated yet. Score shown as `prev+1` if needed.
- `_seenGoals` — keyed `matchNum:homeScore:awayScore`. Updated on score change to prevent double-firing when the score eventually catches up.

## Team Profile Modal

Clicking any team name or flag (`.team-link`, `.flag-link`) opens `openTeamModal(teamName)` which shows:
- Flag, name, group assignment
- Record card: points, W–D–L, GF–GA, current group position
- **Average per-match stats** aggregated across all finished matches via `fetchESPNDate()` + `parseESPNEventData()` + `teamStatsAggregate()`: possession %, shots, shots on target, corners, yellows, reds. Results cached in `state._espnDateCache`.
- Full results table: all finished matches with W/L/D badge, score, opponent, date, stage.

Closes on X button, overlay click, or Escape key. Animates in/out with CSS classes `tm-in` / `tm-out`.

## PWA / Service Worker

The app is installable (manifest.json + icons) and registers `src/sw.js` (`navigator.serviceWorker.register('/world_cup_dashboard/sw.js')` near the bottom of `app.js`).

### Caching strategy
- **Data/API requests** (`data.json`, ESPN hostnames, football-data.org) — network-first, falling back to cache only if the fetch fails.
- **Everything else** (`index.html`, `app.js`, `styles.css`, `vendor/idiomorph.esm.js`, icons, manifest) — **cache-first, with no network revalidation**. Once an asset is cached under the current `CACHE` version, it is served from cache indefinitely until that version changes.

### CRITICAL: bump the cache version on every static-file change
`CACHE` in `src/sw.js` is a hardcoded version string (`wc2026-vN`). The `activate` handler deletes old-versioned caches and `install` re-precaches everything — but only when a **new version of `sw.js` itself** is detected by the browser. If `sw.js`'s bytes are unchanged, no install/activate cycle runs at all, even if `styles.css`/`app.js`/`index.html` changed and were deployed.

**Whenever you change `src/styles.css`, `src/app.js`, `src/index.html`, `src/vendor/idiomorph.esm.js`, `src/manifest.json`, or any file in `src/icons/`, bump the `CACHE` version in `src/sw.js` (e.g. `wc2026-v6` → `wc2026-v7`) in the same change.** Forgetting this means every client that has previously visited the site — desktop browser, mobile browser, and the installed Android PWA alike — keeps serving the old cached assets forever, with no visible error; the change will look like it "didn't do anything," even though it deployed correctly. (This happened: the mobile header layout, schedule-data-leak, and commentary-race fixes all shipped without a version bump, so they silently failed to reach already-visited clients until `CACHE` was bumped to `v6`.)

`skipWaiting()` + `clients.claim()` are already wired up in `install`/`activate`, so once the version *is* bumped, the new worker takes over without requiring users to fully close/reopen the app.

### CRITICAL: update the version footer on every change

`src/app.js` has two constants near the top:
```js
const APP_VERSION = 'v8';
const APP_UPDATED = '2026-06-17 16:17 UTC';
```
Rendered into `<footer id="app-footer">` (in `src/index.html`, styled in `src/styles.css`) on init, as "WC2026 Dashboard vN · Updated <timestamp>". This exists so the user can confirm — by reloading the live site — that a deploy actually reached them, independent of whether they can see the underlying change. It's the same problem the service worker cache-bust rule solves, so treat it as one combined step:

**On every commit that changes any file under `src/`, bump `APP_VERSION` (matching the new `src/sw.js` `CACHE` version, e.g. both go `v8` → `v9`) and set `APP_UPDATED` to the current UTC date/time (`date -u +"%Y-%m-%d %H:%M UTC"`).** After merging to `main` and the Actions deploy completes, report the new version number to the user so they can verify the live site shows it.

### Android system notifications
`sendSystemNotification()` calls `serviceWorkerRegistration.showNotification()` (real OS-level notification, works while the PWA/tab is alive in the background but not once Android fully kills the process) alongside the existing in-page toast from `queueNotif()`. Gated on `Notification.permission === 'granted'`. The bell icon (`#notif-permission-btn`, managed by `initNotifPermissionBtn()`/`updateNotifPermissionBtn()`) lets the user opt in; hidden entirely if the browser lacks `Notification` or `serviceWorker` support.

## Known Issues / Watch Points
1. **ESPN name mismatches**: If a match isn't getting ESPN updates, check `ESPN_NAME_MAP` in `app.js`. Add the mapping and push to fix.
2. **ESPN scoreboard is date-scoped**: Only returns today's matches. Full 104-match schedule always comes from `data.json`.
3. **Group source of truth**: always use `TEAM_MASTER_DATA[team].group`, not `m.group`, when computing standings — see "Group Source of Truth" above
4. **Knockout matchId population**: R32+ matches start with `matchId: null`. Self-healed via name matching once the API returns them.
5. **Half-time timestamp source**: `firstHalfStart`/`secondHalfStart` are set by the Actions runner clock, not the API — accurate to within one 30-second polling interval. ESPN clock is preferred when available.
6. **Group standings sort**: always use `Object.keys().sort()` when iterating groups — key order in JSON is not guaranteed
7. **ESPN events lead the score**: `details[]` populates `_espnEvents` ~30s before the score field updates. The goal notification uses `_seenGoalEvents` (event count key) to fire early; `_seenGoals` (score key) prevents double-firing.
8. **Stale service worker cache**: any deploy that changes `styles.css`/`app.js`/`index.html`/icons without also bumping `CACHE` in `src/sw.js` will look like it had no effect on any previously-visited client (browser tab or installed PWA) — see "PWA / Service Worker" above. If a shipped UI change "isn't showing up," check this first before assuming a deploy or rendering bug.
9. **Fair play yellow+red ambiguity**: `classifyMatchFairPlay()` can't tell a straight red apart from a second-yellow dismissal when ESPN logs exactly one yellow and one red for the same athlete in the same match — it assumes second-yellow (`-3`) since that's the common case. Unvalidated against a confirmed real second-yellow example; revisit if a fair-play total looks off by 2 points.
10. **(Fixed 2026-06-17) Group G/H team swap**: `TEAM_MASTER_DATA` had Spain & Cape Verde Islands assigned to Group G and Iran & New Zealand assigned to Group H — backwards from FIFA's official lettering (verified against fifa.com and blueprint CSV cross-checks for all other groups). Corrected to G: New Zealand, Iran, Belgium, Egypt / H: Uruguay, Saudi Arabia, Spain, Cape Verde Islands, in both `app.js` and `update_tracker.js`, plus the cosmetic `group` field on the 6 affected matches and the `standings.G`/`standings.H` rows already committed in `data.json`. This swap was the root cause of the (now-removed) "Cross-Group Matches" documentation — see "Group Source of Truth" above. If group lettering ever looks suspicious again, sanity-check `TEAM_MASTER_DATA` against the live FIFA standings page, not just internal consistency.

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
