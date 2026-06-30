import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '..', 'src', 'data', 'data.json');
const FIFA_RANKINGS_PATH = join(__dirname, '..', 'src', 'data', 'fifa_rankings.json');
const RSS_NEWS_PATH = join(__dirname, '..', 'src', 'data', 'rss_news.json');
const COMBINATIONS_PATH = join(__dirname, '..', 'src', 'data', 'combinations.json');
const BLUEPRINT_DIR = join(__dirname, '..', 'blueprint_data');

// Maps 3rd-place slot code -> which 1st-place group runner they face (kept in sync with src/app.js)
const SLOT_TO_OPPONENT = {
  "3CEFHI": "1A",
  "3EFGIJ": "1B",
  "3BEFIJ": "1D",
  "3ABCDF": "1E",
  "3AEHIJ": "1G",
  "3CDFGH": "1I",
  "3DEIJL": "1K",
  "3EHIJK": "1L"
};

const TEAM_MASTER_DATA = {
  "Mexico": { group: "A", iso: "mx", espnId: 203, fifaRank: 14 }, "South Africa": { group: "A", iso: "za", espnId: 467, fifaRank: 60 }, "South Korea": { group: "A", iso: "kr", espnId: 451, fifaRank: 25 }, "Czechia": { group: "A", iso: "cz", espnId: 450, fifaRank: 40 },
  "Canada": { group: "B", iso: "ca", espnId: 206, fifaRank: 30 }, "Bosnia-Herzegovina": { group: "B", iso: "ba", espnId: 452, fifaRank: 64 }, "Qatar": { group: "B", iso: "qa", espnId: 4398, fifaRank: 56 }, "Switzerland": { group: "B", iso: "ch", espnId: 475, fifaRank: 19 },
  "Brazil": { group: "C", iso: "br", espnId: 205, fifaRank: 6 }, "Morocco": { group: "C", iso: "ma", espnId: 2869, fifaRank: 7 }, "Haiti": { group: "C", iso: "ht", espnId: 2654, fifaRank: 83 }, "Scotland": { group: "C", iso: "scotland", espnId: 580, fifaRank: 42 },
  "United States": { group: "D", iso: "us", espnId: 660, fifaRank: 17 }, "Paraguay": { group: "D", iso: "py", espnId: 210, fifaRank: 41 }, "Australia": { group: "D", iso: "au", espnId: 628, fifaRank: 27 }, "Turkey": { group: "D", iso: "tr", espnId: 465, fifaRank: 22 },
  "Germany": { group: "E", iso: "de", espnId: 481, fifaRank: 10 }, "Curaçao": { group: "E", iso: "cw", espnId: 11678, fifaRank: 82 }, "Ivory Coast": { group: "E", iso: "ci", espnId: 4789, fifaRank: 33 }, "Ecuador": { group: "E", iso: "ec", espnId: 209, fifaRank: 23 },
  "Netherlands": { group: "F", iso: "nl", espnId: 449, fifaRank: 8 }, "Japan": { group: "F", iso: "jp", espnId: 627, fifaRank: 18 }, "Sweden": { group: "F", iso: "se", espnId: 466, fifaRank: 38 }, "Tunisia": { group: "F", iso: "tn", espnId: 659, fifaRank: 45 },
  "Belgium": { group: "G", iso: "be", espnId: 459, fifaRank: 9 }, "Egypt": { group: "G", iso: "eg", espnId: 2620, fifaRank: 29 }, "Iran": { group: "G", iso: "ir", espnId: 469, fifaRank: 20 }, "New Zealand": { group: "G", iso: "nz", espnId: 2666, fifaRank: 85 },
  "Saudi Arabia": { group: "H", iso: "sa", espnId: 655, fifaRank: 61 }, "Uruguay": { group: "H", iso: "uy", espnId: 212, fifaRank: 16 }, "Spain": { group: "H", iso: "es", espnId: 164, fifaRank: 2 }, "Cape Verde Islands": { group: "H", iso: "cv", espnId: 2597, fifaRank: 67 },
  "France": { group: "I", iso: "fr", espnId: 478, fifaRank: 3 }, "Senegal": { group: "I", iso: "sn", espnId: 654, fifaRank: 15 }, "Iraq": { group: "I", iso: "iq", espnId: 4375, fifaRank: 57 }, "Norway": { group: "I", iso: "no", espnId: 464, fifaRank: 31 },
  "Argentina": { group: "J", iso: "ar", espnId: 202, fifaRank: 1 }, "Algeria": { group: "J", iso: "dz", espnId: 624, fifaRank: 28 }, "Austria": { group: "J", iso: "at", espnId: 474, fifaRank: 24 }, "Jordan": { group: "J", iso: "jo", espnId: 2917, fifaRank: 63 },
  "Portugal": { group: "K", iso: "pt", espnId: 482, fifaRank: 5 }, "Congo DR": { group: "K", iso: "cd", espnId: 2850, fifaRank: 46 }, "Uzbekistan": { group: "K", iso: "uz", espnId: 2570, fifaRank: 50 }, "Colombia": { group: "K", iso: "co", espnId: 208, fifaRank: 13 },
  "England": { group: "L", iso: "england", espnId: 448, fifaRank: 4 }, "Croatia": { group: "L", iso: "hr", espnId: 477, fifaRank: 11 }, "Ghana": { group: "L", iso: "gh", espnId: 4469, fifaRank: 73 }, "Panama": { group: "L", iso: "pa", espnId: 2659, fifaRank: 34 }
};

// ESPN display name -> our TEAM_MASTER_DATA key (kept in sync with the same map in src/app.js)
const ESPN_NAME_MAP = {
  'Cape Verde': 'Cape Verde Islands',
  'Bosnia & Herzegovina': 'Bosnia-Herzegovina',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'DR Congo': 'Congo DR',
  'Republic of Congo': 'Congo DR',
  'Czech Republic': 'Czechia',
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  'USA': 'United States',
  'Curacao': 'Curaçao',
  'Türkiye': 'Turkey',
};

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

function normalizeESPNName(name) {
  return ESPN_NAME_MAP[name] || name;
}

// Pacific time — same convention used by the `dates=` param everywhere else in this app
function kickoffToDateStr(kickoff) {
  if (!kickoff) return null;
  return new Date(kickoff).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).replace(/-/g, '');
}

