// ===== STATE =====
const state = {
  matches: [],
  standings: {},
  combinations: {},
  liveMode: false,
  currentView: 'dashboard',
  teamFilter: null,
  lastUpdated: null,
  tickInterval: null,
  syncInterval: null,
  espnInterval: null,
  espnSynced: false,
};

// ===== TEAM DATA =====
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

// Maps 3rd-place slot code → which 1st-place group runner they face
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

// ===== ESPN INTEGRATION =====

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// ESPN display name → our TEAM_MASTER_DATA key (add entries as mismatches are discovered)
const ESPN_NAME_MAP = {
  'Cape Verde': 'Cape Verde Islands',
  'Bosnia & Herzegovina': 'Bosnia-Herzegovina',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'DR Congo': 'Congo DR',
  'Republic of Congo': 'Congo DR',
  'Czech Republic': 'Czechia',
  'Korea Republic': 'South Korea',
  'USA': 'United States',
  'Curacao': 'Curaçao',
};

// ESPN status name → our status values
const ESPN_STATUS_MAP = {
  'STATUS_SCHEDULED':  'SCHEDULED',
  'STATUS_FIRST_HALF': 'IN_PLAY',
  'STATUS_SECOND_HALF':'IN_PLAY',
  'STATUS_HALFTIME':   'PAUSED',
  'STATUS_FULL_TIME':  'FINISHED',
  'STATUS_FINAL_AET':  'FINISHED',
  'STATUS_FINAL_PEN':  'FINISHED',
  'STATUS_SUSPENDED':  'PAUSED',
  'STATUS_DELAYED':    'SCHEDULED',
  'STATUS_POSTPONED':  'SCHEDULED',
};

function normalizeESPNName(name) {
  return ESPN_NAME_MAP[name] || name;
}

function mapESPNStatus(typeName, typeState) {
  if (ESPN_STATUS_MAP[typeName]) return ESPN_STATUS_MAP[typeName];
  if (typeState === 'in')   return 'IN_PLAY';
  if (typeState === 'post') return 'FINISHED';
  return 'SCHEDULED';
}

async function fetchESPN() {
  try {
    const res = await fetch(ESPN_SCOREBOARD_URL + '?_=' + Date.now());
    if (!res.ok) throw new Error('ESPN ' + res.status);
    const data = await res.json();
    mergeESPNData(data.events || []);
  } catch (e) {
    console.warn('ESPN sync failed, using data.json:', e.message);
  }
}

function mergeESPNData(espnEvents) {
  let changed = false;

  for (const event of espnEvents) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const espnHome = normalizeESPNName(homeComp.team.displayName);
    const espnAway = normalizeESPNName(awayComp.team.displayName);
    const newStatus = mapESPNStatus(comp.status.type.name, comp.status.type.state);

    // Match by team names; handle cross-group where our home/away may be swapped
    const match = state.matches.find(m =>
      (m.homeTeam === espnHome && m.awayTeam === espnAway) ||
      (m.homeTeam === espnAway && m.awayTeam === espnHome)
    );
    if (!match) continue;

    const swapped = match.homeTeam === espnAway;
    const rawHome = parseInt(homeComp.score, 10);
    const rawAway = parseInt(awayComp.score, 10);
    const newHomeScore = newStatus !== 'SCHEDULED' ? (swapped ? rawAway : rawHome) : null;
    const newAwayScore = newStatus !== 'SCHEDULED' ? (swapped ? rawHome : rawAway) : null;

    if (match.status !== newStatus || match.homeScore !== newHomeScore || match.awayScore !== newAwayScore) {
      changed = true;
    }

    match.status    = newStatus;
    match.homeScore = newHomeScore;
    match.awayScore = newAwayScore;

    // ESPN clock: total elapsed seconds from kickoff (capped at 45*60 or 90*60 by ESPN)
    match._espnClock     = comp.status.clock || 0;
    match._espnPeriod    = comp.status.period || 1;
    match._espnFetchedAt = Date.now();

    // Goal events for scorer display
    const homeId = homeComp.team.id;
    const matchEvents = { home: [], away: [] };
    for (const d of (comp.details || [])) {
      if (!d.scoreValue || d.scoreValue < 1) continue;
      const player = d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || '';
      const time   = d.clock?.displayValue || '';
      const suffix = d.ownGoal ? ' (og)' : d.penaltyKick ? ' (pen)' : '';
      const label  = ([player, time].filter(Boolean).join(' ') + suffix).trim();
      if (label) matchEvents[d.team?.id === homeId ? 'home' : 'away'].push(label);
    }
    if (swapped) [matchEvents.home, matchEvents.away] = [matchEvents.away, matchEvents.home];
    match._espnEvents = matchEvents;

    // Team stats for live stats strip
    const hStats = {};
    for (const s of (homeComp.statistics || [])) hStats[s.name] = s.value ?? null;
    const aStats = {};
    for (const s of (awayComp.statistics || [])) aStats[s.name] = s.value ?? null;
    match._espnStats = swapped ? { home: aStats, away: hStats } : { home: hStats, away: aStats };
  }

  state.lastUpdated = new Date().toISOString();
  state.espnSynced  = true;

  const syncEl = document.getElementById('last-sync');
  if (syncEl) syncEl.textContent = 'just now (ESPN)';

  const header = document.getElementById('app-header');
  if (header) {
    header.classList.remove('sync-flash');
    void header.offsetWidth;
    header.classList.add('sync-flash');
    setTimeout(() => header.classList.remove('sync-flash'), 500);
  }

  if (changed) renderView();
}

