# ⚽ World Cup 2026 Live Dashboard

A fully responsive single-page web application for tracking FIFA World Cup 2026, hosted on GitHub Pages. Uses a "Dynamic Static" architecture with live score updates sourced directly from ESPN's public API — no backend server required.

## Live Site

`https://tlcjosh.github.io/world_cup_dashboard/`

## Architecture

```
┌─────────────────────────────────────┐
│  Browser (app.js)                   │
│  ├─ ESPN scoreboard (every 10s)     │  ← primary live source
│  │   └─ scores, clock, events,      │
│  │      stats, colors, headlines    │
│  ├─ ESPN summary (per live match)   │  ← live commentary feed
│  │   └─ last 5 comments cached      │
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

**Update latency**: Live scores update every ~10 seconds via ESPN directly in the browser. The data.json fallback (GitHub Pages deploy) has ~5–7 minute end-to-end latency.

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
├── blueprint_data/           # Legacy CSVs + ESPN example payloads (reference only); fifa_rankings_*.html is the live source of TEAM_MASTER_DATA's fifaRank field
├── scripts/
│   └── update_tracker.js     # API sync + self-bootstrap + fair play sync (used by Actions)
├── src/
│   ├── index.html            # SPA shell
│   ├── styles.css            # Light modern theme (Anybody variable font, gradient accents)
│   ├── app.js                # All frontend logic (vanilla JS)
│   ├── sw.js                 # Service worker — caching + Android system notifications
│   ├── manifest.json         # PWA manifest (installability)
│   ├── icons/                # PWA/notification icons
│   ├── vendor/
│   │   └── idiomorph.esm.js  # DOM-morphing lib, avoids flicker on re-render
│   └── data/
│       ├── data.json         # Match data + standings (auto-updated by Actions)
│       └── combinations.json # 3rd-place wildcard lookup (static)
│   └── sounds/
│       ├── whistle.mp3       # Kickoff notification sound
│       ├── cheer.mp3         # Goal notification sound
│       └── double-whistle.mp3# Full-time notification sound
├── package.json
├── README.md
└── CLAUDE.md                 # AI assistant context
```

## Views

| View | Description |
|---|---|
| **Dashboard** | Hero banner with stage/day label and live/today/total stats; full-width Today's Matches card with ESPN stats; dynamic Group Standings panel for the current live game's group (falls back to most-played group); Up Next card; team search filter |
| **Schedule** | All 104 fixtures grouped by date (Pacific Time), live scores, group/stage label, winner highlighting, ESPN stats for today's matches |
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

### Match Card Layout

Each match card uses a layered structure:

