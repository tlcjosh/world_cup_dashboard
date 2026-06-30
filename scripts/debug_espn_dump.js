// One-off debug harness: dumps raw ESPN soccer scoreboard/summary JSON for a match,
// filtered to the fields relevant to penalty-shootout handling (status, competitor
// score/winner, details[], notes[], headlines[]). Not part of the regular pipeline --
// run manually via the "Debug ESPN Dump" workflow_dispatch action when we need to see
// real ESPN data for an edge case (e.g. a match going to penalties) that we can't
// reproduce on demand.
//
// Usage: node scripts/debug_espn_dump.js "Netherlands" "Morocco"
// (team name args are substring-matched, case-insensitive, against ESPN's displayName)

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

function espnTodayDateRange() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const y = now.getUTCFullYear();
  const m = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  return `${y}${m}${d}`;
}

async function main() {
  const [teamA, teamB] = process.argv.slice(2);
  const dateStr = espnTodayDateRange();
  console.log(`Fetching scoreboard for date=${dateStr}...`);
  const res = await fetch(`${SCOREBOARD_URL}?dates=${dateStr}`);
  if (!res.ok) throw new Error(`Scoreboard fetch failed: ${res.status}`);
  const data = await res.json();
  const events = data.events || [];
  console.log(`Found ${events.length} events for today.`);

  let match = events.find(e => {
    const names = (e.competitions?.[0]?.competitors || []).map(c => c.team.displayName.toLowerCase());
    const wantA = teamA ? names.some(n => n.includes(teamA.toLowerCase())) : true;
    const wantB = teamB ? names.some(n => n.includes(teamB.toLowerCase())) : true;
    return wantA && wantB;
  });

  if (!match) {
    console.log('No matching event found. All events today:');
    for (const e of events) console.log(' -', e.name, '|', e.id);
    return;
  }

  console.log('\n=== MATCH FOUND ===');
  console.log('Event ID:', match.id, '| Name:', match.name);

  const comp = match.competitions[0];
  console.log('\n--- status ---');
  console.log(JSON.stringify(comp.status, null, 2));

  console.log('\n--- competitors (score/winner) ---');
  for (const c of comp.competitors) {
    console.log(JSON.stringify({
      team: c.team.displayName,
      homeAway: c.homeAway,
      score: c.score,
      winner: c.winner,
      // dump any key whose name hints at shootout/penalty so we don't miss an
      // unexpected field name
      shootoutLikeKeys: Object.keys(c).filter(k => /pen|shoot/i.test(k)),
    }, null, 2));
  }

  console.log('\n--- notes ---');
  console.log(JSON.stringify(comp.notes || [], null, 2));

  console.log('\n--- headlines ---');
  console.log(JSON.stringify(comp.headlines || [], null, 2));

  console.log('\n--- details[] (last 20, to catch shootout kicks) ---');
  const details = comp.details || [];
  console.log(`Total details: ${details.length}`);
  console.log(JSON.stringify(details.slice(-20), null, 2));

  // Now hit the summary endpoint for the richer boxscore/commentary view
  console.log('\n\n=== FETCHING /summary?event=' + match.id + ' ===');
  const sres = await fetch(`${SUMMARY_URL}?event=${match.id}`);
  if (!sres.ok) {
    console.log('Summary fetch failed:', sres.status);
    return;
  }
  const sdata = await sres.json();

  console.log('\n--- header.competitions[0].status ---');
  console.log(JSON.stringify(sdata.header?.competitions?.[0]?.status, null, 2));

  console.log('\n--- header.competitions[0].competitors (score/winner) ---');
  for (const c of (sdata.header?.competitions?.[0]?.competitors || [])) {
    console.log(JSON.stringify({
      team: c.team?.displayName,
      homeAway: c.homeAway,
      score: c.score,
      winner: c.winner,
      shootoutLikeKeys: Object.keys(c).filter(k => /pen|shoot/i.test(k)),
    }, null, 2));
  }

  console.log('\n--- header.competitions[0].details[] (last 20) ---');
  const sdetails = sdata.header?.competitions?.[0]?.details || [];
  console.log(`Total: ${sdetails.length}`);
  console.log(JSON.stringify(sdetails.slice(-20), null, 2));

  console.log('\n--- boxscore.teams[].statistics with pen/shoot in the name ---');
  for (const t of (sdata.boxscore?.teams || [])) {
    const stats = (t.statistics || []).filter(s => /pen|shoot/i.test(s.name || '') || /pen|shoot/i.test(s.displayName || ''));
    console.log(t.team?.displayName, JSON.stringify(stats, null, 2));
  }

  console.log('\n--- top-level sdata keys (to catch a dedicated shootout section) ---');
  console.log(Object.keys(sdata));
  const shootoutKey = Object.keys(sdata).find(k => /pen|shoot/i.test(k));
  if (shootoutKey) {
    console.log(`\n--- FOUND candidate key: ${shootoutKey} ---`);
    console.log(JSON.stringify(sdata[shootoutKey], null, 2));
  }

  console.log('\n--- commentary[] (last 15, may narrate shootout kicks) ---');
  const commentary = sdata.commentary || [];
  console.log(JSON.stringify(commentary.slice(0, 15), null, 2));
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