// ===== HELPERS =====

function flagImg(iso, name) {
  if (!iso) return '';
  let src = iso;
  if (iso === 'england') src = 'gb-eng';
  else if (iso === 'scotland') src = 'gb-sct';
  return `<img src="https://flagcdn.com/24x18/${src}.png" alt="${name || iso}" class="flag" onerror="this.style.display='none'">`;
}

function formatKickoff(isoStr) {
  if (!isoStr) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(isoStr));
  } catch (e) {
    return isoStr;
  }
}

function formatLastSync(isoStr) {
  if (!isoStr) return 'Never';
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 30) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function getMatchMinute(match) {
  if (match.status === 'PAUSED') return 'HT';
  if (match.status !== 'IN_PLAY') return null;

  // ESPN clock: total elapsed seconds from kickoff, ticked forward since last fetch
  if (match._espnClock !== undefined && match._espnFetchedAt) {
    const elapsedSec = match._espnClock + (Date.now() - match._espnFetchedAt) / 1000;
    const min = Math.floor(elapsedSec / 60);
    if (match._espnPeriod === 1) {
      if (min > 45) return `45+${min - 45}'`;
      return `${Math.max(1, min)}'`;
    } else {
      if (min > 90) return `90+${min - 90}'`;
      return `${Math.max(46, min)}'`;
    }
  }

  // Fallback: compute from firstHalfStart/secondHalfStart timestamps
  const now = Date.now();
  if (match.secondHalfStart) {
    const elapsed = Math.floor((now - new Date(match.secondHalfStart).getTime()) / 60000) + 1;
    const min = 45 + elapsed;
    if (elapsed > 45) return `90+${elapsed - 45}'`;
    return `${Math.min(min, 90)}'`;
  }
  if (match.firstHalfStart) {
    const elapsed = Math.floor((now - new Date(match.firstHalfStart).getTime()) / 60000) + 1;
    if (elapsed > 45) return `45+${elapsed - 45}'`;
    return `${Math.min(elapsed, 45)}'`;
  }
  return '1\'';
}

