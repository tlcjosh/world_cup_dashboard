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
};

// ===== TEAM DATA =====
const TEAM_MASTER_DATA = {
  "Mexico": { group: "A", iso: "mx" }, "South Africa": { group: "A", iso: "za" }, "South Korea": { group: "A", iso: "kr" }, "Czechia": { group: "A", iso: "cz" },
  "Canada": { group: "B", iso: "ca" }, "Bosnia-Herzegovina": { group: "B", iso: "ba" }, "Qatar": { group: "B", iso: "qa" }, "Switzerland": { group: "B", iso: "ch" },
  "Brazil": { group: "C", iso: "br" }, "Morocco": { group: "C", iso: "ma" }, "Haiti": { group: "C", iso: "ht" }, "Scotland": { group: "C", iso: "scotland" },
  "United States": { group: "D", iso: "us" }, "Paraguay": { group: "D", iso: "py" }, "Australia": { group: "D", iso: "au" }, "Turkey": { group: "D", iso: "tr" },
  "Germany": { group: "E", iso: "de" }, "Curaçao": { group: "E", iso: "cw" }, "Ivory Coast": { group: "E", iso: "ci" }, "Ecuador": { group: "E", iso: "ec" },
  "Netherlands": { group: "F", iso: "nl" }, "Japan": { group: "F", iso: "jp" }, "Sweden": { group: "F", iso: "se" }, "Tunisia": { group: "F", iso: "tn" },
  "Spain": { group: "G", iso: "es" }, "Cape Verde Islands": { group: "G", iso: "cv" }, "Saudi Arabia": { group: "G", iso: "sa" }, "Uruguay": { group: "G", iso: "uy" },
  "Belgium": { group: "H", iso: "be" }, "Egypt": { group: "H", iso: "eg" }, "Iran": { group: "H", iso: "ir" }, "New Zealand": { group: "H", iso: "nz" },
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
  const now = Date.now();
  if (match.secondHalfStart) {
    const elapsed = Math.floor((now - new Date(match.secondHalfStart).getTime()) / 60000) + 1;
    const min = 45 + elapsed;
    if (elapsed > 15) return `90+${elapsed - 15}'`;
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
    if (!m.group || m.stage !== 'Group Stage') continue;
    const g = m.group;
    if (!standings[g]) standings[g] = {};
    for (const [team, iso, scored, conceded] of [
      [m.homeTeam, m.homeIso, m.homeScore, m.awayScore],
      [m.awayTeam, m.awayIso, m.awayScore, m.homeScore]
    ]) {
      if (!team) continue;
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
    return `<span class="badge badge-finished">FT</span>`;
  }
  return `<span class="badge badge-scheduled">${match.kickoff ? formatKickoff(match.kickoff) : 'TBD'}</span>`;
}

function scoreDisplay(match) {
  if (match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED') {
    const hs = match.homeScore !== null && match.homeScore !== undefined ? match.homeScore : '-';
    const as = match.awayScore !== null && match.awayScore !== undefined ? match.awayScore : '-';
    return `<span class="match-score">${hs} – ${as}</span>`;
  }
  return `<span class="match-score vs">vs</span>`;
}

function matchCardHtml(match) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const minute = isLive ? getMatchMinute(match) : null;
  const clockHtml = (match.status === 'IN_PLAY')
    ? `<span class="match-clock" data-matchnum="${match.matchNum}">${minute || '1\''}</span>`
    : (match.status === 'PAUSED' ? `<span class="match-clock">HT</span>` : '');

  return `
    <div class="match-card ${isLive ? 'live' : ''}">
      <div class="match-teams">
        <div class="match-team">
          ${flagImg(match.homeIso, match.homeTeam)}
          <span class="match-team-name">${match.homeTeam || 'TBD'}</span>
        </div>
        ${scoreDisplay(match)}
        <div class="match-team">
          ${flagImg(match.awayIso, match.awayTeam)}
          <span class="match-team-name">${match.awayTeam || 'TBD'}</span>
        </div>
        ${clockHtml}
      </div>
      <div class="match-meta">
        ${statusBadge(match)}
        <div class="match-venue">${match.venue || ''}</div>
      </div>
    </div>
  `;
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  const liveMatches = state.matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const finished = state.matches.filter(m => m.status === 'FINISHED').slice(-3);
  const scheduled = state.matches.filter(m => m.status === 'SCHEDULED').slice(0, 5);

  // Team filter logic
  let filteredMatches = null;
  if (state.teamFilter) {
    filteredMatches = state.matches.filter(m =>
      m.homeTeam === state.teamFilter || m.awayTeam === state.teamFilter
    );
  }

  const teamNames = Object.keys(TEAM_MASTER_DATA).sort();
  const datalistHtml = `<datalist id="team-datalist">${teamNames.map(t => `<option value="${t}">`).join('')}</datalist>`;

  let html = `
    <div class="search-container">
      <input list="team-datalist" id="team-search" class="search-input" placeholder="Search team..." value="${state.teamFilter || ''}">
      ${datalistHtml}
    </div>
  `;

  if (state.teamFilter && filteredMatches) {
    const meta = TEAM_MASTER_DATA[state.teamFilter];
    html += `
      <div class="card">
        <div class="card-title">
          ${meta ? flagImg(meta.iso, state.teamFilter) : ''}
          ${state.teamFilter}
          ${meta ? `<span class="group-label">Group ${meta.group}</span>` : ''}
        </div>
        ${filteredMatches.length ? filteredMatches.map(matchCardHtml).join('') : '<div class="empty-state">No matches found.</div>'}
      </div>
    `;
  } else {
    // Live section
    if (liveMatches.length) {
      html += `<div class="card"><div class="card-title">🔴 LIVE NOW</div>${liveMatches.map(matchCardHtml).join('')}</div>`;
    }

    html += `<div class="dashboard-grid">`;

    // Recent Results
    html += `<div>
      <div class="section-title">Recent Results</div>
      ${finished.length ? [...finished].reverse().map(matchCardHtml).join('') : '<div class="empty-state">No results yet.</div>'}
    </div>`;

    // Coming Up
    html += `<div>
      <div class="section-title">Coming Up</div>
      ${scheduled.length ? scheduled.map(matchCardHtml).join('') : '<div class="empty-state">No upcoming matches.</div>'}
    </div>`;

    html += `</div>`;
  }

  el.innerHTML = html;

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

  for (const m of matches) {
    const dateKey = m.kickoff ? dtf.format(new Date(m.kickoff)) : 'TBD';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(m);
  }

  let html = '';
  for (const [date, dayMatches] of Object.entries(byDate)) {
    html += `<div class="date-header">${date}</div>`;
    for (const m of dayMatches) {
      const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
      const minute = isLive ? getMatchMinute(m) : null;
      const clockHtml = (m.status === 'IN_PLAY')
        ? `<span class="match-clock" data-matchnum="${m.matchNum}">${minute || '1\''}</span>`
        : (m.status === 'PAUSED' ? `<span class="match-clock">HT</span>` : '');

      html += `
        <div class="match-card ${isLive ? 'live' : ''}">
          <div class="match-teams">
            <div class="match-team">
              ${flagImg(m.homeIso, m.homeTeam)}
              <span class="match-team-name">${m.homeTeam || 'TBD'}</span>
            </div>
            ${scoreDisplay(m)}
            <div class="match-team">
              ${flagImg(m.awayIso, m.awayTeam)}
              <span class="match-team-name">${m.awayTeam || 'TBD'}</span>
            </div>
            ${clockHtml}
          </div>
          <div class="match-meta">
            ${statusBadge(m)}
            <div class="match-venue">${m.venue || ''}</div>
          </div>
        </div>
      `;
    }
  }

  el.innerHTML = html || '<div class="empty-state">No matches to display.</div>';
}

