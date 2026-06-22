// One-off diagnostic: fetches candidate RSS/news feeds and saves the raw
// response (plus a status summary) into blueprint_data/feed_probes/, so a
// later session can inspect real XML shapes without needing live network
// access (the sandboxed dev environment's egress allowlist blocks most of
// these hosts; GitHub Actions runners have unrestricted network).
// Run manually via the "Probe News Feeds" workflow_dispatch workflow.
// Not part of the runtime data pipeline — update_tracker.js's RSS_FEEDS is
// the actual production list.
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'blueprint_data', 'feed_probes');

const FEEDS = [
  { name: 'fox-sports', url: 'https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30&tags=fs%2Fsoccer%2Csoccer%2Fepl%2Fleague%2F1%2Csoccer%2Fmls%2Fleague%2F5%2Csoccer%2Fucl%2Fleague%2F7%2Csoccer%2Feuropa%2Fleague%2F8%2Csoccer%2Fwc%2Fleague%2F12%2Csoccer%2Feuro%2Fleague%2F13%2Csoccer%2Fwwc%2Fleague%2F14%2Csoccer%2Fnwsl%2Fleague%2F20%2Csoccer%2Fcwc%2Fleague%2F26%2Csoccer%2Fgold_cup%2Fleague%2F32%2Csoccer%2Funl%2Fleague%2F67' },
  { name: 'nytimes-soccer', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Soccer.xml' },
  { name: 'cbssports-soccer', url: 'https://www.cbssports.com/rss/headlines/soccer/' },
  // Already-working production sources, included for comparison.
  { name: 'bbc-football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'guardian-football', url: 'https://www.theguardian.com/football/rss' },
  // Other US-reachable candidates worth checking.
  { name: 'sportingnews-soccer', url: 'https://www.sportingnews.com/us/soccer/rss' },
  { name: 'skysports-football', url: 'https://www.skysports.com/rss/12040' },
  { name: 'yahoo-soccer', url: 'https://sports.yahoo.com/soccer/rss/' },
  { name: 'espn-soccer', url: 'https://www.espn.com/espn/rss/soccer/news' },
];

async function probe(feed) {
  const result = { name: feed.name, url: feed.url, status: null, ok: false, bytes: 0, error: null, itemCount: null };
  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WC2026DashboardBot/1.0)' } });
    result.status = res.status;
    result.ok = res.ok;
    if (res.ok) {
      const text = await res.text();
      result.bytes = text.length;
      result.itemCount = (text.match(/<item>/g) || []).length || (text.match(/<entry>/g) || []).length;
      writeFileSync(join(OUT_DIR, `${feed.name}.xml`), text);
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = await Promise.all(FEEDS.map(probe));
  writeFileSync(join(OUT_DIR, '_summary.json'), JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main();