function computeStandings(matches, includeStatuses = ['FINISHED']) {
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
      if (!standings[g][team]) {
        standings[g][team] = { team, iso, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
      }
      if (includeStatuses.includes(m.status)) {
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

function computeThirdPlaceRankings(standings) {
  const thirds = [];
  for (const [grp, teams] of Object.entries(standings)) {
    if (teams.length >= 3) {
      thirds.push({ ...teams[2], groupLetter: grp });
    }
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
  return thirds;
}

function getThirdPlaceCombinationString(topEight) {
  // topEight is array of group letters (up to 8)
  const letters = topEight.map(t => t.groupLetter || t).sort();
  return letters.join('');
}

function resolveTeam(placeholder, computedStandings, computedThirdPlace, combinationString) {
  if (!placeholder) return { name: 'TBD', iso: null };
  const m = placeholder.match(/^\[(.+)\]$/);
  if (!m) return { name: placeholder, iso: null };
  const code = m[1];

  // [1A], [2B], etc. — group position
  const posMatch = code.match(/^([1-4])([A-L])$/);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10) - 1;
    const grp = posMatch[2];
    const grpStandings = computedStandings[grp];
    if (grpStandings && grpStandings[pos]) {
      const t = grpStandings[pos];
      return { name: t.team, iso: t.iso };
    }
    return { name: `${pos + 1}${grp}`, iso: null };
  }

  // [3ABCDF] — third place slot
  const thirdMatch = code.match(/^3([A-L]+)$/);
  if (thirdMatch) {
    // Find which top-8 combination we have
    if (combinationString && state.combinations[combinationString]) {
      const combEntry = state.combinations[combinationString];
      // Find the slot opponent key for this code
      const opponentKey = SLOT_TO_OPPONENT[code];
      if (opponentKey) {
        const teamCode = combEntry[opponentKey]; // e.g. "3E"
        if (teamCode) {
          const grpLetter = teamCode.replace('3', '');
          const grpStandings = computedStandings[grpLetter];
          if (grpStandings && grpStandings[2]) {
            const t = grpStandings[2];
            return { name: t.team, iso: t.iso };
          }
        }
      }
    }
    return { name: `3rd (${thirdMatch[1]})`, iso: null };
  }

  // [W73], [L101] — winners/losers of match by matchNum
  const wlMatch = code.match(/^([WL])(\d+)$/);
  if (wlMatch) {
    const isWinner = wlMatch[1] === 'W';
    const refNum = parseInt(wlMatch[2], 10);
    const refMatch = state.matches.find(mm => mm.matchNum === refNum);
    if (refMatch && refMatch.status === 'FINISHED') {
      let winnerTeam, loserTeam, winnerIso, loserIso;
      if (refMatch.homeScore > refMatch.awayScore) {
        winnerTeam = refMatch.homeTeam; winnerIso = refMatch.homeIso;
        loserTeam = refMatch.awayTeam; loserIso = refMatch.awayIso;
      } else if (refMatch.awayScore > refMatch.homeScore) {
        winnerTeam = refMatch.awayTeam; winnerIso = refMatch.awayIso;
        loserTeam = refMatch.homeTeam; loserIso = refMatch.homeIso;
      } else {
        return { name: `${code}`, iso: null };
      }
      return isWinner
        ? { name: winnerTeam, iso: winnerIso }
        : { name: loserTeam, iso: loserIso };
    }
    return { name: `${isWinner ? 'W' : 'L'} M${refNum}`, iso: null };
  }

  return { name: code, iso: null };
}

function statusBadge(match) {
  if (match.status === 'IN_PLAY') {
    return `<span class="badge badge-live">LIVE</span>`;
  }
  if (match.status === 'PAUSED') {
    return `<span class="badge badge-ht">HT</span>`;
  }
  if (match.status === 'FINISHED') {
    return `<span class="badge badge-ft">FT</span>`;
  }
  return `<span class="badge badge-soon">${match.kickoff ? formatKickoff(match.kickoff) : 'TBD'}</span>`;
}

function espnEventsHtml(match) {
  const ev = match._espnEvents;
  if (!ev || (!ev.home.length && !ev.away.length)) return '';
  const homeHtml = ev.home.map(g => `<span class="goal-event">⚽ ${g}</span>`).join('');
  const awayHtml = ev.away.map(g => `<span class="goal-event">${g} ⚽</span>`).join('');
  return `<div class="match-events"><div class="me-home">${homeHtml}</div><div class="me-away">${awayHtml}</div></div>`;
}

function espnStatsHtml(match) {
  if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') return '';
  const s = match._espnStats;
  if (!s) return '';
  const h = s.home || {};
  const a = s.away || {};
  const poss = h.possessionPct ?? h.possession ?? null;
  if (poss === null && h.totalShots === undefined && h.shots === undefined) return '';

  const possH = poss !== null ? Math.round(poss) : 50;
  const possA = 100 - possH;

  const rows = [];
  const sh = h.totalShots ?? h.shots, sa = a.totalShots ?? a.shots;
  if (sh != null && sa != null) rows.push([sh, 'Shots', sa]);
  const oh = h.shotsOnTarget, oa = a.shotsOnTarget;
  if (oh != null && oa != null) rows.push([oh, 'On target', oa]);
  const ch = h.cornerKicks ?? h.corners, ca = a.cornerKicks ?? a.corners;
  if (ch != null && ca != null) rows.push([ch, 'Corners', ca]);
  const yh = h.yellowCards, ya = a.yellowCards;
  if (yh != null && ya != null) rows.push([
    `<span class="ycard">${yh}</span>`, 'Yellows', `<span class="ycard">${ya}</span>`
  ]);

  return `<div class="match-stats">
    <div class="stats-poss">
      <span class="stats-poss-h">${possH}%</span>
      <div class="stats-poss-bar"><div class="stats-poss-fill" style="width:${possH}%"></div></div>
      <span class="stats-poss-a">${possA}%</span>
      <span class="stats-poss-lbl">Possession</span>
    </div>${rows.length ? `<div class="stats-grid">${rows.map(([hv, l, av]) =>
      `<span class="sg-h">${hv}</span><span class="sg-l">${l}</span><span class="sg-a">${av}</span>`
    ).join('')}</div>` : ''}
  </div>`;
}

function matchCardHtml(match, extraLabel) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const hasScore = isLive || match.status === 'FINISHED';
  const hs = hasScore && match.homeScore !== null && match.homeScore !== undefined ? match.homeScore : null;
  const as = hasScore && match.awayScore !== null && match.awayScore !== undefined ? match.awayScore : null;
  const homeWon = hs !== null && as !== null && hs > as;
  const awayWon = hs !== null && as !== null && as > hs;
  const homeClass = homeWon ? 'winner' : awayWon ? 'loser' : '';
  const awayClass = awayWon ? 'winner' : homeWon ? 'loser' : '';

  const scoreHtml = hasScore
    ? `<div class="score">${hs !== null ? hs : '-'} – ${as !== null ? as : '-'}</div>`
    : `<div class="score vs">vs</div>`;

  let scoreSubHtml = '';
  if (match.status === 'IN_PLAY') {
    const minute = getMatchMinute(match);
    scoreSubHtml = `<div class="score-sub live match-clock" data-matchnum="${match.matchNum}">${minute || '1\''}</div>`;
  } else if (match.status === 'PAUSED') {
    scoreSubHtml = `<div class="score-sub live match-clock">HT</div>`;
  }

  const venueText = match.venue || '';
  const labelHtml = extraLabel ? `<span class="badge badge-soon" style="font-size:11px;">${extraLabel}</span>` : '';

  return `
    <div class="match-card ${isLive ? 'live' : ''}">
      <div class="match-top">
        <div class="match-inner">
          <div class="match-home">
            <span class="team-name ${homeClass}">${match.homeTeam || 'TBD'}</span>
            ${flagImg(match.homeIso, match.homeTeam)}
          </div>
          <div class="score-col">
            ${scoreHtml}
            ${scoreSubHtml}
          </div>
          <div class="match-away">
            ${flagImg(match.awayIso, match.awayTeam)}
            <span class="team-name ${awayClass}">${match.awayTeam || 'TBD'}</span>
          </div>
        </div>
        <div class="match-status">
          ${statusBadge(match)}
          ${labelHtml}
          ${venueText ? `<div class="venue">${venueText}</div>` : ''}
        </div>
      </div>
      ${hasScore ? espnEventsHtml(match) : ''}
      ${espnStatsHtml(match)}
    </div>
  `;
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  const liveMatches = state.matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const todayMatches = getTodayMatches();
  const upNext = state.matches.filter(m => m.status === 'SCHEDULED').slice(0, 5);

  // Team filter logic
  let filteredMatches = null;
  if (state.teamFilter) {
    filteredMatches = state.matches.filter(m =>
      m.homeTeam === state.teamFilter || m.awayTeam === state.teamFilter
    );
  }

  const teamNames = Object.keys(TEAM_MASTER_DATA).sort();
  const datalistHtml = `<datalist id="team-datalist">${teamNames.map(t => `<option value="${t}">`).join('')}</datalist>`;

  if (state.teamFilter && filteredMatches) {
    const meta = TEAM_MASTER_DATA[state.teamFilter];
    const html = `
      <div class="search-container">
        <input list="team-datalist" id="team-search" class="search-input" placeholder="Search team..." value="${state.teamFilter || ''}">
        ${datalistHtml}
      </div>
      <div class="card">
        <div class="card-title">
          ${meta ? flagImg(meta.iso, state.teamFilter) : ''}
          ${state.teamFilter}
          ${meta ? `<span class="group-label">Group ${meta.group}</span>` : ''}
        </div>
        ${filteredMatches.length ? filteredMatches.map(matchCardHtml).join('') : '<div class="empty-state">No matches found.</div>'}
      </div>
    `;
    el.innerHTML = html;
  } else {
    // Hero stats
    const totalMatches = state.matches.length;
    const liveCount = liveMatches.length;
    const todayCount = todayMatches.length;

    // Determine tournament day / stage eyebrow
    const finishedCount = state.matches.filter(m => m.status === 'FINISHED').length;
    const groupStageMatches = state.matches.filter(m => m.stage === 'Group Stage');
    const inKnockout = state.matches.some(m => m.stage !== 'Group Stage' && (m.status === 'FINISHED' || m.status === 'IN_PLAY'));
    const stageName = inKnockout ? 'Knockout Stage' : 'Group Stage';
    const matchDay = groupStageMatches.length ? Math.ceil((finishedCount + liveCount) / Math.max(1, Math.round(groupStageMatches.length / 18))) : 1;
    const eyebrow = `${stageName} · Day ${Math.max(1, matchDay)}`;

    // Live & Today card — union of live + today's remaining
    const todayNonLive = todayMatches.filter(m => m.status !== 'IN_PLAY' && m.status !== 'PAUSED');
    const liveAndToday = [...liveMatches, ...todayNonLive];
    const liveAndTodayMeta = liveCount > 0
      ? `${liveCount} in play · ${todayNonLive.filter(m => m.status === 'SCHEDULED').length} upcoming`
      : `${todayMatches.length} today`;

    // Dynamic live standings: show group of the first live match; fall back to most-played group
    const liveGroup = (() => {
      if (liveMatches.length) {
        const m = liveMatches[0];
        return TEAM_MASTER_DATA[m.homeTeam]?.group || TEAM_MASTER_DATA[m.awayTeam]?.group || null;
      }
      // Fall back to group with most matches played
      const counts = {};
      for (const m of state.matches) {
        if (m.status === 'FINISHED' && m.stage === 'Group Stage') {
          const g = TEAM_MASTER_DATA[m.homeTeam]?.group;
          if (g) counts[g] = (counts[g] || 0) + 1;
        }
      }
      const entries = Object.entries(counts);
      if (!entries.length) return 'A';
      return entries.sort((a, b) => b[1] - a[1])[0][0];
    })();

    // Dashboard standings: always live when matches are in play, regardless of global toggle
    const dashLive = liveMatches.length > 0 || state.liveMode;
    const dashStatuses = dashLive ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
    const computedStandings = dashLive ? computeStandings(state.matches, dashStatuses) : state.standings;
    const groupTeams = liveGroup ? (computedStandings[liveGroup] || []) : [];
    const standingsMetaLabel = liveMatches.length
      ? '<span class="badge badge-live" style="font-size:10px;padding:2px 8px;animation:blink 1.6s infinite;">LIVE</span> Live group'
      : 'Most played group';

    const standingsHtml = `
      <div class="card-header">
        <div class="card-title">Group Standings</div>
        <div class="card-meta">${standingsMetaLabel}</div>
      </div>
      <div class="group-header">
        <div class="group-pill">${liveGroup}</div>
        <div class="group-name">Group ${liveGroup}</div>
      </div>
      <table class="condensed">
        <thead>
          <tr>
            <th colspan="2">Team</th>
            <th class="num">P</th>
            <th class="num">GD</th>
            <th class="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${groupTeams.map((t, i) => {
            const rowClass = i === 0 ? 'q1' : i === 1 ? 'q2' : i === 2 ? 'q3' : '';
            return `<tr class="${rowClass}">
              <td><span class="pos">${i + 1}</span></td>
              <td><div class="team-cell">${flagImg(t.iso, t.team)}<span>${t.team}</span></div></td>
              <td class="num">${t.played}</td>
              <td class="num">${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
              <td class="num" style="font-weight:700">${t.pts}</td>
            </tr>`;
          }).join('')}
          ${groupTeams.length === 0 ? `<tr><td colspan="5" class="empty-state">No matches played</td></tr>` : ''}
        </tbody>
      </table>
      <div class="qualify-legend">
        <span><span class="swatch" style="background:var(--green)"></span> Advance</span>
        <span><span class="swatch" style="background:var(--amber)"></span> 3rd wildcard</span>
      </div>
    `;

    const html = `
      <div class="search-container">
        <input list="team-datalist" id="team-search" class="search-input" placeholder="Search team..." value="">
        ${datalistHtml}
      </div>
      <div class="page-hero">
        <div>
          <div class="hero-eyebrow">${eyebrow}</div>
          <div class="hero-title">FIFA World Cup 2026</div>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-num">${liveCount}</div>
            <div class="hero-stat-label">Live now</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">${todayCount}</div>
            <div class="hero-stat-label">Today</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">${totalMatches}</div>
            <div class="hero-stat-label">Total matches</div>
          </div>
        </div>
      </div>

      <div class="card" style="grid-column:1/-1; margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${liveCount > 0 ? '🔴 Live &amp; Today' : 'Today\'s Matches'}</div>
          <div class="card-meta">${liveAndTodayMeta}</div>
        </div>
        ${liveAndToday.length ? liveAndToday.map(m => matchCardHtml(m)).join('') : '<div class="empty-state">No matches today.</div>'}
      </div>

      <div class="dashboard-grid">
        <div class="card">${standingsHtml}</div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Up Next</div>
            <div class="card-meta">Upcoming</div>
          </div>
          ${upNext.length ? upNext.map(m => matchCardHtml(m)).join('') : '<div class="empty-state">No upcoming matches.</div>'}
        </div>
      </div>
    `;
    el.innerHTML = html;
  }

  // Bind team search
  const searchEl = document.getElementById('team-search');
  if (searchEl) {
    searchEl.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (TEAM_MASTER_DATA[val]) {
        state.teamFilter = val;
      } else if (!val) {
        state.teamFilter = null;
      }
      renderDashboard();
    });
    searchEl.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val) {
        state.teamFilter = null;
        renderDashboard();
      }
    });
  }
}

