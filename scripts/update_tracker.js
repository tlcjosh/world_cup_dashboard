import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '..', 'src', 'data', 'data.json');

function cleanName(name) {
  if (!name) return "";
  return name.toString().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/gi, '').trim().toLowerCase();
}

function computeStandings(matches) {
  const standings = {};
  for (const m of matches) {
    if (!m.group || m.stage !== 'Group Stage') continue;
    const g = m.group;
    if (!standings[g]) standings[g] = {};
    for (const [team, iso, scored, conceded] of [
      [m.homeTeam, m.homeIso, m.homeScore, m.awayScore],
      [m.awayTeam, m.awayIso, m.awayScore, m.homeScore]
    ]) {
      if (!team) continue;
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

async function main() {
  const token = process.env.FD_API_TOKEN;
  if (!token) {
    console.log('No FD_API_TOKEN set, skipping API fetch');
    return;
  }

  const current = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const headers = { 'X-Auth-Token': token };

  const [matchesRes] = await Promise.all([
    fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026', { headers }),
  ]);

  if (!matchesRes.ok) { console.error('Matches API error:', matchesRes.status); return; }

  const apiData = await matchesRes.json();
  const apiMatches = apiData.matches || [];

  const now = new Date().toISOString();

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
    }
    if (!apiMatch) continue;

    const apiStatus = apiMatch.status;
    const prevStatus = ourMatch.status;

    // Map API status to our status
    let newStatus = ourMatch.status;
    if (apiStatus === 'FINISHED') newStatus = 'FINISHED';
    else if (apiStatus === 'IN_PLAY') newStatus = 'IN_PLAY';
    else if (apiStatus === 'PAUSED') newStatus = 'PAUSED';
    else if (apiStatus === 'TIMED' || apiStatus === 'SCHEDULED') newStatus = 'SCHEDULED';

    ourMatch.status = newStatus;

    // Scores
    const score = apiMatch.score;
    if (score && score.fullTime && newStatus === 'FINISHED') {
      ourMatch.homeScore = score.fullTime.home;
      ourMatch.awayScore = score.fullTime.away;
    }
    if (score && score.halfTime && newStatus === 'PAUSED') {
      if (score.halfTime.home !== null) {
        ourMatch.homeScore = score.halfTime.home;
        ourMatch.awayScore = score.halfTime.away;
      }
    }
    if (newStatus === 'IN_PLAY') {
      // Use current period score if available, otherwise fullTime running total
      if (score && score.fullTime && score.fullTime.home !== null) {
        ourMatch.homeScore = score.fullTime.home;
        ourMatch.awayScore = score.fullTime.away;
      }
    }

    // Half times
    if (newStatus === 'IN_PLAY' && prevStatus === 'SCHEDULED' && !ourMatch.firstHalfStart) {
      ourMatch.firstHalfStart = now;
    }
    if (newStatus === 'IN_PLAY' && prevStatus === 'PAUSED' && !ourMatch.secondHalfStart) {
      ourMatch.secondHalfStart = now;
    }
  }

  // Recompute standings
  current.standings = computeStandings(current.matches);
  current.lastUpdated = now;

  const newJson = JSON.stringify(current, null, 2);
  const oldJson = readFileSync(DATA_PATH, 'utf8');

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