function shiftDateStr(dateStr, days) {
  const y = Number(dateStr.slice(0, 4)), mo = Number(dateStr.slice(4, 6)) - 1, d = Number(dateStr.slice(6, 8));
  const dt = new Date(Date.UTC(y, mo, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10).replace(/-/g, '');
}

// Matches kicking off right around midnight UTC can land on a different ESPN
// `dates=` bucket than our PT-converted kickoff date (e.g. a 03:59 UTC kickoff is
// still "yesterday" in PT but ESPN may file it under the UTC day) — try the
// kickoff date first, then the adjacent days, before giving up for this sync.
function candidateDates(baseDateStr) {
  return [baseDateStr, shiftDateStr(baseDateStr, -1), shiftDateStr(baseDateStr, 1)];
}

function findESPNEvent(events, homeTeam, awayTeam) {
  const homeId = String(TEAM_MASTER_DATA[homeTeam]?.espnId || '');
  const awayId = String(TEAM_MASTER_DATA[awayTeam]?.espnId || '');
  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const hId = String(homeComp.team.id || '');
    const aId = String(awayComp.team.id || '');
    const idMatch = homeId && awayId && (
      (hId === homeId && aId === awayId) ||
      (hId === awayId && aId === homeId)
    );

    const h = normalizeESPNName(homeComp.team.displayName);
    const a = normalizeESPNName(awayComp.team.displayName);
    const nameMatch = (h === homeTeam && a === awayTeam) || (h === awayTeam && a === homeTeam);

    if (idMatch || nameMatch) {
      const swapped = idMatch ? hId === awayId : h === awayTeam;
      return { comp, homeComp, awayComp, swapped };
    }
  }
  return null;
}

// FIFA fair play disciplinary points (group-stage tiebreaker), per athlete per match:
//   1 yellow card                 => -1
//   indirect red (second yellow)  => -3
//   straight red                  => -4
//   yellow card + straight red    => -5
// NOTE: ESPN's details[] doesn't carry an explicit "second yellow" flag. We can't
// reliably distinguish an indirect red (-3) from a yellow+straight-red (-5) when an
// athlete has exactly one yellow and one red logged in the same match — we treat
// that ambiguous case as the indirect red (-3), since it's the far more common
// real-world occurrence. Flagged here for manual verification against a real example
// if it ever shows up, since this hasn't been validated end-to-end yet.
function classifyMatchFairPlay(details, ourHomeTeamId) {
  const byAthlete = new Map();
  for (const d of details) {
    if (!d.yellowCard && !d.redCard) continue;
    const athlete = d.athletesInvolved?.[0];
    const key = athlete?.id || athlete?.displayName || `${d.team?.id}:${d.clock?.value}`;
    const isHome = d.team?.id === ourHomeTeamId;
    if (!byAthlete.has(key)) byAthlete.set(key, { isHome, yellow: 0, red: 0 });
    const entry = byAthlete.get(key);
    if (d.yellowCard) entry.yellow++;
    if (d.redCard) entry.red++;
  }
  let home = 0, away = 0;
  for (const { isHome, yellow, red } of byAthlete.values()) {
    let deduction = 0;
    if (red >= 1) deduction = yellow >= 1 ? -3 : -4;
    else if (yellow >= 2) deduction = -3;
    else if (yellow === 1) deduction = -1;
    if (isHome) home += deduction; else away += deduction;
  }
  return { home, away };
}

// The /summary endpoint's boxscore.teams[] statistics array can come back empty
// for a match — confirmed transient rather than permanent (a match over a week
// past its final whistle was found fully repopulated with ~28 stats per team).
// Returning 0 in the empty case would bake a false "literally zero saves" into a
// 7-1 scoreline, so this returns undefined instead, letting the caller leave the
// field unset and retry on a later sync.
function parseBoxscoreStat(teamEntry, statName) {
  const stat = (teamEntry?.statistics || []).find(s => s.name === statName);
  if (!stat) return undefined;
  return stat.value !== undefined ? stat.value : parseFloat(stat.displayValue);
}

// Every per-match stat we persist, sourced entirely from the /summary endpoint's
// boxscore.teams[].statistics[] — one fetch covers cards/fouls/corners (previously
// pulled from a separate scoreboard call) plus saves/passPct and everything below,
// which only exist in this endpoint at all.
const BOXSCORE_STAT_FIELDS = [
  ['foulsCommitted', 'Fouls'],
  ['yellowCards', 'YellowCards'],
  ['redCards', 'RedCards'],
  ['wonCorners', 'Corners'],
  ['possessionPct', 'Possession'],
  ['saves', 'Saves'],
  ['passPct', 'PassPct'],
  ['totalShots', 'Shots'],
  ['shotsOnTarget', 'ShotsOnTarget'],
  ['totalTackles', 'Tackles'],
  ['interceptions', 'Interceptions'],
  ['totalClearance', 'Clearances'],
  ['totalCrosses', 'Crosses'],
  ['totalLongBalls', 'LongBalls'],
];

function applyBoxscoreStats(m, homeBox, awayBox) {
  for (const [statName, suffix] of BOXSCORE_STAT_FIELDS) {
    m[`home${suffix}`] = parseBoxscoreStat(homeBox, statName);
    m[`away${suffix}`] = parseBoxscoreStat(awayBox, statName);
  }
}

// Penalty shootout score. Confirmed against two real finished shootouts (Germany
// v Paraguay, Netherlands v Morocco, both 2026-06-29) that boxscore.teams[]
// statistics[]'s penaltyKickGoals stat stays "0"/"0" even once the match is fully
// FINISHED (STATUS_FINAL_PEN) — it never populates for a shootout-decided match in
// this data, contradicting the original assumption that it only needed a permanent
// (not live-preview) path. The /summary endpoint's top-level shootout[] array (the
// same field the frontend's fetchESPNCommentary() already uses for the live
// preview) is the only source that's actually populated, live or after FINISHED.
function parseShootoutScore(shootoutArr, teamId) {
  const entry = (shootoutArr || []).find(s => String(s.id) === String(teamId));
  if (!entry) return undefined;
  return (entry.shots || []).filter(s => s.didScore).length;
}

