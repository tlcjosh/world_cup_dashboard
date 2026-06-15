import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

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

// The CSV is the source of truth for all scores, matchIds, and statuses.
// No overrides needed — the CSV data is correct and complete.
const KNOWN_MATCHES = {};

const STAGE_MAP = {
  "Group": "Group Stage",
  "Round of 32": "Round of 32",
  "Round of 16": "Round of 16",
  "Quarterfinals": "Quarterfinals",
  "Semifinals": "Semifinals",
  "Third Place": "Third Place",
  "Final": "Final"
};

function stripEmoji(str) {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E\xC0-\xFF]/g, '').trim();
}

function parsePDTtoUTC(dateStr) {
  if (!dateStr) return null;
  // Format: "Thursday, June 11, at 12:00 PM"
  const match = dateStr.match(/(\w+),\s+(\w+)\s+(\d+),\s+at\s+(\d+):(\d+)\s+(AM|PM)/i);
  if (!match) return null;
  const [, , month, day, hourStr, minStr, ampm] = match;
  let hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  // PDT = UTC-7, so add 7 hours
  const utcHour = hour + 7;
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthIdx = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
  if (monthIdx === -1) return null;
  const d = new Date(Date.UTC(2026, monthIdx, parseInt(day, 10), utcHour, min, 0));
  return d.toISOString();
}

function parseFirstHalfStart(val) {
  if (!val) return null;
  // Format: "6/15/2026 9:00:00" — treat as PDT, convert to UTC
  const match = val.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/);
  if (!match) return null;
  const [, mo, da, yr, hr, mn, sc] = match.map(Number);
  // PDT +7
  const d = new Date(Date.UTC(yr, mo - 1, da, hr + 7, mn, sc));
  return d.toISOString();
}