function getTodayMatches() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  return state.matches.filter(m => {
    if (!m.kickoff) return false;
    const d = new Date(m.kickoff).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    return d === todayStr;
  });
}

// ===== RENDER SCHEDULE =====
function renderSchedule() {
  const el = document.getElementById('view-schedule');
  const matches = state.matches;

  // Group by local Pacific date
  const byDate = {};
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  for (const m of matches) {
    const dateKey = m.kickoff ? dtf.format(new Date(m.kickoff)) : 'TBD';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(m);
  }

  let todayId = null;
  let html = '';
  for (const [date, dayMatches] of Object.entries(byDate)) {
    const firstMatch = dayMatches.find(m => m.kickoff);
    const isToday = firstMatch
      ? new Date(firstMatch.kickoff).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) === todayStr
      : false;
    const id = isToday ? ' id="schedule-today"' : '';
    if (isToday) todayId = 'schedule-today';
    html += `<div class="date-header"${id}>${date}</div>`;
    for (const m of dayMatches) {
      const label = m.stage === 'Group Stage' && m.group ? `Group ${m.group}` : (m.stage || '');
      html += matchCardHtml(m, label);
    }
  }

  el.innerHTML = html || '<div class="empty-state">No matches to display.</div>';

  // Scroll to today after render
  if (todayId) {
    requestAnimationFrame(() => {
      const todayEl = document.getElementById(todayId);
      if (todayEl) {
        const headerH = document.getElementById('app-header')?.offsetHeight || 64;
        const top = todayEl.getBoundingClientRect().top + window.scrollY - headerH - 12;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }
}

// ===== RENDER STANDINGS =====
function renderStandings() {
  const el = document.getElementById('view-standings');
  const statuses = state.liveMode ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
  const computedStandings = state.liveMode ? computeStandings(state.matches, statuses) : state.standings;

  const modeLabel = state.liveMode
    ? `<span class="standings-mode-label live-mode">Live (includes in-play)</span>`
    : `<span class="standings-mode-label official">Official (finished only)</span>`;

  let html = `<div class="standings-header">
    <span class="standings-title">Group Standings</span>
    ${modeLabel}
  </div>`;

  html += `<div class="standings-grid">`;

  for (const grp of 'ABCDEFGHIJKL'.split('')) {
    const teams = computedStandings[grp] || [];
    html += `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="group-header" style="padding:10px 14px;border-bottom:1px solid var(--border);margin-bottom:0;">
          <div class="group-pill">${grp}</div>
          <div class="group-name">Group ${grp}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:28px;">#</th>
              <th>Team</th>
              <th class="num">P</th>
              <th class="num">W</th>
              <th class="num">D</th>
              <th class="num">L</th>
              <th class="num">GF</th>
              <th class="num">GA</th>
              <th class="num">GD</th>
              <th class="num">Pts</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      const rowClass = i === 0 ? 'q1' : i === 1 ? 'q2' : i === 2 ? 'q3' : '';
      html += `
        <tr class="${rowClass}">
          <td><span class="pos">${i + 1}</span></td>
          <td>
            <div class="team-cell">
              ${flagImg(t.iso, t.team)}
              <span>${t.team}</span>
            </div>
          </td>
          <td class="num">${t.played}</td>
          <td class="num">${t.won}</td>
          <td class="num">${t.drawn}</td>
          <td class="num">${t.lost}</td>
          <td class="num">${t.gf}</td>
          <td class="num">${t.ga}</td>
          <td class="num">${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
          <td class="num" style="font-weight:700;">${t.pts}</td>
        </tr>
      `;
    }
    if (teams.length === 0) {
      html += `<tr><td colspan="10" class="empty-state">No matches played</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  html += `</div>
  <div class="qualify-legend">
    <span><span class="swatch" style="background:var(--green);"></span> Auto qualify (1st/2nd)</span>
    <span><span class="swatch" style="background:var(--amber);"></span> Third place (best 8 advance)</span>
  </div>`;

  // Third-place wildcard section
  const thirdPlace = computeThirdPlaceRankings(computedStandings);
  if (thirdPlace.length) {
    html += `
      <div class="card" style="margin-top:24px;">
        <div class="card-title">Third-Place Wildcard Rankings</div>
        <p class="note-text" style="margin-bottom:10px;">Best 8 of 12 third-place teams advance to Round of 32</p>
        <table>
          <thead>
            <tr>
              <th style="width:28px;">#</th>
              <th>Team</th>
              <th class="num">Group</th>
              <th class="num">P</th>
              <th class="num">W</th>
              <th class="num">D</th>
              <th class="num">L</th>
              <th class="num">GF</th>
              <th class="num">GA</th>
              <th class="num">GD</th>
              <th class="num">Pts</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (let i = 0; i < thirdPlace.length; i++) {
      const t = thirdPlace[i];
      const rowClass = i < 8 ? 'wildcard-qualify' : '';
      html += `
        <tr class="${rowClass}">
          <td><span class="pos-num">${i + 1}</span></td>
          <td>
            <div class="team-cell">
              ${flagImg(t.iso, t.team)}
              <span>${t.team}</span>
            </div>
          </td>
          <td class="num"><span class="group-label">${t.groupLetter}</span></td>
          <td class="num">${t.played}</td>
          <td class="num">${t.won}</td>
          <td class="num">${t.drawn}</td>
          <td class="num">${t.lost}</td>
          <td class="num">${t.gf}</td>
          <td class="num">${t.ga}</td>
          <td class="num">${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
          <td class="num" style="font-weight:700;">${t.pts}</td>
        </tr>
      `;
    }
    html += `</tbody></table></div>`;
  }

  el.innerHTML = html;
}

// ===== RENDER BRACKET =====
function renderBracket() {
  const el = document.getElementById('view-bracket');
  const statuses = state.liveMode ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
  const computedStandings = state.liveMode ? computeStandings(state.matches, statuses) : state.standings;
  const thirdPlace = computeThirdPlaceRankings(computedStandings);
  const topEight = thirdPlace.slice(0, 8);
  const combinationString = getThirdPlaceCombinationString(topEight);

  function resolveAndRender(placeholder) {
    if (!placeholder) return { name: 'TBD', iso: null };
    if (!placeholder.startsWith('[')) return { name: placeholder, iso: null };
    return resolveTeam(placeholder, computedStandings, thirdPlace, combinationString);
  }

  function bMatchHtml(match) {
    const home = resolveAndRender(match.homeTeam);
    const away = resolveAndRender(match.awayTeam);
    const hasScore = match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED';
    const homeWon = hasScore && match.homeScore > match.awayScore;
    const awayWon = hasScore && match.awayScore > match.homeScore;

    return `
      <div class="b-match">
        <div class="b-num">M${match.matchNum}</div>
        <div class="b-team ${homeWon ? 'winner' : ''}">
          ${flagImg(home.iso, home.name)}
          <span class="b-team-name">${home.name}</span>
          ${hasScore ? `<span class="b-score">${match.homeScore}</span>` : ''}
        </div>
        <hr class="b-div">
        <div class="b-team ${awayWon ? 'winner' : ''}">
          ${flagImg(away.iso, away.name)}
          <span class="b-team-name">${away.name}</span>
          ${hasScore ? `<span class="b-score">${match.awayScore}</span>` : ''}
        </div>
      </div>
    `;
  }

  function bSlot(match) {
    return `<div class="b-slot">${bMatchHtml(match)}</div>`;
  }

  const r32 = state.matches.filter(m => m.stage === 'Round of 32');
  const r16 = state.matches.filter(m => m.stage === 'Round of 16');
  const qf = state.matches.filter(m => m.stage === 'Quarterfinals');
  const sf = state.matches.filter(m => m.stage === 'Semifinals');
  const final = state.matches.filter(m => m.stage === 'Final');
  const thirdPlaceMatch = state.matches.filter(m => m.stage === 'Third Place');

  let html = `<div class="bracket-wrapper"><div class="bracket">`;

  html += `<div class="bracket-round r32">
    <div class="round-label">Round of 32</div>
    ${r32.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round r16">
    <div class="round-label">Round of 16</div>
    ${r16.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round rqf">
    <div class="round-label">Quarterfinals</div>
    ${qf.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round rsf">
    <div class="round-label">Semifinals</div>
    ${sf.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round rfin">
    <div class="round-label">Final</div>
    ${final.map(bSlot).join('')}
    <div class="round-label" style="margin-top:16px;">3rd Place</div>
    ${thirdPlaceMatch.map(bSlot).join('')}
  </div>`;

  html += `</div></div>`;
  el.innerHTML = html;
}

// ===== RENDER VIEW =====
function renderView() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const viewEl = document.getElementById(`view-${state.currentView}`);
  if (viewEl) viewEl.classList.add('active');

  const tabEl = document.querySelector(`.nav-tab[data-view="${state.currentView}"]`);
  if (tabEl) tabEl.classList.add('active');

  // Sync main top margin to actual header height (handles dynamic header height on mobile)
  const header = document.getElementById('app-header');
  const main = document.getElementById('app-main');
  if (header && main) main.style.marginTop = header.offsetHeight + 'px';

  // Scroll to top on all views except schedule (which scrolls to today itself)
  if (state.currentView !== 'schedule') window.scrollTo({ top: 0, behavior: 'instant' });

  switch (state.currentView) {
    case 'dashboard': renderDashboard(); break;
    case 'schedule': renderSchedule(); break;
    case 'standings': renderStandings(); break;
    case 'bracket': renderBracket(); break;
  }
}

// ===== FETCH DATA =====
async function fetchData() {
  try {
    const [dataRes, combRes] = await Promise.all([
      fetch('./data/data.json?' + Date.now()),
      fetch('./data/combinations.json?' + Date.now()),
    ]);
    if (!dataRes.ok) throw new Error('data.json fetch failed: ' + dataRes.status);
    const data = await dataRes.json();
    state.matches = data.matches || [];
    state.standings = data.standings || {};
    state.lastUpdated = data.lastUpdated || null;

    if (combRes.ok) {
      state.combinations = await combRes.json();
    }

    // Update sync info — if ESPN has been syncing, don't overwrite with older timestamp
    if (!state.espnSynced) {
      const syncEl = document.getElementById('last-sync');
      if (syncEl) syncEl.textContent = formatLastSync(state.lastUpdated);
    }

    // Flash header
    const header = document.getElementById('app-header');
    if (header) {
      header.classList.remove('sync-flash');
      void header.offsetWidth; // reflow to restart animation
      header.classList.add('sync-flash');
      setTimeout(() => header.classList.remove('sync-flash'), 500);
    }

    renderView();
  } catch (e) {
    console.error('fetchData error:', e);
  }
}

// ===== TICK =====
function tick() {
  const clocks = document.querySelectorAll('.match-clock[data-matchnum]');
  clocks.forEach(clockEl => {
    const matchNum = parseInt(clockEl.dataset.matchnum, 10);
    const match = state.matches.find(m => m.matchNum === matchNum);
    if (!match) return;
    if (match.status === 'IN_PLAY') {
      const min = getMatchMinute(match);
      if (min !== null && min !== undefined) clockEl.textContent = min;
    }
  });

  // Also update last-sync display
  const syncEl = document.getElementById('last-sync');
  if (syncEl && state.lastUpdated) {
    const label = formatLastSync(state.lastUpdated);
    syncEl.textContent = state.espnSynced ? label + ' (ESPN)' : label;
  }
}

// ===== INIT =====
async function init() {
  // Nav tab listeners
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.currentView = tab.dataset.view;
      renderView();
    });
  });

  // Keep #app-main margin-top in sync with real header height on resize
  const header = document.getElementById('app-header');
  const main = document.getElementById('app-main');
  if (header && main) {
    const syncMargin = () => { main.style.marginTop = header.offsetHeight + 'px'; };
    syncMargin();
    new ResizeObserver(syncMargin).observe(header);
  }

  // Live mode toggle
  const toggle = document.getElementById('live-mode-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => {
      state.liveMode = toggle.checked;
      renderView();
    });
  }

  // Initial load from data.json (full schedule + standings)
  await fetchData();

  // Initial ESPN sync — overlays live scores immediately
  await fetchESPN();

  // Tick every second for live clocks
  if (state.tickInterval) clearInterval(state.tickInterval);
  state.tickInterval = setInterval(tick, 1000);

  // ESPN: poll every 30s for live scores
  if (state.espnInterval) clearInterval(state.espnInterval);
  state.espnInterval = setInterval(fetchESPN, 30000);

  // data.json: re-fetch every 2 minutes for schedule/standings/knockout updates
  if (state.syncInterval) clearInterval(state.syncInterval);
  state.syncInterval = setInterval(fetchData, 2 * 60 * 1000);
}

init();