async function fetchESPNSummary(eventId) {
  try {
    const res = await fetch(`${ESPN_SCOREBOARD_URL.replace('/scoreboard', '/summary')}?event=${eventId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('ESPN summary fetch failed for event', eventId, e.message);
    return null;
  }
}

// Resolves everything syncMatchStats() needs for one match: which side is "ours"
// (home/away can be swapped between ESPN and our data), the card-event details
// array (for fair-play classification), and the boxscore stats for both teams.
//
// Once a match has a persisted espnEventId (set by a prior sync, or in future by
// the frontend's live merge), this is a single /summary?event= call — no need to
// re-search the date-scoped scoreboard at all. Matches without one yet fall back
// to the discovery search across a small window of candidate dates.
async function resolveEventContext(m, dateCache) {
  if (m.espnEventId) {
    const summary = await fetchESPNSummary(m.espnEventId);
    const comp = summary?.header?.competitions?.[0];
    const homeComp = comp?.competitors?.find(c => c.homeAway === 'home');
    const awayComp = comp?.competitors?.find(c => c.homeAway === 'away');
    if (!comp || !homeComp || !awayComp) return null;
    const expectedHomeId = String(TEAM_MASTER_DATA[m.homeTeam]?.espnId || '');
    const swapped = expectedHomeId ? String(homeComp.team.id) !== expectedHomeId : false;
    const ourHomeComp = swapped ? awayComp : homeComp;
    const ourAwayComp = swapped ? homeComp : awayComp;
    return {
      eventId: m.espnEventId,
      details: comp.details || [],
      ourHomeId: ourHomeComp.team.id,
      ourAwayId: ourAwayComp.team.id,
      boxTeams: summary.boxscore?.teams || [],
      shootout: summary.shootout || [],
      statusName: comp.status?.type?.name,
      aetHomeScore: parseInt(ourHomeComp.score, 10),
      aetAwayScore: parseInt(ourAwayComp.score, 10),
    };
  }

  const baseDate = kickoffToDateStr(m.kickoff);
  if (!baseDate) return null;
  for (const dateStr of candidateDates(baseDate)) {
    if (!dateCache.has(dateStr)) {
      try {
        const res = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${dateStr}`);
        dateCache.set(dateStr, res.ok ? ((await res.json()).events || []) : []);
      } catch (e) {
        console.warn('ESPN match stats fetch failed for', dateStr, e.message);
        dateCache.set(dateStr, []);
      }
    }
    const found = findESPNEvent(dateCache.get(dateStr), m.homeTeam, m.awayTeam);
    if (!found) continue;

    const eventId = found.comp.id;
    const summary = await fetchESPNSummary(eventId);
    const ourHomeComp = found.swapped ? found.awayComp : found.homeComp;
    const ourAwayComp = found.swapped ? found.homeComp : found.awayComp;
    return {
      eventId,
      details: found.comp.details || [],
      ourHomeId: ourHomeComp.team.id,
      ourAwayId: ourAwayComp.team.id,
      boxTeams: summary?.boxscore?.teams || [],
      shootout: summary?.shootout || [],
      statusName: found.comp.status?.type?.name,
      aetHomeScore: parseInt(ourHomeComp.score, 10),
      aetAwayScore: parseInt(ourAwayComp.score, 10),
    };
  }
  return null; // not in ESPN's window yet — retry on a later sync
}

// Fills in permanent match stats (cards, fouls, corners, saves, shots, and —
// group stage only — fair play deduction points) for FINISHED matches. Once a
// match has every field below populated it's never re-fetched — none of this
// changes after the final whistle, so each match costs at most one ESPN call,
// ever (plus the one-time discovery search for matches without a cached
// espnEventId yet).
// Whether a knockout-stage match went to penalties can't be reliably detected from
// homeScore === awayScore: football-data.org has been confirmed (against both real
// WC2026 shootouts so far, Germany v Paraguay and Netherlands v Morocco) to report
// score.fullTime for a penalty-decided knockout match as the AET score *plus* each
// side's shootout goals (e.g. AET 1-1, shootout 3-4 on penalties, persisted as
// "4-5") rather than the tied AET score — so the tied-score signal is corrupted at
// the source for exactly the matches that need it most. ESPN's STATUS_FINAL_PEN is
// checked directly instead, and is also used to correct homeScore/awayScore back to
// the real (tied) AET score once detected — see syncMatchStats() below. Persisted as
// m.wentToPenalties once known, so isStatsComplete() doesn't need to re-derive this
// from the (untrustworthy) score every time.
function isStatsComplete(m) {
  return typeof m.homeYellowCards === 'number' &&
    typeof m.homeSaves !== 'undefined' &&
    typeof m.homeShots !== 'undefined' &&
    (m.stage !== 'Group Stage' || (typeof m.homeFairPlay === 'number' && typeof m.awayFairPlay === 'number')) &&
    (m.stage === 'Group Stage' || typeof m.wentToPenalties === 'boolean') &&
    (!m.wentToPenalties || typeof m.homeShootoutScore === 'number');
}

async function syncMatchStats(matches) {
  const pending = matches.filter(m => m.status === 'FINISHED' && !isStatsComplete(m));
  if (!pending.length) return;

  const dateCache = new Map();
  for (const m of pending) {
    const ctx = await resolveEventContext(m, dateCache);
    if (!ctx) continue; // not in ESPN's window yet — retry on the next sync

    m.espnEventId = ctx.eventId;

    const homeBox = ctx.boxTeams.find(t => String(t.team?.id) === String(ctx.ourHomeId));
    const awayBox = ctx.boxTeams.find(t => String(t.team?.id) === String(ctx.ourAwayId));
    // Explicitly assign (rather than skip) even when undefined: JSON.stringify drops
    // undefined keys on write, so this also clears any false zero already baked in by
    // a prior sync that hit an empty boxscore before this field existed.
    applyBoxscoreStats(m, homeBox, awayBox);

    if (m.stage !== 'Group Stage' && typeof m.wentToPenalties !== 'boolean') {
      m.wentToPenalties = ctx.statusName === 'STATUS_FINAL_PEN';
      if (m.wentToPenalties) {
        m.homeShootoutScore = parseShootoutScore(ctx.shootout, ctx.ourHomeId);
        m.awayShootoutScore = parseShootoutScore(ctx.shootout, ctx.ourAwayId);
        // Correct the AET score back to tied — see the isStatsComplete() comment above
        // for why the persisted score can't be trusted for a penalty-decided match.
        if (Number.isFinite(ctx.aetHomeScore) && Number.isFinite(ctx.aetAwayScore)) {
          m.homeScore = ctx.aetHomeScore;
          m.awayScore = ctx.aetAwayScore;
        }
      }
    }

    if (m.stage === 'Group Stage' && (typeof m.homeFairPlay !== 'number' || typeof m.awayFairPlay !== 'number')) {
      const fp = classifyMatchFairPlay(ctx.details, ctx.ourHomeId);
      m.homeFairPlay = fp.home;
      m.awayFairPlay = fp.away;
    }
  }
}