function computeStandings(matches) {
  const standings = {};
  for (const m of matches) {
    if (!m.group || m.stage !== 'Group Stage') continue;
    const g = m.group;
    if (!standings[g]) standings[g] = {};
    const pairs = [
      [m.homeTeam, m.homeIso, m.homeScore, m.awayScore],
      [m.awayTeam, m.awayIso, m.awayScore, m.homeScore]
    ];
    for (const [team, iso, scored, conceded] of pairs) {
      if (!team) continue;
      if (!standings[g][team]) {
        standings[g][team] = { team, iso, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
      }
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
    result[g] = Object.values(teams).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
    );
  }
  return result;
}

// Read schedule CSV
const schedulePath = join(ROOT, 'blueprint_data', 'schedule_sheet.csv.csv');
const scheduleRaw = readFileSync(schedulePath, 'utf8');
const scheduleRows = parse(scheduleRaw, { skip_empty_lines: true });
// scheduleRows[0] is header: Stage, Date & Time, Team 1, Score 1, Score 2, Team 2, Match #, Location, Match ID, Status, First Half Start, Second Half Start
// Skip header row (index 0)

const matches = [];

for (let i = 1; i < scheduleRows.length; i++) {
  const row = scheduleRows[i];
  const [stageCsv, dateStr, team1Raw, score1Raw, score2Raw, team2Raw, matchNumRaw, location, matchIdCsv, statusCsv, firstHalfRaw, secondHalfRaw] = row;

  const matchNum = parseInt(matchNumRaw, 10);
  const stage = STAGE_MAP[stageCsv?.trim()] || stageCsv?.trim() || '';

  const homeTeamClean = stripEmoji(team1Raw);
  const awayTeamClean = stripEmoji(team2Raw);

  const homeMeta = TEAM_MASTER_DATA[homeTeamClean] || {};
  const awayMeta = TEAM_MASTER_DATA[awayTeamClean] || {};

  // Only group-stage matches have group info from teams
  const group = stage === 'Group Stage' ? (homeMeta.group || null) : null;

  // Determine kickoff from CSV (PDT->UTC)
  let kickoff = parsePDTtoUTC(dateStr);
  let firstHalfStart = parseFirstHalfStart(firstHalfRaw);
  let secondHalfStart = parseFirstHalfStart(secondHalfRaw);

  // Determine status
  let status = 'SCHEDULED';
  const csvStatus = statusCsv?.trim();
  if (csvStatus === 'FINISHED') status = 'FINISHED';
  else if (csvStatus === 'TIMED') status = 'SCHEDULED';
  else if (csvStatus === 'IN_PLAY') status = 'IN_PLAY';
  else if (csvStatus === 'PAUSED') status = 'PAUSED';

  // Determine scores
  let homeScore = score1Raw !== '' && score1Raw !== undefined ? parseInt(score1Raw, 10) : null;
  let awayScore = score2Raw !== '' && score2Raw !== undefined ? parseInt(score2Raw, 10) : null;
  if (isNaN(homeScore)) homeScore = null;
  if (isNaN(awayScore)) awayScore = null;

  let matchId = matchIdCsv ? parseInt(matchIdCsv, 10) : null;
  if (isNaN(matchId)) matchId = null;

  // Apply known match overrides
  if (KNOWN_MATCHES[matchNum]) {
    const known = KNOWN_MATCHES[matchNum];
    matchId = known.matchId ?? matchId;
    homeScore = known.homeScore !== undefined ? known.homeScore : homeScore;
    awayScore = known.awayScore !== undefined ? known.awayScore : awayScore;
    status = known.status ?? status;
    kickoff = known.kickoff ?? kickoff;
    firstHalfStart = known.firstHalfStart !== undefined ? known.firstHalfStart : firstHalfStart;
    secondHalfStart = known.secondHalfStart !== undefined ? known.secondHalfStart : secondHalfStart;
  }

  const matchObj = {
    matchId,
    matchNum,
    stage,
    group,
    homeTeam: homeTeamClean || team1Raw,
    homeIso: homeMeta.iso || null,
    awayTeam: awayTeamClean || team2Raw,
    awayIso: awayMeta.iso || null,
    venue: location?.trim() || null,
    kickoff,
    homeScore,
    awayScore,
    status,
    firstHalfStart,
    secondHalfStart
  };

  matches.push(matchObj);
}

// Sort matches by matchNum
matches.sort((a, b) => a.matchNum - b.matchNum);

// Compute standings
const standings = computeStandings(matches);

const dataOut = {
  lastUpdated: new Date().toISOString(),
  matches,
  standings
};

// Read combinations CSV
const combPath = join(ROOT, 'blueprint_data', 'third_place_combinations_sheet.csv');
const combRaw = readFileSync(combPath, 'utf8');
const combRows = parse(combRaw, { skip_empty_lines: true });

// Header row is row 0. Data rows from row 1.
// Columns (0-indexed):
// 0: No.
// 1: B (group B third place)
// 2: C
// 3: D
// 4: E
// 5: F
// 6: G
// 7: H
// 8: I
// 9: J
// 10: K
// 11: L
// 12: (blank separator)
// 13: 1A vs (3X)
// 14: 1B vs (3X)
// 15: 1D vs (3X)
// 16: 1E vs (3X)
// 17: 1G vs (3X)
// 18: 1I vs (3X)
// 19: 1K vs (3X)
// 20: 1L vs (3X)
// 21: Combination String

const combinations = {};

for (let i = 1; i < combRows.length; i++) {
  const row = combRows[i];
  const combinationStr = row[21]?.trim();
  if (!combinationStr) continue;

  combinations[combinationStr] = {
    "1A": row[13]?.trim() || null,
    "1B": row[14]?.trim() || null,
    "1D": row[15]?.trim() || null,
    "1E": row[16]?.trim() || null,
    "1G": row[17]?.trim() || null,
    "1I": row[18]?.trim() || null,
    "1K": row[19]?.trim() || null,
    "1L": row[20]?.trim() || null,
  };
}

// Write outputs
const dataDir = join(ROOT, 'src', 'data');
mkdirSync(dataDir, { recursive: true });

writeFileSync(join(dataDir, 'data.json'), JSON.stringify(dataOut, null, 2));
writeFileSync(join(dataDir, 'combinations.json'), JSON.stringify(combinations, null, 2));

console.log(`Bootstrap complete. ${matches.length} matches parsed.`);
console.log(`${Object.keys(combinations).length} third-place combinations loaded.`);
console.log(`Standings computed for groups: ${Object.keys(standings).join(', ')}`);