1. **`.match-meta-bar`** — `space-between` flex row: status badge (FT/LIVE/HT/kickoff time) on the left, venue on the right.
2. **`.match-teams`** — 3-column CSS grid (`1fr auto 1fr`): home team (name + flag right-aligned) | centered score col with live clock | away team (flag + name left-aligned). Score is 30px Anybody bold.
3. **`.match-events`** — goal scorers when ESPN has `details[]` data. Home scorers left-aligned, away right-aligned, each with ⚽ icon.
4. **`.match-stats`** — inset pill with two-tone possession bar (each team's ESPN brand color), plus shots, shots on target, corners, and card counts (yellow/red). Shown for any match that has ESPN stat data, not just live ones.
5. **`.match-headline`** — italic ESPN recap summary sentence.
6. **Live commentary** — most recent comment from ESPN summary feed, shown beneath stats for in-play matches only.

Completed matches show winner (bold) / loser (muted) styling on team names.

The knockout bracket uses slot-based height doubling so each round's cards align vertically with their feeder matches.

## Live Score & Notification System

### ESPN Scoreboard (every 10s)

`app.js` polls `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` every 10 seconds directly from the browser. No API key required — ESPN's public scoreboard API is CORS-friendly. Results are merged into the in-memory match list by ESPN team ID (primary) or display name (fallback) and enrich each match with:

| Field | Description |
|---|---|
| `status`, `homeScore`, `awayScore` | Always updated |
| `_espnClock`, `_espnDisplayClock`, `_espnPeriod`, `_espnFetchedAt` | Live clock — elapsed seconds, formatted string (e.g. `45'+2'`), period number, fetch timestamp for real-time interpolation |
| `_espnEvents` | Goal scorer labels per side, parsed from `competitions[0].details[]` |
| `_espnStats` | Possession %, shots, on-target, corners, yellows, reds |
| `_espnColors` | Hex brand colors for each team, used for the possession gradient bar |
| `_espnHeadline` | Recap sentence from `competitions[0].headlines[0]` |
| `espnEventId` | ESPN's match ID, used for commentary and historical detail fetches |
| `homeFairPlay`, `awayFairPlay` | FIFA fair-play disciplinary deduction for this match (e.g. `-1`, `-4`), derived from `competitions[0].details[]` card events. Live preview while ESPN is tracking the match; baked into `data.json` permanently by `update_tracker.js` once `FINISHED`. See "Fair Play Tiebreaker" below. |

ESPN re-renders the view on every sync (not just when scores change), so stats and headlines appear immediately on page load even for already-finished matches.

**Important quirk**: ESPN's `details[]` (scorer events) updates about 30 seconds before the competitor `score` field. The notification system uses `_seenGoalEvents` to fire the goal modal as soon as a new scorer entry appears, without waiting for the score integer to catch up.

### Live Commentary (per in-play match)

For each in-play match that has an `espnEventId`, a second request goes to the ESPN summary endpoint. The last 5 comments are cached in `match._espnCommentary` and displayed on the live match card.

### Notifications & Sounds

All notifications are browser-side, triggered by comparing ESPN data across poll cycles. Audio is armed on first user gesture to comply with browser autoplay policy.

| Event | Trigger | Sound | Animation |
|---|---|---|---|
| **Kickoff** | Match status `SCHEDULED` → `IN_PLAY` | Single whistle | 7 footballs arc across screen |
| **Goal** | `_espnEvents` array gains a new scorer entry | Cheer | Confetti (90 colored pieces) |
| **Full time** | Match status → `FINISHED` | Double whistle | — (stat summary shown in notification) |

Sounds fall back to synthesized Web Audio tones if MP3 files fail to load.

Each notification is also dispatched as a real OS-level notification via the service worker (works while the PWA/tab is alive in the background, e.g. screen off, but not once Android fully kills the process) if the user has granted permission via the bell icon in the header.

### Team Profile Modal

Clicking any team name or flag opens a modal with:
- Flag, name, group
- Record: points, W–D–L, GF–GA, current group position
- Average per-match stats aggregated from ESPN historical data (possession, shots, on target, corners, yellows, reds) — fetched via the ESPN date-scoped scoreboard endpoint and cached per date
- Full results table with W/L/D badges, score, opponent, date, stage

### Sync Pill

A small pill in the UI shows ESPN sync state: `syncing` → `ok` (with time since last update) or `error`. The hover title shows the football-data.org last-sync timestamp.

### Schedule / Standings Fallback (data.json)

`update_tracker.js` runs via GitHub Actions every 5 minutes (inner 30s loop × 10). It fetches football-data.org, updates scores and standings, and commits `data.json`. The frontend re-fetches this file every 2 minutes to pick up any schedule changes or knockout match updates that ESPN's date-scoped scoreboard doesn't include.

### Self-Bootstrap

`update_tracker.js` checks for a missing or empty `data.json` on startup. If found, it bootstraps the full dataset from the API (group stage) + a hardcoded bracket template (knockout rounds), then commits. No manual seeding step required.

### Live Clock

During live matches, the browser ticks the clock forward every second using ESPN's `status.clock` (total elapsed seconds) plus real-time offset since the last fetch. Falls back to `firstHalfStart`/`secondHalfStart` timestamps from `data.json` if ESPN clock data isn't present.

### Group Source of Truth

The standings computation always looks up each team's group via `TEAM_MASTER_DATA`, not the match's `group` field (which is only set cosmetically, at match creation, for the Schedule view's label). This guarantees group totals stay correct even if a match's cached label is ever wrong — which is exactly what happened with Groups G/H: `TEAM_MASTER_DATA` had Spain/Cape Verde Islands and Iran/New Zealand swapped between the two groups, which a previous pass had misdiagnosed as an intentional "cross-group match" format quirk. There is no such quirk in WC2026 — once the swap was corrected, every match in the schedule resolves to a standard intra-group fixture.

### 3rd-Place Wildcards

8 of 12 third-place teams advance. The qualifying combination is determined by ranking all 12 third-place teams (pts → gd → gf → fair play → FIFA World Ranking, since head-to-head doesn't apply across different groups), taking the top 8, sorting their group letters alphabetically (e.g. `"ABCDEFKL"`), and looking up the resulting string in `combinations.json`.

### FIFA World Ranking & Head-to-Head Tiebreaker

Full official FIFA group-stage tiebreaker order: points → goal difference → goals scored → head-to-head mini-league among tied teams → fair play points → FIFA World Ranking position → alphabetical (last resort; FIFA's actual procedure is a literal drawing of lots, which can't be replicated programmatically).

- **`fifaRank`**: a static field on every team in `TEAM_MASTER_DATA` (both `app.js` and `update_tracker.js`), sourced from a manually-saved snapshot of FIFA's official ranking page at `blueprint_data/fifa_rankings_2026-06-17.html`. Matched to our team names via FIFA's 3-letter team codes (more reliable than display names — 7 of 48 teams have name mismatches, e.g. "Korea Republic" vs. "South Korea").
- **Head-to-head mini-league**: `sortStandingsWithHeadToHead()` sorts a group's teams by pts → gd → gf, then clusters together any teams that are still exactly tied. For clusters of 2+ teams, `resolveHeadToHead()` recomputes a mini pts/gd/gf table using only the matches played between members of that cluster, and re-sorts the cluster by that. If the mini-league still can't separate them (e.g. a closed 3-way cycle of 1-0 results), it falls through to fair play → FIFA ranking → alphabetical.
- **Cross-group comparisons** (3rd-place wildcard ranking) skip head-to-head entirely, since teams in different groups never play each other in the group stage — straight to fair play → FIFA ranking.
- **Refreshing rankings**: FIFA updates the official ranking several times during the tournament. There's currently no automated refresh — to update, save a fresh copy of the ranking page HTML to `blueprint_data/`, re-parse it, and update the `fifaRank` values in both `TEAM_MASTER_DATA` copies.

### Fair Play Tiebreaker

Group standings (and the 3rd-place wildcard ranking) use FIFA's disciplinary-points tiebreaker as the 4th sort key, after points → goal difference → goals for and before alphabetical fallback: 1 yellow card = `-1`, an indirect red (second yellow) = `-3`, a straight red = `-4`, a yellow plus a straight red in the same match = `-5`. Less negative wins.

- **Source**: football-data.org has no card data at all, so this is computed entirely from ESPN's `competitions[0].details[]` (the same array already used for goal scorers and the live stats pill). `classifyMatchFairPlay()` groups card events by athlete within a match to tell straight reds apart from second-yellow dismissals.
- **Per-match, not per-team-total**: each match stores `homeFairPlay`/`awayFairPlay` (the deduction for that match only, e.g. `-1`, `-4`), exactly like `homeScore`/`awayScore`. `computeStandings()` sums these into each team's `fairPlayPoints`, gated by the same `includeStatuses` filter as everything else — so the Live Standings toggle picks up in-progress cards automatically, with no special-casing.
- **Frontend (live)**: `app.js` derives `homeFairPlay`/`awayFairPlay` from the same 10s ESPN poll already used for live scores/stats, for any match it's actively tracking — a live preview that self-corrects on the next poll as `details[]` fills in (same lag behavior as goal events).
- **Backend (permanent)**: `update_tracker.js` fetches ESPN's date-scoped scoreboard once per matchday, only for newly-`FINISHED` group stage matches missing these fields, and bakes the result into `data.json` permanently — card events never change after the final whistle, so each match is only fetched once, ever.
- **Known limitation**: ESPN's `details[]` doesn't flag "this red card was a second yellow" explicitly. When a single athlete has exactly one yellow and one red logged in the same match, `classifyMatchFairPlay()` assumes it's an indirect red (`-3`) rather than yellow + straight red (`-5`), since that's the far more common real case — this hasn't been validated against a confirmed second-yellow example yet.

### Bracket Placeholder Resolution

Knockout match team slots use placeholders resolved at render time:
- `[1A]` → 1st place of Group A
- `[3ABCDF]` → 3rd-place wildcard (via combinations lookup)
- `[W73]` → winner of match #73
- `[L101]` → loser of match #101 (3rd-place match)

## PWA & Caching

The app is installable (Add to Home Screen) via `manifest.json` and a service worker (`src/sw.js`):

- **Data/API requests** (`data.json`, ESPN, football-data.org) — network-first, falls back to cache offline.
- **Static assets** (`index.html`, `app.js`, `styles.css`, vendor/icons) — cache-first, served from cache indefinitely with no network revalidation.
- Installed PWAs/background tabs get real OS-level notifications via `ServiceWorkerRegistration.showNotification()`, gated on a permission toggle in the header (the bell icon).

**⚠️ Cache-busting rule**: the service worker only re-fetches static assets when its own `CACHE` version string (in `src/sw.js`) changes. **Any change to `styles.css`, `app.js`, `index.html`, vendored JS, icons, or `manifest.json` must bump that version** (e.g. `wc2026-v6` → `wc2026-v7`), or every client that's previously visited the site — browser tab or installed PWA — will silently keep serving the old cached files indefinitely. There's no error or warning; the change will just look like it never happened.

## Development

```bash
npm install

# Test API sync locally (bootstraps if data.json missing, otherwise updates)
FD_API_TOKEN=your_token node scripts/update_tracker.js

# Serve frontend
npx serve src/
```