const BRACKET_TEMPLATE = [
  { matchNum: 73,  stage: "Round of 32",   homeTeam: "[2A]",   awayTeam: "[2B]",    kickoff: "2026-06-28T19:00:00.000Z", venue: "Sofi Stadium, Inglewood" },
  { matchNum: 74,  stage: "Round of 32",   homeTeam: "[1E]",   awayTeam: "[3ABCDF]",kickoff: "2026-06-29T20:30:00.000Z", venue: "Gillette Stadium, Foxborough" },
  { matchNum: 75,  stage: "Round of 32",   homeTeam: "[1F]",   awayTeam: "[2C]",    kickoff: "2026-06-30T01:00:00.000Z", venue: "Estadio BBVA, Guadalupe" },
  { matchNum: 76,  stage: "Round of 32",   homeTeam: "[1C]",   awayTeam: "[2F]",    kickoff: "2026-06-29T17:00:00.000Z", venue: "NRG Stadium, Houston" },
  { matchNum: 77,  stage: "Round of 32",   homeTeam: "[1I]",   awayTeam: "[3CDFGH]",kickoff: "2026-06-30T21:00:00.000Z", venue: "MetLife Stadium, East Rutherford" },
  { matchNum: 78,  stage: "Round of 32",   homeTeam: "[2E]",   awayTeam: "[2I]",    kickoff: "2026-06-30T18:00:00.000Z", venue: "AT&T Stadium, Arlington" },
  { matchNum: 79,  stage: "Round of 32",   homeTeam: "[1A]",   awayTeam: "[3CEFHI]",kickoff: "2026-07-01T01:00:00.000Z", venue: "Estadio Azteca, Mexico City" },
  { matchNum: 80,  stage: "Round of 32",   homeTeam: "[1L]",   awayTeam: "[3EHIJK]",kickoff: "2026-07-01T16:00:00.000Z", venue: "Mercedes-Benz Stadium, Atlanta" },
  { matchNum: 81,  stage: "Round of 32",   homeTeam: "[1D]",   awayTeam: "[3BEFIJ]",kickoff: "2026-07-02T00:00:00.000Z", venue: "Levi's Stadium, Santa Clara" },
  { matchNum: 82,  stage: "Round of 32",   homeTeam: "[1G]",   awayTeam: "[3AEHIJ]",kickoff: "2026-07-01T20:00:00.000Z", venue: "Lumen Field, Seattle" },
  { matchNum: 83,  stage: "Round of 32",   homeTeam: "[2K]",   awayTeam: "[2L]",    kickoff: "2026-07-02T23:00:00.000Z", venue: "BMO Field, Toronto" },
  { matchNum: 84,  stage: "Round of 32",   homeTeam: "[1H]",   awayTeam: "[2J]",    kickoff: "2026-07-02T19:00:00.000Z", venue: "Sofi Stadium, Inglewood" },
  { matchNum: 85,  stage: "Round of 32",   homeTeam: "[1B]",   awayTeam: "[3EFGIJ]",kickoff: "2026-07-03T03:00:00.000Z", venue: "BC Place, Vancouver" },
  { matchNum: 86,  stage: "Round of 32",   homeTeam: "[1J]",   awayTeam: "[2H]",    kickoff: "2026-07-03T22:00:00.000Z", venue: "Hard Rock Stadium, Miami Gardens" },
  { matchNum: 87,  stage: "Round of 32",   homeTeam: "[1K]",   awayTeam: "[3DEIJL]",kickoff: "2026-07-04T01:30:00.000Z", venue: "Arrowhead Stadium, Kansas City" },
  { matchNum: 88,  stage: "Round of 32",   homeTeam: "[2D]",   awayTeam: "[2G]",    kickoff: "2026-07-03T18:00:00.000Z", venue: "AT&T Stadium, Arlington" },
  { matchNum: 89,  stage: "Round of 16",   homeTeam: "[W74]",  awayTeam: "[W77]",   kickoff: "2026-07-04T21:00:00.000Z", venue: "Lincoln Financial Field, Philadelphia" },
  { matchNum: 90,  stage: "Round of 16",   homeTeam: "[W73]",  awayTeam: "[W75]",   kickoff: "2026-07-04T17:00:00.000Z", venue: "NRG Stadium, Houston" },
  { matchNum: 91,  stage: "Round of 16",   homeTeam: "[W76]",  awayTeam: "[W78]",   kickoff: "2026-07-05T20:00:00.000Z", venue: "MetLife Stadium, East Rutherford" },
  { matchNum: 92,  stage: "Round of 16",   homeTeam: "[W79]",  awayTeam: "[W80]",   kickoff: "2026-07-06T00:00:00.000Z", venue: "Estadio Azteca, Mexico City" },
  { matchNum: 93,  stage: "Round of 16",   homeTeam: "[W83]",  awayTeam: "[W84]",   kickoff: "2026-07-06T19:00:00.000Z", venue: "AT&T Stadium, Arlington" },
  { matchNum: 94,  stage: "Round of 16",   homeTeam: "[W81]",  awayTeam: "[W82]",   kickoff: "2026-07-07T00:00:00.000Z", venue: "Lumen Field, Seattle" },
  { matchNum: 95,  stage: "Round of 16",   homeTeam: "[W86]",  awayTeam: "[W88]",   kickoff: "2026-07-07T16:00:00.000Z", venue: "Mercedes-Benz Stadium, Atlanta" },
  { matchNum: 96,  stage: "Round of 16",   homeTeam: "[W85]",  awayTeam: "[W87]",   kickoff: "2026-07-07T20:00:00.000Z", venue: "BC Place, Vancouver" },
  { matchNum: 97,  stage: "Quarterfinals", homeTeam: "[W89]",  awayTeam: "[W90]",   kickoff: "2026-07-09T20:00:00.000Z", venue: "Gillette Stadium, Foxborough" },
  { matchNum: 98,  stage: "Quarterfinals", homeTeam: "[W93]",  awayTeam: "[W94]",   kickoff: "2026-07-10T19:00:00.000Z", venue: "Sofi Stadium, Inglewood" },
  { matchNum: 99,  stage: "Quarterfinals", homeTeam: "[W91]",  awayTeam: "[W92]",   kickoff: "2026-07-11T21:00:00.000Z", venue: "Hard Rock Stadium, Miami Gardens" },
  { matchNum: 100, stage: "Quarterfinals", homeTeam: "[W95]",  awayTeam: "[W96]",   kickoff: "2026-07-12T01:00:00.000Z", venue: "Arrowhead Stadium, Kansas City" },
  { matchNum: 101, stage: "Semifinals",    homeTeam: "[W97]",  awayTeam: "[W98]",   kickoff: "2026-07-14T19:00:00.000Z", venue: "AT&T Stadium, Arlington" },
  { matchNum: 102, stage: "Semifinals",    homeTeam: "[W99]",  awayTeam: "[W100]",  kickoff: "2026-07-15T19:00:00.000Z", venue: "Mercedes-Benz Stadium, Atlanta" },
  { matchNum: 103, stage: "Third Place",   homeTeam: "[L101]", awayTeam: "[L102]",  kickoff: "2026-07-18T21:00:00.000Z", venue: "Hard Rock Stadium, Miami Gardens" },
  { matchNum: 104, stage: "Final",         homeTeam: "[W101]", awayTeam: "[W102]",  kickoff: "2026-07-19T19:00:00.000Z", venue: "MetLife Stadium, East Rutherford" },
];

function cleanName(name) {
  if (!name) return "";
  return name.toString().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/gi, '').trim().toLowerCase();
}

