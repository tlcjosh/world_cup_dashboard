// Automatic forensic capture for extra-time transitions. We got caught out on
// 2026-07-01 (Belgium v Senegal): the live dashboard visibly stalled at 90'+8'
// for several minutes between the end of regulation and the start of extra
// time, and we had no record of what ESPN's status/period/clock actually said
// during that gap to debug it with -- scripts/debug_espn_dump.js is workflow_
// dispatch-only, and by the time anyone thought to run it the match had moved
// on. This runs unattended on a schedule instead, so the *next* match that
// heads to extra time leaves a paper trail automatically.
//
// Not part of the runtime data pipeline (see sync.yml/update_tracker.js for
// that) -- purely a debug/reference capture, same spirit as probe_feeds.js
// and debug_espn_dump.js, just automatic instead of manually triggered.
//
// Trigger conditions (checked against the live scoreboard endpoint only --
// no /summary fetch, no data.json cross-reference, unless a match matches):
//   - period >= 3 (already in extra time, or the shootout) -- can only ever
//     be true for a knockout match, since group matches never go past period 2.
//   - period === 2, tied score, clock >= 5400s (90:00) -- the ambiguous "did
//     regulation just end, and is this going to extra time?" gap itself. This
//     also fires for an ordinary group-stage match that happens to be level at
//     90', which normally just proceeds straight to full time -- that's fine,
//     it's a handful of harmless extra snapshots (and useful contrast data for
//     "what a non-ET tied finish looks like"), not worth the added complexity
//     of cross-referencing data.json to filter to knockout matches only.
// Each (event id, bucket) pair is rate-limited via a small state file so a
// long-running gap produces a time series (one snapshot per run while it
// persists) rather than either nothing or a duplicate every single tick.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'blueprint_data', 'et_snapshots');
const STATE_PATH = join(OUT_DIR, '.state.json');
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
// Just under the 5-minute cron cadence, so consecutive scheduled runs each
// capture a fresh snapshot instead of being suppressed by their own cooldown.
const COOLDOWN_MS = 4 * 60 * 1000;

function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}

// Bucket a competition's current status into a snapshot trigger, or null if
// nothing worth capturing right now. Period numbering per CLAUDE.md: 1/2 =
// regulation halves, 3/4 = extra-time halves, 5 = penalty shootout.
function triggerBucket(comp) {
  const period = comp.status?.period || 1;
  if (period >= 3) return `p${period}`;
  if (period === 2) {
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    const tied = home && away && home.score === away.score;
    const clockSec = comp.status?.clock || 0;
    if (tied && clockSec >= 5400) return 'p2-tied-90';
  }
  return null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const state = loadState();
  const now = Date.now();
  let wroteAny = false;

  const res = await fetch(SCOREBOARD_URL);
  if (!res.ok) throw new Error(`Scoreboard fetch failed: ${res.status}`);
  const data = await res.json();

  for (const event of data.events || []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const bucket = triggerBucket(comp);
    if (!bucket) continue;

    const key = `${event.id}:${bucket}`;
    if (now - (state[key] || 0) < COOLDOWN_MS) continue;
    state[key] = now;

    const ts = new Date(now).toISOString().replace(/[:.]/g, '-');
    const base = join(OUT_DIR, `${event.id}_${bucket}_${ts}`);
    writeFileSync(`${base}_scoreboard-event.json`, JSON.stringify(event, null, 2));
    wroteAny = true;
    console.log(`Snapshot captured: ${event.name} [${bucket}] -> ${base}_*.json`);

    try {
      const sres = await fetch(`${SUMMARY_URL}?event=${event.id}`);
      if (sres.ok) {
        const sdata = await sres.json();
        writeFileSync(`${base}_summary.json`, JSON.stringify(sdata, null, 2));
      } else {
        console.error(`Summary fetch failed for event ${event.id}: ${sres.status}`);
      }
    } catch (e) {
      console.error(`Summary fetch errored for event ${event.id}:`, e.message);
    }
  }

  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  if (!wroteAny) console.log('No extra-time transitions observed this run.');
  return wroteAny;
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
