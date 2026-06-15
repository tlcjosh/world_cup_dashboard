import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '..', 'src', 'data', 'data.json');

const TEAM_MASTER_DATA = {
  "Mexico": { group: "A", iso: "mx" }, "South Africa": { group: "A", iso: "za" }, "South Korea": { group: "A", iso: "kr" }, "Czechia": { group: "A", iso: "cz" },
  "Canada": { group: "B", iso: "ca" }, "Bosnia-Herzegovina": { group: "B", iso: "ba" }, "Qatar": { group: "B", iso: "qa" }, "Switzerland": { group: "B", iso: "ch" },
  "Brazil": { group: "C", iso: "br" }, "Morocco": { group: "C", iso: "ma" }, "Haiti": { group: "C", iso: "ht" }, "Scotland": { group: "C", iso: "scotland" },
  "United States": { group: "D", iso: "us" }, "Paraguay": { group: "D", iso: "py" }, "Australia": { group: "D", iso: "au" }, "Turkey": { group: "D", iso: "tr" },
  "Germany": { group: "E", iso: "de" }, "Curaçao": { group: "E", iso: "cw" }, "Ivory Coast": { group: "E", iso: "ci" }, "Ecuador": { group: "E", iso: "ec" },
  "Netherlands": { group: "F", iso: "nl" }, "Japan": { group: "F", iso: "jp" }, "Sweden": { group: "F", iso: "se" }, "Tunisia": { group: "F", iso: "tn" },
  "Spain": { group: "G", iso: "es" }, "Cape Verde Islands": { group: "G", iso: "cv" }, "Belgium": { group: "G", iso: "be" }, "Egypt": { group: "G", iso: "eg" },
  "Saudi Arabia": { group: "H", iso: "sa" }, "Uruguay": { group: "H", iso: "uy" }, "Iran": { group: "H", iso: "ir" }, "New Zealand": { group: "H", iso: "nz" },
  "France": { group: "I", iso: "fr" }, "Senegal": { group: "I", iso: "sn" }, "Iraq": { group: "I", iso: "iq" }, "Norway": { group: "I", iso: "no" },
  "Argentina": { group: "J", iso: "ar" }, "Algeria": { group: "J", iso: "dz" }, "Austria": { group: "J", iso: "at" }, "Jordan": { group: "J", iso: "jo" },
  "Portugal": { group: "K", iso: "pt" }, "Congo DR": { group: "K", iso: "cd" }, "Uzbekistan": { group: "K", iso: "uz" }, "Colombia": { group: "K", iso: "co" },
  "England": { group: "L", iso: "england" }, "Croatia": { group: "L", iso: "hr" }, "Ghana": { group: "L", iso: "gh" }, "Panama": { group: "L", iso: "pa" }
};

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
    for (const [team, iso, scored, conceded] of [
      [m.homeTeam, m.homeIso, m.homeScore, m.awayScore],
      [m.awayTeam, m.awayIso, m.awayScore, m.homeScore]
    ]) {
      const g = TEAM_MASTER_DATA[team]?.group;
      if (!team || !g) continue;
      if (!standings[g]) standings[g] = {};
      if (!standings[g][team]) standings[g][team] = { team, iso, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
      if (m.status === 'FINISHED') {
        const s = standings[g][team];
        s.played++;
        s.gf += scored ?? 0;
        s.ga += conceded ?? 0;
        s.gd = s.gf - s.ga;
        if (scored > conceded) { s.won++; s.pts += 3; }
        else if (scored === conceded) { s.drawn++; s.pts += 1; }
        else s.lost++;
      }
    }
  }
  const result = {};
  for (const [g, teams] of Object.entries(standings)) {
    result[g] = Object.values(teams).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
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