// Our team name -> FIFA's 3-letter team code (used to match against the ranking page,
// since 7 of 48 teams have name mismatches, e.g. FIFA's "Korea Republic" vs our "South Korea").
const FIFA_CODE_MAP = {
  "Mexico": "MEX", "South Africa": "RSA", "South Korea": "KOR", "Czechia": "CZE",
  "Canada": "CAN", "Bosnia-Herzegovina": "BIH", "Qatar": "QAT", "Switzerland": "SUI",
  "Brazil": "BRA", "Morocco": "MAR", "Haiti": "HAI", "Scotland": "SCO",
  "United States": "USA", "Paraguay": "PAR", "Australia": "AUS", "Turkey": "TUR",
  "Germany": "GER", "Curaçao": "CUW", "Ivory Coast": "CIV", "Ecuador": "ECU",
  "Netherlands": "NED", "Japan": "JPN", "Sweden": "SWE", "Tunisia": "TUN",
  "Belgium": "BEL", "Egypt": "EGY", "Iran": "IRN", "New Zealand": "NZL",
  "Saudi Arabia": "KSA", "Uruguay": "URU", "Spain": "ESP", "Cape Verde Islands": "CPV",
  "France": "FRA", "Senegal": "SEN", "Iraq": "IRQ", "Norway": "NOR",
  "Argentina": "ARG", "Algeria": "ALG", "Austria": "AUT", "Jordan": "JOR",
  "Portugal": "POR", "Congo DR": "COD", "Uzbekistan": "UZB", "Colombia": "COL",
  "England": "ENG", "Croatia": "CRO", "Ghana": "GHA", "Panama": "PAN",
};

// Loaded once at startup from src/data/fifa_rankings.json (if present), refreshed in-memory
// by syncFifaRankings() below when a newer blueprint_data/fifa_rankings_*.html shows up.
let FIFA_RANKS = {};
try { FIFA_RANKS = JSON.parse(readFileSync(FIFA_RANKINGS_PATH, 'utf8')).ranks || {}; } catch { /* none yet */ }

function fifaRankOf(team) {
  return FIFA_RANKS[team] ?? TEAM_MASTER_DATA[team]?.fifaRank ?? 9999;
}

// Parses FIFA's official ranking page HTML, matching against stable CSS class patterns:
// rank in custom-rank-cell_rankNumber__*, team 3-letter code in the fifa-world-ranking/{CODE}
// link href, in that order within each <tr>. Returns { code: rank }.
function parseFifaRankingsHtml(html) {
  const re = /custom-rank-cell_rankNumber__[^"]*">(\d+)<\/h3>.*?fifa-world-ranking\/([A-Z]{3})\?gender=men/gs;
  const codeToRank = {};
  let m;
  while ((m = re.exec(html))) {
    if (!(m[2] in codeToRank)) codeToRank[m[2]] = parseInt(m[1], 10);
  }
  return codeToRank;
}

// Looks for the most recently dated fifa_rankings_YYYY-MM-DD.html snapshot in blueprint_data/
// (filenames sort chronologically as strings) and, if it's newer than the one we last parsed,
// re-parses it and writes src/data/fifa_rankings.json. FIFA updates the official ranking
// several times during the tournament — this is the only step needed to pick up a refresh:
// drop a new dated HTML snapshot in blueprint_data/ and the next cron run does the rest.
function syncFifaRankings() {
  let files;
  try { files = readdirSync(BLUEPRINT_DIR); } catch { return; }
  const snapshots = files.filter(f => /^fifa_rankings_\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort();
  const latest = snapshots[snapshots.length - 1];
  if (!latest) return;

  let currentSource = null;
  try { currentSource = JSON.parse(readFileSync(FIFA_RANKINGS_PATH, 'utf8')).source; } catch { /* none yet */ }
  if (latest === currentSource) return false; // already up to date

  const html = readFileSync(join(BLUEPRINT_DIR, latest), 'utf8');
  const codeToRank = parseFifaRankingsHtml(html);
  const ranks = {};
  for (const [team, code] of Object.entries(FIFA_CODE_MAP)) {
    if (codeToRank[code] != null) ranks[team] = codeToRank[code];
  }
  const asOf = latest.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  writeFileSync(FIFA_RANKINGS_PATH, JSON.stringify({ asOf, source: latest, ranks }, null, 2));
  FIFA_RANKS = ranks;
  console.log(`FIFA rankings updated from ${latest} (${Object.keys(ranks).length}/${Object.keys(FIFA_CODE_MAP).length} teams matched)`);
  return true;
}

// Supplemental news sources beyond ESPN's article API (which app.js fetches
// directly from the browser). These hosts don't set CORS headers, so they're
// fetched here (GitHub Actions has unrestricted network) and baked into a
// static JSON file the frontend can fetch like any other src/data/*.json file.
const RSS_FEEDS = [
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/football/rss' },
  { name: 'Fox Sports', url: 'https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30&tags=fs%2Fsoccer%2Csoccer%2Fepl%2Fleague%2F1%2Csoccer%2Fmls%2Fleague%2F5%2Csoccer%2Fucl%2Fleague%2F7%2Csoccer%2Feuropa%2Fleague%2F8%2Csoccer%2Fwc%2Fleague%2F12%2Csoccer%2Feuro%2Fleague%2F13%2Csoccer%2Fwwc%2Fleague%2F14%2Csoccer%2Fnwsl%2Fleague%2F20%2Csoccer%2Fcwc%2Fleague%2F26%2Csoccer%2Fgold_cup%2Fleague%2F32%2Csoccer%2Funl%2Fleague%2F67' },
  { name: 'NY Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Soccer.xml' },
  { name: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/soccer/' },
  { name: 'Yahoo Sports', url: 'https://sports.yahoo.com/soccer/rss/' },
];

const TEAM_NAMES = Object.keys(TEAM_MASTER_DATA);

// RSS prose rarely uses our exact TEAM_MASTER_DATA key — outlets favor common/
// colloquial names ("USA", "Czech Republic", "Bosnia") over official ones. Extra
// substrings to also check per team, on top of the team's own full name. Kept
// conservative (no single ambiguous tokens like "Korea" or "Congo" alone, which
// would cross-match North Korea / Congo-Brazzaville coverage).
const TEAM_NAME_ALIASES = {
  'United States': ['USA', 'U.S.', 'Team USA', 'US Soccer'],
  'South Korea': ['Korea Republic'],
  'Czechia': ['Czech Republic'],
  'Bosnia-Herzegovina': ['Bosnia'],
  'Ivory Coast': ["Côte d'Ivoire", "Cote d'Ivoire"],
  'Congo DR': ['DR Congo', 'Democratic Republic of Congo', 'DRC'],
  'Cape Verde Islands': ['Cape Verde', 'Cabo Verde'],
  'Curaçao': ['Curacao'],
  'Turkey': ['Türkiye', 'Turkiye'],
  'Saudi Arabia': ['Saudi'],
};

function decodeRssEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .trim();
}

function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = decodeRssEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    const link = decodeRssEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
    const description = decodeRssEntities(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '');
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || null;
    const image = block.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1]
      || block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/)?.[1]
      || null;
    if (title && link) items.push({ title, link, description, pubDate, image });
  }
  return items;
}