// ===== RENDER STANDINGS =====
function renderStandings() {
  const el = document.getElementById('view-standings');
  const statuses = state.liveMode ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
  const computedStandings = state.liveMode ? computeStandings(state.matches, statuses) : state.standings;

  const modeLabel = state.liveMode
    ? `<span class="standings-mode-label live-mode">Live (includes in-play)</span>`
    : `<span class="standings-mode-label official">Official (finished only)</span>`;

  let html = `<div style="display:flex;align-items:center;margin-bottom:12px;gap:8px;">
    <span style="font-size:15px;font-weight:700;">Group Standings</span>
    ${modeLabel}
  </div>`;

  html += `<div class="standings-grid">`;

  for (const grp of 'ABCDEFGHIJKL'.split('')) {
    const teams = computedStandings[grp] || [];
    html += `
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
          <span class="group-label">Group ${grp}</span>
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
      const rowClass = i < 2 ? 'qualify-auto' : i === 2 ? 'qualify-3rd' : '';
      html += `
        <tr class="${rowClass}">
          <td><span class="pos-num">${i + 1}</span></td>
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

  html += `</div>`;

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

  function bracketMatchHtml(match) {
    const home = resolveAndRender(match.homeTeam);
    const away = resolveAndRender(match.awayTeam);
    const hasScore = match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED';
    const homeWon = hasScore && match.homeScore > match.awayScore;
    const awayWon = hasScore && match.awayScore > match.homeScore;

    return `
      <div class="bracket-match">
        <div class="bracket-match-num">M${match.matchNum}</div>
        <div class="bracket-team ${homeWon ? 'winner' : ''}">
          ${flagImg(home.iso, home.name)}
          <span class="bracket-team-name">${home.name}</span>
          ${hasScore ? `<span class="bracket-score">${match.homeScore}</span>` : ''}
        </div>
        <hr class="bracket-divider">
        <div class="bracket-team ${awayWon ? 'winner' : ''}">
          ${flagImg(away.iso, away.name)}
          <span class="bracket-team-name">${away.name}</span>
          ${hasScore ? `<span class="bracket-score">${match.awayScore}</span>` : ''}
        </div>
      </div>
    `;
  }

  const r32 = state.matches.filter(m => m.stage === 'Round of 32');
  const r16 = state.matches.filter(m => m.stage === 'Round of 16');
  const qf = state.matches.filter(m => m.stage === 'Quarterfinals');
  const sf = state.matches.filter(m => m.stage === 'Semifinals');
  const final = state.matches.filter(m => m.stage === 'Final');
  const thirdPlaceMatch = state.matches.filter(m => m.stage === 'Third Place');

  let html = `<div class="bracket-wrapper"><div class="bracket">`;

  // Round of 32
  html += `<div class="bracket-round">
    <div class="bracket-round-title">Round of 32</div>
    ${r32.map(bracketMatchHtml).join('')}
  </div>`;

  // Round of 16
  html += `<div class="bracket-round">
    <div class="bracket-round-title">Round of 16</div>
    ${r16.map(bracketMatchHtml).join('')}
  </div>`;

  // Quarterfinals
  html += `<div class="bracket-round">
    <div class="bracket-round-title">Quarterfinals</div>
    ${qf.map(bracketMatchHtml).join('')}
  </div>`;

  // Semifinals
  html += `<div class="bracket-round">
    <div class="bracket-round-title">Semifinals</div>
    ${sf.map(bracketMatchHtml).join('')}
  </div>`;

  // Final + 3rd Place
  html += `<div class="bracket-round">
    <div class="bracket-round-title">Final</div>
    ${final.map(bracketMatchHtml).join('')}
    <div class="bracket-round-title" style="margin-top:16px;">3rd Place</div>
    ${thirdPlaceMatch.map(bracketMatchHtml).join('')}
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

    // Update sync info
    const syncEl = document.getElementById('last-sync');
    if (syncEl) syncEl.textContent = formatLastSync(state.lastUpdated);

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
    syncEl.textContent = formatLastSync(state.lastUpdated);
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

  // Live mode toggle
  const toggle = document.getElementById('live-mode-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => {
      state.liveMode = toggle.checked;
      renderView();
    });
  }

  // Initial fetch
  await fetchData();

  // Tick every second for live clocks
  if (state.tickInterval) clearInterval(state.tickInterval);
  state.tickInterval = setInterval(tick, 1000);

  // Re-fetch every 30 seconds
  if (state.syncInterval) clearInterval(state.syncInterval);
  state.syncInterval = setInterval(fetchData, 30000);
}

init();
