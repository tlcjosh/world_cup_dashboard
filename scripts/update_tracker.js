import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '..', 'src', 'data', 'data.json');

const TEAM_MASTER_DATA = {
  "Mexico": { group: "A", iso: "mx", espnId: 203 }, "South Africa": { group: "A", iso: "za", espnId: 467 }, "South Korea": { group: "A", iso: "kr", espnId: 451 }, "Czechia": { group: "A", iso: "cz", espnId: 450 },
  "Canada": { group: "B", iso: "ca", espnId: 206 }, "Bosnia-Herzegovina": { group: "B", iso: "ba", espnId: 452 }, "Qatar": { group: "B", iso: "qa", espnId: 4398 }, "Switzerland": { group: "B", iso: "ch", espnId: 475 },
  "Brazil": { group: "C", iso: "br", espnId: 205 }, "Morocco": { group: "C", iso: "ma", espnId: 2869 }, "Haiti": { group: "C", iso: "ht", espnId: 2654 }, "Scotland": { group: "C", iso: "scotland", espnId: 580 },
  "United States": { group: "D", iso: "us", espnId: 660 }, "Paraguay": { group: "D", iso: "py", espnId: 210 }, "Australia": { group: "D", iso: "au", espnId: 628 }, "Turkey": { group: "D", iso: "tr", espnId: 465 },
  "Germany": { group: "E", iso: "de", espnId: 481 }, "Curaçao": { group: "E", iso: "cw", espnId: 11678 }, "Ivory Coast": { group: "E", iso: "ci", espnId: 4789 }, "Ecuador": { group: "E", iso: "ec", espnId: 209 },
  "Netherlands": { group: "F", iso: "nl", espnId: 449 }, "Japan": { group: "F", iso: "jp", espnId: 627 }, "Sweden": { group: "F", iso: "se", espnId: 466 }, "Tunisia": { group: "F", iso: "tn", espnId: 659 },
  "Belgium": { group: "G", iso: "be", espnId: 459 }, "Egypt": { group: "G", iso: "eg", espnId: 2620 }, "Iran": { group: "G", iso: "ir", espnId: 469 }, "New Zealand": { group: "G", iso: "nz", espnId: 2666 },
  "Saudi Arabia": { group: "H", iso: "sa", espnId: 655 }, "Uruguay": { group: "H", iso: "uy", espnId: 212 }, "Spain": { group: "H", iso: "es", espnId: 164 }, "Cape Verde Islands": { group: "H", iso: "cv", espnId: 2597 },
  "France": { group: "I", iso: "fr", espnId: 478 }, "Senegal": { group: "I", iso: "sn", espnId: 654 }, "Iraq": { group: "I", iso: "iq", espnId: 4375 }, "Norway": { group: "I", iso: "no", espnId: 464 },
  "Argentina": { group: "J", iso: "ar", espnId: 202 }, "Algeria": { group: "J", iso: "dz", espnId: 624 }, "Austria": { group: "J", iso: "at", espnId: 474 }, "Jordan": { group: "J", iso: "jo", espnId: 2917 },
  "Portugal": { group: "K", iso: "pt", espnId: 482 }, "Congo DR": { group: "K", iso: "cd", espnId: 2850 }, "Uzbekistan": { group: "K", iso: "uz", espnId: 2570 }, "Colombia": { group: "K", iso: "co", espnId: 208 },
  "England": { group: "L", iso: "england", espnId: 448 }, "Croatia": { group: "L", iso: "hr", espnId: 477 }, "Ghana": { group: "L", iso: "gh", espnId: 4469 }, "Panama": { group: "L", iso: "pa", espnId: 2659 }
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

// Fills in homeFairPlay/awayFairPlay for newly-FINISHED group stage matches from ESPN's
// date-scoped scoreboard (football-data.org has no disciplinary data at all). Once a
// match has these fields set they're never re-fetched — card events don't change after
// the final whistle, so this only costs one ESPN call per matchday, the first time any
// of that day's matches finish.
async function syncFairPlayPoints(matches) {
  const pending = matches.filter(m =>
    m.stage === 'Group Stage' && m.status === 'FINISHED' &&
    (typeof m.homeFairPlay !== 'number' || typeof m.awayFairPlay !== 'number')
  );
  if (!pending.length) return;

  const dateCache = new Map();
  for (const m of pending) {
    const dateStr = kickoffToDateStr(m.kickoff);
    if (!dateStr) continue;
    if (!dateCache.has(dateStr)) {
      try {
        const res = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${dateStr}`);
        dateCache.set(dateStr, res.ok ? ((await res.json()).events || []) : []);
      } catch (e) {
        console.warn('ESPN fair play fetch failed for', dateStr, e.message);
        dateCache.set(dateStr, []);
      }
    }
    const events = dateCache.get(dateStr);
    const found = findESPNEvent(events, m.homeTeam, m.awayTeam);
    if (!found) continue; // not in ESPN's window yet — retry on the next sync

    const ourHomeId = (found.swapped ? found.awayComp : found.homeComp).team.id;
    const fp = classifyMatchFairPlay(found.comp.details || [], ourHomeId);
    m.homeFairPlay = fp.home;
    m.awayFairPlay = fp.away;
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
    result[g] = Object.values(teams).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (b.fairPlayPoints || 0) - (a.fairPlayPoints || 0) || a.team.localeCompare(b.team)
    );
  }
  return result;
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

  // Bootstrap if data.json is missing or empty
  const needsBootstrap = !existsSync(DATA_PATH) ||
    (() => { try { return JSON.parse(readFileSync(DATA_PATH, 'utf8')).matches?.length === 0; } catch { return true; } })();

  if (needsBootstrap) {
    console.log('Bootstrapping data.json from API...');
    const data = bootstrapFromApi(apiMatches, now);
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    try {
      execSync(`git add src/data/data.json && git commit -m "chore: bootstrap match data from API [$(date -u +%Y-%m-%dT%H:%M:%SZ)]" && git push`, { stdio: 'inherit' });
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
    if (score?.fullTime && newStatus === 'FINISHED') {
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

  await syncFairPlayPoints(current.matches);
  current.standings = computeStandings(current.matches);
  current.lastUpdated = now;

  const newJson = JSON.stringify(current, null, 2);
  writeFileSync(DATA_PATH, newJson);

  if (newJson !== oldJson) {
    try {
      execSync(`git add src/data/data.json && git commit -m "chore: sync match data [$(date -u +%Y-%m-%dT%H:%M:%SZ)]" && git push`, { stdio: 'inherit' });
    } catch (e) {
      console.error('Git commit failed:', e.message);
    }
  }

  console.log('Update complete:', now);
}

main().catch(console.error);