// RSS feeds carry no team/event IDs, unlike ESPN's structured categories[] —
// this is the closest equivalent: a case-insensitive substring match of every
// TEAM_MASTER_DATA name (plus common aliases — see TEAM_NAME_ALIASES) against
// the article's title+description.
function matchTeams(text) {
  const lower = text.toLowerCase();
  return TEAM_NAMES.filter(team => {
    const names = [team, ...(TEAM_NAME_ALIASES[team] || [])];
    return names.some(n => lower.includes(n.toLowerCase()));
  });
}

async function fetchRssFeed(feed) {
  try {
    const res = await fetch(feed.url);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = parseRssItems(xml);
    // Scoped to World Cup relevance only, to avoid pulling general club-football
    // noise from these feeds' broader football coverage.
    return items
      .filter(it => /world cup/i.test(it.title) || /world cup/i.test(it.description))
      .map(it => ({
        headline: it.title,
        links: { web: { href: it.link } },
        images: it.image ? [{ url: it.image }] : [],
        source: feed.name,
        pubDate: it.pubDate,
        teams: matchTeams(`${it.title} ${it.description}`),
      }));
  } catch (e) {
    console.warn('RSS fetch failed for', feed.name, e.message);
    return [];
  }
}

// Each feed's RSS endpoint only ever returns its current ~20-50 latest items —
// there's no historical lookup. Previously this function overwrote
// rss_news.json with just that latest batch every sync, so once an article
// scrolled off a feed's live RSS it was gone forever from our data too,
// leaving older matches' news with nothing but ESPN. Now it accumulates: every
// previously-saved item is kept (deduped by link) and merged with whatever's
// newly fetched, so the archive only grows across the tournament and old
// matches keep their RSS coverage. Capped defensively at MAX_RSS_ARCHIVE so a
// full tournament's worth of items can't grow the file unboundedly; well above
// what a one-month tournament across 6 feeds actually produces.
const MAX_RSS_ARCHIVE = 1000;

async function syncRssNews() {
  const results = await Promise.all(RSS_FEEDS.map(fetchRssFeed));
  const fetched = results.flat();

  let existing = [];
  try {
    existing = JSON.parse(readFileSync(RSS_NEWS_PATH, 'utf8')).items || [];
  } catch { /* none yet */ }

  const byLink = new Map(existing.map(i => [i.links.web.href, i]));
  for (const item of fetched) byLink.set(item.links.web.href, item);

  const items = [...byLink.values()]
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, MAX_RSS_ARCHIVE);

  const currentLinks = existing.map(i => i.links.web.href).join(',');
  const newLinks = items.map(i => i.links.web.href).join(',');
  if (newLinks === currentLinks) return false;

  writeFileSync(RSS_NEWS_PATH, JSON.stringify({ asOf: new Date().toISOString(), items }, null, 2));
  console.log(`RSS news updated: ${items.length} World Cup-related items archived (${fetched.length} fetched this sync) from ${RSS_FEEDS.length} feeds`);
  return true;
}

// FIFA's official group-stage tiebreaker order: pts -> GD -> GF -> head-to-head mini-league
// (pts -> GD -> GF, group-stage matches between the tied teams only) -> fair play points ->
// FIFA World Ranking position -> alphabetical (last-resort, should rarely matter).
function sortStandingsWithHeadToHead(teams, groupMatches) {
  const baseSorted = [...teams].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  const result = [];
  let i = 0;
  while (i < baseSorted.length) {
    let j = i + 1;
    while (j < baseSorted.length &&
      baseSorted[j].pts === baseSorted[i].pts && baseSorted[j].gd === baseSorted[i].gd && baseSorted[j].gf === baseSorted[i].gf) j++;
    const cluster = baseSorted.slice(i, j);
    result.push(...(cluster.length > 1 ? resolveHeadToHead(cluster, groupMatches) : cluster));
    i = j;
  }
  return result;
}

function resolveHeadToHead(cluster, groupMatches) {
  const names = new Set(cluster.map(t => t.team));
  const mini = {};
  for (const t of cluster) mini[t.team] = { pts: 0, gf: 0, ga: 0 };
  for (const m of groupMatches) {
    if (!names.has(m.homeTeam) || !names.has(m.awayTeam)) continue;
    const h = mini[m.homeTeam], a = mini[m.awayTeam];
    const hs = m.homeScore ?? 0, as = m.awayScore ?? 0;
    h.gf += hs; h.ga += as;
    a.gf += as; a.ga += hs;
    if (hs > as) h.pts += 3;
    else if (hs === as) { h.pts += 1; a.pts += 1; }
    else a.pts += 3;
  }
  return [...cluster].sort((a, b) => {
    const ma = mini[a.team], mb = mini[b.team];
    return (mb.pts - ma.pts) || ((mb.gf - mb.ga) - (ma.gf - ma.ga)) || (mb.gf - ma.gf) ||
      ((b.fairPlayPoints || 0) - (a.fairPlayPoints || 0)) ||
      (fifaRankOf(a.team) - fifaRankOf(b.team)) ||
      a.team.localeCompare(b.team);
  });
}

function computeStandings(matches) {
  const standings = {};
  for (const m of matches) {
    if (m.stage !== 'Group Stage') continue;
    for (const [team, iso, scored, conceded, fairPlay] of [
      [m.homeTeam, m.homeIso, m.homeScore, m.awayScore, m.homeFairPlay],
      [m.awayTeam, m.awayIso, m.awayScore, m.homeScore, m.awayFairPlay]
    ]) {
      const g = TEAM_MASTER_DATA[team]?.group;
      if (!team || !g) continue;
      if (!standings[g]) standings[g] = {};
      if (!standings[g][team]) standings[g][team] = { team, iso, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0, fairPlayPoints: 0 };
      if (m.status === 'FINISHED') {
        const s = standings[g][team];
        s.played++;
        s.gf += scored ?? 0;
        s.ga += conceded ?? 0;
        s.gd = s.gf - s.ga;
        s.fairPlayPoints += fairPlay ?? 0;
        if (scored > conceded) { s.won++; s.pts += 3; }
        else if (scored === conceded) { s.drawn++; s.pts += 1; }
        else s.lost++;
      }
    }
  }
  const result = {};
  for (const [g, teams] of Object.entries(standings)) {
    const groupMatches = matches.filter(m => m.stage === 'Group Stage' && m.status === 'FINISHED' &&
      TEAM_MASTER_DATA[m.homeTeam]?.group === g && TEAM_MASTER_DATA[m.awayTeam]?.group === g);
    result[g] = sortStandingsWithHeadToHead(Object.values(teams), groupMatches);
  }
  return result;
}

