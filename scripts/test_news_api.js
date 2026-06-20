// Throwaway probe script — fetches candidate ESPN news endpoints from a real
// network (GitHub Actions runner) and dumps raw responses to blueprint_data/
// for inspection, since this sandbox's outbound network is blocked by ESPN.
// Not part of the production pipeline; safe to delete once evaluated.

import { writeFile, mkdir } from 'fs/promises';

const OUT_DIR = 'blueprint_data/espn_news_probe';

// A few teams to test team-filtered shapes against (espnId from update_tracker.js)
const ARGENTINA_ID = 202;
const USA_ID = 660;

const CANDIDATES = [
  {
    name: 'site_v2_news_general',
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news',
  },
  {
    name: 'site_v2_news_limit10',
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=10',
  },
  {
    name: 'now_core_news_general',
    url: 'https://now.core.api.espn.com/v1/sports/news?sport=soccer&league=fifa.world&limit=5',
  },
  {
    name: 'now_core_news_team_argentina',
    url: `https://now.core.api.espn.com/v1/sports/news?sport=soccer&league=fifa.world&team=${ARGENTINA_ID}&limit=5`,
  },
  {
    name: 'now_core_news_team_usa',
    url: `https://now.core.api.espn.com/v1/sports/news?sport=soccer&league=fifa.world&team=${USA_ID}&limit=5`,
  },
  {
    name: 'site_v2_team_news_argentina',
    url: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${ARGENTINA_ID}/news`,
  },
];

async function probe(candidate) {
  const result = { url: candidate.url, fetchedAt: new Date().toISOString() };
  try {
    const res = await fetch(candidate.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
    result.status = res.status;
    result.ok = res.ok;
    const text = await res.text();
    try {
      result.body = JSON.parse(text);
    } catch {
      result.bodyText = text.slice(0, 2000);
    }
  } catch (err) {
    result.error = err.message;
  }
  return result;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const candidate of CANDIDATES) {
    console.log(`Probing ${candidate.name} -> ${candidate.url}`);
    const result = await probe(candidate);
    console.log(`  status=${result.status ?? 'ERR'} error=${result.error ?? 'none'}`);
    await writeFile(
      `${OUT_DIR}/${candidate.name}.json`,
      JSON.stringify(result, null, 2),
    );
  }
}

main();