// Cross-group comparison of all 12 groups' 3rd-place finishers (kept in sync with src/app.js).
// Head-to-head doesn't apply here -- different groups never play each other -- so this falls
// straight to fair play -> FIFA ranking -> alphabetical.
function computeThirdPlaceRankings(standings) {
  const thirds = [];
  for (const [grp, teams] of Object.entries(standings)) {
    if (teams.length >= 3) thirds.push({ ...teams[2], groupLetter: grp });
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (b.fairPlayPoints || 0) - (a.fairPlayPoints || 0) || (fifaRankOf(a.team) - fifaRankOf(b.team)) || a.team.localeCompare(b.team));
  return thirds;
}

function getThirdPlaceCombinationString(topEight) {
  return topEight.map(t => t.groupLetter).sort().join('');
}

// Resolves every knockout-bracket placeholder team name ([1A], [2B], [3BEFIJ],
// [W74], [L101], etc.) to a real team name, once enough information exists --
// run server-side (unlike the frontend's speculative Live/Official projection)
// because by the time this runs, the relevant matches are already FINISHED, so
// there's nothing to project: standings/results are exact. Mutates `matches`
// in place, writing resolved homeTeam/homeIso/awayTeam/awayIso onto each
// knockout match whose placeholder(s) can now be resolved. Iterates a few
// passes since later rounds ([W89] etc.) depend on earlier rounds having
// already been resolved to real names this same run.
function resolveBracketPlaceholders(matches) {
  const groupMatches = matches.filter(m => m.stage === 'Group Stage');
  const groupStageComplete = groupMatches.length > 0 && groupMatches.every(m => m.status === 'FINISHED');
  if (!groupStageComplete) return false;

  const standings = computeStandings(matches);
  const thirdPlace = computeThirdPlaceRankings(standings);
  const topEight = thirdPlace.slice(0, 8);
  const combinationString = getThirdPlaceCombinationString(topEight);
  let combinations = {};
  try { combinations = JSON.parse(readFileSync(COMBINATIONS_PATH, 'utf8')); } catch { /* leave empty */ }
  const combEntry = combinations[combinationString];

  const byMatchNum = {};
  for (const m of matches) byMatchNum[m.matchNum] = m;

  function resolvePlaceholder(placeholder) {
    const m = placeholder.match(/^\[(.+)\]$/);
    if (!m) return null;
    const code = m[1];

    const posMatch = code.match(/^([1-4])([A-L])$/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10) - 1;
      const grp = posMatch[2];
      const t = standings[grp]?.[pos];
      return t ? { name: t.team, iso: t.iso } : null;
    }

    const thirdMatch = code.match(/^3([A-L]+)$/);
    if (thirdMatch) {
      const opponentKey = SLOT_TO_OPPONENT[code];
      const teamCode = opponentKey && combEntry?.[opponentKey]; // e.g. "3E"
      if (!teamCode) return null;
      const grpLetter = teamCode.replace('3', '');
      const t = standings[grpLetter]?.[2];
      return t ? { name: t.team, iso: t.iso } : null;
    }

    const wlMatch = code.match(/^([WL])(\d+)$/);
    if (wlMatch) {
      const feeder = byMatchNum[parseInt(wlMatch[2], 10)];
      if (!feeder || feeder.status !== 'FINISHED' || feeder.homeScore === null || feeder.awayScore === null) return null;
      if (feeder.homeTeam?.startsWith('[') || feeder.awayTeam?.startsWith('[')) return null;
      // A knockout match tied at FT/AET went to a penalty shootout — homeScore/awayScore
      // stay tied forever, so the shootout score (baked in by syncMatchStats() just before
      // this runs) is the only way to tell the winner. If it's still missing (shouldn't
      // happen for a real FINISHED knockout match, but defensive), leave unresolved rather
      // than guessing a winner from a 0-0 default.
      let homeWon;
      if (feeder.homeScore === feeder.awayScore) {
        if (typeof feeder.homeShootoutScore !== 'number' || typeof feeder.awayShootoutScore !== 'number' ||
          feeder.homeShootoutScore === feeder.awayShootoutScore) return null;
        homeWon = feeder.homeShootoutScore > feeder.awayShootoutScore;
      } else {
        homeWon = feeder.homeScore > feeder.awayScore;
      }
      const winner = homeWon ? { name: feeder.homeTeam, iso: feeder.homeIso } : { name: feeder.awayTeam, iso: feeder.awayIso };
      const loser = homeWon ? { name: feeder.awayTeam, iso: feeder.awayIso } : { name: feeder.homeTeam, iso: feeder.homeIso };
      return wlMatch[1] === 'W' ? winner : loser;
    }

    return null;
  }

  let changed = false;
  // A few passes so [W89]-style placeholders resolve once their own feeder
  // matches were just resolved (by team name, not yet by score) earlier in
  // the same pass -- though W/L specifically also needs the feeder's score,
  // so this mainly helps name/iso propagate to subsequent rounds quickly
  // once a feeder match is actually played.
  for (let pass = 0; pass < 3; pass++) {
    let passChanged = false;
    for (const knockoutMatch of matches) {
      if (knockoutMatch.stage === 'Group Stage') continue;
      if (knockoutMatch.homeTeam?.startsWith('[')) {
        const r = resolvePlaceholder(knockoutMatch.homeTeam);
        if (r) { knockoutMatch.homeTeam = r.name; knockoutMatch.homeIso = r.iso; changed = true; passChanged = true; }
      }
      if (knockoutMatch.awayTeam?.startsWith('[')) {
        const r = resolvePlaceholder(knockoutMatch.awayTeam);
        if (r) { knockoutMatch.awayTeam = r.name; knockoutMatch.awayIso = r.iso; changed = true; passChanged = true; }
      }
    }
    if (!passChanged) break;
  }
  return changed;
}

function bootstrapFromApi(apiMatches, now) {
  const groupStageApi = apiMatches
    .filter(m => m.stage === 'GROUP_STAGE' || (m.homeTeam?.name && TEAM_MASTER_DATA[m.homeTeam.name]?.group))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate) || (a.homeTeam?.name || '').localeCompare(b.homeTeam?.name || ''));

  const matches = [];
  let matchNum = 1;

  for (const api of groupStageApi) {
    const homeName = api.homeTeam?.name || '';
    const awayName = api.awayTeam?.name || '';
    const homeMeta = TEAM_MASTER_DATA[homeName] || {};
    const awayMeta = TEAM_MASTER_DATA[awayName] || {};
    if (!homeMeta.group) continue; // skip non-group-stage teams

    const status = api.status === 'FINISHED' ? 'FINISHED'
      : api.status === 'IN_PLAY' ? 'IN_PLAY'
      : api.status === 'PAUSED' ? 'PAUSED'
      : 'SCHEDULED';

    const score = api.score;
    let homeScore = null, awayScore = null;
    if (status === 'FINISHED' && score?.fullTime) {
      homeScore = score.fullTime.home;
      awayScore = score.fullTime.away;
    }

    matches.push({
      matchId: api.id,
      matchNum: matchNum++,
      stage: 'Group Stage',
      group: homeMeta.group || null,
      homeTeam: homeName,
      homeIso: homeMeta.iso || null,
      awayTeam: awayName,
      awayIso: awayMeta.iso || null,
      venue: api.venue || null,
      kickoff: api.utcDate || null,
      homeScore,
      awayScore,
      status,
      firstHalfStart: null,
      secondHalfStart: null,
    });
  }

  for (const tmpl of BRACKET_TEMPLATE) {
    matches.push({
      matchId: null,
      matchNum: tmpl.matchNum,
      stage: tmpl.stage,
      group: null,
      homeTeam: tmpl.homeTeam,
      homeIso: null,
      awayTeam: tmpl.awayTeam,
      awayIso: null,
      venue: tmpl.venue,
      kickoff: tmpl.kickoff,
      homeScore: null,
      awayScore: null,
      status: 'SCHEDULED',
      firstHalfStart: null,
      secondHalfStart: null,
    });
  }

  return {
    lastUpdated: now,
    matches,
    standings: computeStandings(matches),
  };
}

async function main() {
  const token = process.env.FD_API_TOKEN;
  if (!token) {
    console.log('No FD_API_TOKEN set, skipping API fetch');
    return;
  }

  const headers = { 'X-Auth-Token': token };
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026', { headers });
  if (!res.ok) { console.error('API error:', res.status); return; }

  const apiData = await res.json();
  const apiMatches = apiData.matches || [];
  const now = new Date().toISOString();

  // Pick up a newer blueprint_data/fifa_rankings_*.html snapshot, if one has been added,
  // before computing standings below. No-op (and no commit) if nothing newer is present.
  const fifaRankingsChanged = syncFifaRankings();

  // Refresh the supplemental RSS news feed (BBC Sport, The Guardian), filtered
  // to World Cup-related items. No-op (and no commit) if nothing changed.
  const rssNewsChanged = await syncRssNews();

  // Bootstrap if data.json is missing or empty
  const needsBootstrap = !existsSync(DATA_PATH) ||
    (() => { try { return JSON.parse(readFileSync(DATA_PATH, 'utf8')).matches?.length === 0; } catch { return true; } })();

  if (needsBootstrap) {
    console.log('Bootstrapping data.json from API...');
    const data = bootstrapFromApi(apiMatches, now);
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    try {
      const fifaAdd = fifaRankingsChanged ? 'src/data/fifa_rankings.json ' : '';
      const rssAdd = rssNewsChanged ? 'src/data/rss_news.json ' : '';
      execSync(`git add src/data/data.json ${fifaAdd}${rssAdd}&& git commit -m "chore: bootstrap match data from API [$(date -u +%Y-%m-%dT%H:%M:%SZ)]" && git push`, { stdio: 'inherit' });
    } catch (e) {
      console.error('Git commit failed:', e.message);
    }
    console.log('Bootstrap complete:', now);
    return;
  }

  const current = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const oldJson = JSON.stringify(current, null, 2);

  for (const ourMatch of current.matches) {
    let apiMatch = apiMatches.find(m => m.id === ourMatch.matchId);
    if (!apiMatch) {
      const cleanHome = cleanName(ourMatch.homeTeam);
      const cleanAway = cleanName(ourMatch.awayTeam);
      apiMatch = apiMatches.find(m => {
        const h = cleanName(m.homeTeam?.name);
        const a = cleanName(m.awayTeam?.name);
        return (h === cleanHome && a === cleanAway) || (h === cleanAway && a === cleanHome);
      });
      if (apiMatch) ourMatch.matchId = apiMatch.id; // self-heal matchId
    }
    if (!apiMatch) continue;

    const prevStatus = ourMatch.status;
    const apiStatus = apiMatch.status;
    let newStatus = ourMatch.status;
    if (apiStatus === 'FINISHED') newStatus = 'FINISHED';
    else if (apiStatus === 'IN_PLAY') newStatus = 'IN_PLAY';
    else if (apiStatus === 'PAUSED') newStatus = 'PAUSED';
    else if (apiStatus === 'TIMED' || apiStatus === 'SCHEDULED') newStatus = 'SCHEDULED';
    ourMatch.status = newStatus;

    const score = apiMatch.score;
    // Skip once a match is confirmed penalty-decided: football-data.org's fullTime
    // score is wrong for these (see isStatsComplete() comment above) and would
    // otherwise re-clobber the ESPN-corrected score on every subsequent sync.
    if (score?.fullTime && newStatus === 'FINISHED' && !ourMatch.wentToPenalties) {
      ourMatch.homeScore = score.fullTime.home;
      ourMatch.awayScore = score.fullTime.away;
    }
    if (score?.halfTime && newStatus === 'PAUSED' && score.halfTime.home !== null) {
      ourMatch.homeScore = score.halfTime.home;
      ourMatch.awayScore = score.halfTime.away;
    }
    if (newStatus === 'IN_PLAY' && score?.fullTime?.home !== null) {
      ourMatch.homeScore = score.fullTime.home;
      ourMatch.awayScore = score.fullTime.away;
    }

    if (newStatus === 'IN_PLAY' && prevStatus === 'SCHEDULED' && !ourMatch.firstHalfStart) {
      ourMatch.firstHalfStart = now;
    }
    if (newStatus === 'IN_PLAY' && prevStatus === 'PAUSED' && !ourMatch.secondHalfStart) {
      ourMatch.secondHalfStart = now;
    }
  }

  await syncMatchStats(current.matches);
  // Once the group stage is fully FINISHED, standings/third-place rankings are
  // exact (no projection needed) -- resolve [1A]/[3BEFIJ]/[W74]-style knockout
  // placeholders to real team names so the self-heal matchId lookup above (and
  // the frontend's ESPN team-ID matching) can actually find these fixtures
  // once football-data.org/ESPN populate them, instead of waiting on a manual
  // name match against a placeholder string that can never match.
  resolveBracketPlaceholders(current.matches);
  current.standings = computeStandings(current.matches);
  current.lastUpdated = now;

  const newJson = JSON.stringify(current, null, 2);
  writeFileSync(DATA_PATH, newJson);

  if (newJson !== oldJson || fifaRankingsChanged || rssNewsChanged) {
    try {
      const fifaAdd = fifaRankingsChanged ? 'src/data/fifa_rankings.json ' : '';
      const rssAdd = rssNewsChanged ? 'src/data/rss_news.json ' : '';
      execSync(`git add src/data/data.json ${fifaAdd}${rssAdd}&& git commit -m "chore: sync match data [$(date -u +%Y-%m-%dT%H:%M:%SZ)]" && git push`, { stdio: 'inherit' });
    } catch (e) {
      console.error('Git commit failed:', e.message);
    }
  }

  console.log('Update complete:', now);
}

main().catch(console.error);
