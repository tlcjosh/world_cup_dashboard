/**
 * WORLD CUP 2026 - STANDARDIZED API UPDATER
 * Source: football-data.org
 */

const API_KEY = '51021998e3604139a142ea88756a9113'; 
const BASE_URL = 'https://api.football-data.org/v4';

/**
 * MASTER TEAM DATA: Group Assignments & ISO Codes
 * These keys exactly match the API's native spelling.
 */
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

function onOpen() {
  SpreadsheetApp.getUi().createMenu('World Cup 2026')
    .addItem('🔍 Filter Schedule by Team', 'filterScheduleByTeam')
    .addItem('❌ Clear Team Filter', 'clearScheduleFilter')
    .addSeparator()
    .addItem('Update All Data (Live API)', 'updateWorldCupData')
    .addItem('TEST: Simulate data from Gists', 'runTestFromGist')
    .addSeparator()
    .addItem('Reset All Data (Clear Scores & Standings)', 'resetTournamentData')
    .addSeparator()
    .addItem('Authorize 1-Minute Live Trigger', 'setupMinuteTrigger')
    .addToUi();
}

/**
 * SETUP FUNCTION: Connects to the REAL API to pull unique IDs, official times, 
 * and enforces correct Home/Away orientation with flags.
 */
function setupMatchIdentities() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedule');
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Error: 'Schedule' sheet not found.");
    return;
  }

  // Fetch from the real API so we get actual match IDs
  const options = { method: 'GET', headers: { 'X-Auth-Token': API_KEY }, muteHttpExceptions: true };
  const response = UrlFetchApp.fetch(`${BASE_URL}/competitions/WC/matches?season=2026`, options);
  
  if (response.getResponseCode() !== 200) {
    SpreadsheetApp.getUi().alert("Error fetching official matches from API.");
    return;
  }
  
  const apiMatches = JSON.parse(response.getContentText()).matches;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Range mapping: Col A (0), Col C (2), Col D (3), Col E (4), Col F (5), Col I (8)
  const fullRange = sheet.getRange(2, 1, lastRow - 1, 9);
  const data = fullRange.getValues();

  data.forEach(row => {
    const t1Sheet = cleanName(row[2]); // Col C
    const t2Sheet = cleanName(row[5]); // Col F

    // Skip empty rows or unresolved bracket placeholders
    if (!t1Sheet || !t2Sheet || t1Sheet.includes("[") || t1Sheet.includes("winner")) return;

    let matchedMatch = null;
    let isReversed = false;

    for (let i = 0; i < apiMatches.length; i++) {
      const m = apiMatches[i];
      if (!m.homeTeam || !m.homeTeam.name || !m.awayTeam || !m.awayTeam.name) continue;
      
      const t1Api = cleanName(m.homeTeam.name);
      const t2Api = cleanName(m.awayTeam.name);

      if (t1Sheet === t1Api && t2Sheet === t2Api) {
        matchedMatch = m;
        isReversed = false;
        break;
      } else if (t1Sheet === t2Api && t2Sheet === t1Api) {
        matchedMatch = m;
        isReversed = true;
        break;
      }
    }

    if (matchedMatch) {
      row[8] = matchedMatch.id || ""; // Set Match ID
      
      if (matchedMatch.utcDate) {
        row[0] = new Date(matchedMatch.utcDate); // Set Date
      }

      // Restore flags to the names
      const homeName = matchedMatch.homeTeam.name;
      const awayName = matchedMatch.awayTeam.name;
      const homeMeta = TEAM_MASTER_DATA[homeName];
      const awayMeta = TEAM_MASTER_DATA[awayName];
      const homeStr = homeMeta ? `${getFlagEmoji(homeMeta.iso)} ${homeName}` : homeName;
      const awayStr = awayMeta ? `${getFlagEmoji(awayMeta.iso)} ${awayName}` : awayName;

      // Flip scores if re-orienting the row
      if (isReversed) {
        let tempScore1 = row[3];
        let tempScore2 = row[4];
        row[3] = tempScore2;
        row[4] = tempScore1;
      }

      row[2] = homeStr;
      row[5] = awayStr;
    }
  });

  fullRange.setValues(data);
  SpreadsheetApp.getUi().alert("Setup Complete: Match IDs, Flags, and Alignments synced!");
}

/**
 * Master Controller: Fetches Live Data securely and routes it to Standings and Schedule.
 */
function updateWorldCupData() {
  // 🛑 TIME GATE: Prevent running in the middle of the night to save Google Quota
  // getHours() returns 0-23 in your spreadsheet's local timezone (Pacific Time)
  const currentHour = new Date().getHours();
  
  // If it's before 8:00 AM or after 10:59 PM, exit immediately
  if (currentHour < 8 || currentHour >= 23) {
    return; 
  }
  const cache = CacheService.getScriptCache();
  const options = { method: 'GET', headers: { 'X-Auth-Token': API_KEY }, muteHttpExceptions: true };

  // --- 1. STANDINGS ROUTING ---
  let standingsData = cache.get("standings");
  if (!standingsData) {
    const stRes = UrlFetchApp.fetch(`${BASE_URL}/competitions/WC/standings?season=2026`, options);
    if (stRes.getResponseCode() === 200) {
      standingsData = stRes.getContentText();
      cache.put("standings", standingsData, 55);
    }
  }
  
  if (standingsData) {
    const parsedStandings = JSON.parse(standingsData);
    if (parsedStandings.standings && parsedStandings.standings[0]) {
      processFlatStandings(parsedStandings.standings[0].table);
    }
  }

 // --- 2. MATCHES ROUTING ---
  let matchData = cache.get("matches");
  if (!matchData) {
    const mRes = UrlFetchApp.fetch(`${BASE_URL}/competitions/WC/matches?season=2026`, options);
    if (mRes.getResponseCode() === 200) {
      matchData = mRes.getContentText();
      cache.put("matches", matchData, 55);
    }
  }

  if (matchData) {
    const parsedMatches = JSON.parse(matchData);
    if (parsedMatches.matches) {
      // 🟢 ADDED FOR DEBUGGING: Log the first few matches to see statuses and objects
      Logger.log("Total API Matches Pulled: " + parsedMatches.matches.length);
      if (parsedMatches.matches.length > 0) {
        Logger.log("Sample Match Object (Match 1): " + JSON.stringify(parsedMatches.matches[0]));
      }
      
      processSchedule(parsedMatches.matches);
    }
  }
/*
  if (matchData) {
    const parsedMatches = JSON.parse(matchData);
    if (parsedMatches.matches) {
      processSchedule(parsedMatches.matches);
      
      // 🟢 STRATEGIC AI TRIGGER: 
      // Force a true cache-busted regeneration at the top of the hour and at the half-hour marks
      const currentMinute = new Date().getMinutes();
      const isTimeForUpdate = (currentMinute === 0 || currentMinute === 30);
      
      // Also trigger if an in-play match hits halftime or finishes
      const matchStatusChange = parsedMatches.matches.some(m => m.status === "PAUSED" || m.status === "FINISHED");

      if (isTimeForUpdate || matchStatusChange) {
        generateAIPunditAnalysis();
      }
    }
  }*/
}

/**
 * Process Standings
 */
function processFlatStandings(flatTable) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Standings');
  if (!sheet) return;

  const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  const rowStarts = [1, 8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78];
  const organized = {};
  groups.forEach(g => organized[g] = []);

  flatTable.forEach(row => {
    if (!row.team || !row.team.name) return; 

    let apiName = row.team.name;
    let meta = TEAM_MASTER_DATA[apiName];

    if (meta) {
      organized[meta.group].push([
        0, 
        `${getFlagEmoji(meta.iso)} ${apiName}`,
        row.playedGames || 0, 
        row.won || 0, 
        row.draw || 0, 
        row.lost || 0,
        row.goalsFor || 0, 
        row.goalsAgainst || 0, 
        row.goalDifference || 0, 
        row.points || 0
      ]);
    }
  });

  groups.forEach((letter, i) => {
    let groupData = organized[letter];
    if (groupData.length > 0) {
      groupData.sort((a,b) => b[9] - a[9] || b[8] - a[8] || b[6] - a[6]);
      groupData = groupData.map((r, idx) => { r[0] = idx + 1; return r; });
      sheet.getRange(rowStarts[i] + 2, 1, groupData.length, 10).setValues(groupData);
    }
  });
}

/**
 * Process Schedule: Prioritizes Match ID, falls back to name matching, 
 * and SELF-HEALS missing IDs without breaking sheet formulas.
 * Logs kickoff timestamps for active matches to drive the live dashboard clock.
 */
function processSchedule(apiMatches) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedule');
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // 🟢 EXPANDED: Range stretched to 12 columns to include Column K (1H) and Column L (2H)
  const range = sheet.getRange(2, 1, lastRow - 1, 12);
  const sheetRows = range.getValues();
  
  const updatedScores = [];
  const updatedIds = []; 
  const updatedStatuses = []; 
  const updatedTimestamps = []; // 🟢 NEW: Array to track 1H and 2H kickoff times

  sheetRows.forEach(row => {
    const matchId = row[8]; 
    const statusVal = row[9]; // Col J
    let firstHalfStart = row[10]; // 🟢 NEW: Column K (Index 10)
    let secondHalfStart = row[11]; // 🟢 NEW: Column L (Index 11)
    const t1Sheet = cleanName(row[2]); 
    const t2Sheet = cleanName(row[5]); 

    if (!t1Sheet || !t2Sheet || t1Sheet.length < 3 || t1Sheet.includes("[") || t1Sheet.includes("winner")) {
      updatedScores.push(["", ""]);
      updatedIds.push([matchId]); 
      updatedStatuses.push([statusVal]); 
      updatedTimestamps.push([firstHalfStart, secondHalfStart]); 
      return;
    }

    let matchedMatch = null;
    let isReversed = false;
    let newMatchId = matchId; 

    if (matchId) {
      matchedMatch = apiMatches.find(m => m.id && m.id == matchId);
    }

    if (!matchedMatch) {
      for (let i = 0; i < apiMatches.length; i++) {
        const m = apiMatches[i];
        if (!m.homeTeam || !m.homeTeam.name || !m.awayTeam || !m.awayTeam.name) continue;
        
        const t1Api = cleanName(m.homeTeam.name);
        const t2Api = cleanName(m.awayTeam.name);

        if (t1Sheet === t1Api && t2Sheet === t2Api) {
          matchedMatch = m;
          isReversed = false;
          newMatchId = m.id; 
          break;
        } else if (t1Sheet === t2Api && t2Sheet === t1Api) { 
          matchedMatch = m;
          isReversed = true;
          newMatchId = m.id; 
          break;
        }
      }
    } else {
      isReversed = cleanName(matchedMatch.homeTeam.name) !== t1Sheet;
    }

    let s1 = "", s2 = "", apiStatus = "";
    
    if (matchedMatch) {
      apiStatus = matchedMatch.status || "";
      
      if (apiStatus === "FINISHED" || apiStatus === "AWARDED" || apiStatus === "IN_PLAY" || apiStatus === "PAUSED") {
        const homeScore = matchedMatch.score.fullTime.home !== null ? matchedMatch.score.fullTime.home : "";
        const awayScore = matchedMatch.score.fullTime.away !== null ? matchedMatch.score.fullTime.away : "";
        
        s1 = isReversed ? awayScore : homeScore;
        s2 = isReversed ? homeScore : awayScore;
      }

      // 🟢 NEW: Timestamp Capture Logic (Leaves historical data intact)
      if (apiStatus === "IN_PLAY") {
        const nowTimestamp = new Date();
        
        if (!firstHalfStart) {
          // First time seeing this match live -> 1st Half Kickoff
          firstHalfStart = nowTimestamp;
        } else if (statusVal === "PAUSED" && !secondHalfStart) {
          // Match was paused last run, now it's live again -> 2nd Half Kickoff
          secondHalfStart = nowTimestamp;
        }
      }
    }
    
    updatedScores.push([s1, s2]);
    updatedIds.push([newMatchId || ""]); 
    updatedStatuses.push([apiStatus]); 
    updatedTimestamps.push([firstHalfStart || "", secondHalfStart || ""]); // 🟢 NEW
  });

  // Write updates back to specific columns
  sheet.getRange(2, 4, updatedScores.length, 2).setValues(updatedScores); 
  sheet.getRange(2, 9, updatedIds.length, 1).setValues(updatedIds);       
  sheet.getRange(2, 10, updatedStatuses.length, 1).setValues(updatedStatuses); 
  sheet.getRange(2, 11, updatedTimestamps.length, 2).setValues(updatedTimestamps); // 🟢 NEW: Writes to columns K & L

  // ----------------------------------------------------
  // 🟢 DASHBOARD TIMESTAMP & HEADER FLASH SYSTEM
  // ----------------------------------------------------
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashSheet = ss.getSheetByName('Dashboard');
  if (dashSheet) {
    // 1. Update the Timestamp in I22 using the Spreadsheet's native timezone (PDT)
    const now = new Date();
    const tz = ss.getSpreadsheetTimeZone();
    const formattedTime = Utilities.formatDate(now, tz, "MMM dd, yyyy h:mm:ss a");
    dashSheet.getRange("I22").setValue("Last Sync: " + formattedTime);
    
    // 2. Target the Dashboard section headers using getRangeList
    const flashRangeList = dashSheet.getRangeList(["B1:E1", "B5:E5", "B10:E10", "B15:E15"]);
    
    // Check live status cell
    const liveStatusText = dashSheet.getRange("B2").getValue();
    
    // Only flash if a match is actively "LIVE" or at "HALFTIME"
    if (liveStatusText === "LIVE" || liveStatusText === "HALFTIME") {
      const flashColor = (liveStatusText === "LIVE") ? "#FFCCCC" : "#CCE5FF"; // Soft red for live, soft blue for halftime
      
      flashRangeList.setBackground(flashColor);
      SpreadsheetApp.flush(); // Force UI to update color immediately
      
      Utilities.sleep(1200); // Hold the color for 1.2 seconds
      
      flashRangeList.setBackground("#435e91"); // Reset back to theme color
      SpreadsheetApp.flush();
    } else {
      // Gentle brief pulse for general updates when no matches are live
      flashRangeList.setBackground("#E2E2E2");
      SpreadsheetApp.flush();
      Utilities.sleep(400);
      flashRangeList.setBackground("#435e91");
      SpreadsheetApp.flush();
    }
  }
}
/**
 * Interactive UI Filter: Filters the Schedule sheet down to a single selected team.
 * Checks both Column C and Column F simultaneously.
 */
function filterScheduleByTeam() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Schedule');
  const ui = SpreadsheetApp.getUi();
  
  if (!sheet) return;

  // 1. Prompt the user for the team name
  const response = ui.prompt('Filter Schedule by Team', 'Enter the exact team name (e.g., Mexico or United States):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const teamInput = response.getResponseText().trim();
  if (!teamInput) {
    ui.alert('Please enter a valid team name.');
    return;
  }

  // 2. Clear any existing filters to prevent stacking errors
  let filter = sheet.getFilter();
  if (filter) filter.remove();

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const range = sheet.getRange(1, 1, lastRow, lastColumn);
  
  // 3. Create a fresh filter
  filter = range.createFilter();
  
  // 4. Build custom OR criteria using our cleanName logic
  const targetClean = cleanName(teamInput);
  const rowValues = range.getValues();
  const hiddenRows = [];

  // Loop through rows (skipping header row 1)
  for (let i = 1; i < rowValues.length; i++) {
    const homeTeam = cleanName(rowValues[i][2]); // Column C
    const awayTeam = cleanName(rowValues[i][5]); // Column F
    
    // If the team IS NOT playing in this match, flag the row to be hidden
    if (!homeTeam.includes(targetClean) && !awayTeam.includes(targetClean)) {
      hiddenRows.push(i + 1);
    }
  }

  // Hide the rows that don't match
  hiddenRows.forEach(rowNum => sheet.hideRows(rowNum));
}

/**
 * Quick reset utility to bring back all matches
 */
function clearScheduleFilter() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedule');
  if (!sheet) return;
  
  const filter = sheet.getFilter();
  if (filter) filter.remove();
  
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.showRows(1, lastRow);
  }
}

/**
 * HELPER: Aggressively cleans strings for matching
 */
function cleanName(name) {
  if (!name) return "";
  return name.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim().toLowerCase();
}

function getFlagEmoji(iso) {
  if (!iso || iso === "un") return "🏳️";
  if (iso === "england") return "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F";
  if (iso === "scotland") return "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F";
  const codePoints = iso.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

function resetTournamentData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert('Confirm Reset', 'This will clear all scores and standings. Are you sure?', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  const scheduleSheet = ss.getSheetByName('Schedule');
  if (scheduleSheet) {
    const lastRow = scheduleSheet.getLastRow();
    if (lastRow > 1) {
      scheduleSheet.getRange(2, 4, lastRow - 1, 2).clearContent();
    }
  }

  const standingsSheet = ss.getSheetByName('Standings');
  if (standingsSheet) {
    const rowStarts = [1, 8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78];
    rowStarts.forEach(start => {
      standingsSheet.getRange(start + 2, 1, 4, 10).clearContent();
    });
    standingsSheet.getRange("A1").setNote("Data reset on: " + new Date().toLocaleString());
  }
  
  const dashSheet = ss.getSheetByName('Dashboard');
  if(dashSheet) {
      dashSheet.getRange("B2:E10").clearContent();
  }

  ui.alert('Reset Complete', 'All scores and standings have been wiped.', ui.ButtonSet.OK);
}

/**
 * Sets the trigger to fire every 1 minute.
 */
function setupMinuteTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  ScriptApp.newTrigger('updateWorldCupData')
    .timeBased()
    .everyMinutes(1)
    .create();
    
  SpreadsheetApp.getUi().alert('Live Tracker Activated: Data will sync every 60 seconds.');
}

/**
 * TESTING FUNCTION: Uses raw gists
 */
function runTestFromGist() {
  const testStandingsUrl = 'https://gist.githubusercontent.com/Jishhk/c3f3ee4032aaaeca881b06fea9639cdf/raw/80d15f89d8a92d7b2de6e8bef86309e9da97ab8e/test_standings_2.json';
  const testMatchesUrl = 'https://gist.githubusercontent.com/Jishhk/9607d1e36bb7f4f2cd23ebb653e45531/raw/85dd12c674021fe2ea2ee39b1eb0b4cc2e658b16/test_matches_2.json';

  const standingsRes = UrlFetchApp.fetch(testStandingsUrl, {muteHttpExceptions: true});
  if(standingsRes.getResponseCode() === 200){
      const standingsData = JSON.parse(standingsRes.getContentText());
      processFlatStandings(standingsData.standings[0].table);
  }

  const matchesRes = UrlFetchApp.fetch(testMatchesUrl, {muteHttpExceptions: true});
  if(matchesRes.getResponseCode() === 200){
      const matchesData = JSON.parse(matchesRes.getContentText());
      processSchedule(matchesData.matches);
  }

  SpreadsheetApp.getUi().alert('TEST COMPLETED: Loaded realistic data from Gists.');
}
/*
function generateAIPunditAnalysis() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashSheet = ss.getSheetByName('Dashboard');
  if (!dashSheet) return;

  // 1. Target your analysis display cell
  const targetCell = dashSheet.getRange("G2"); // Change to your exact cell

  // 2. Build the unique cache-buster timestamp
  const timestamp = new Date().toLocaleTimeString();

  // 3. Assemble the formula cleanly without escaping characters
  const formulaString = 
    `=AI("Strictly using the data provided for the 2026 tournament, act as an expert football tactician and insightful studio analyst. ` +
    `Here are the Live Matches: " & Dashboard!B2 & " " & Dashboard!C2 & " " & Dashboard!D2 & " " & Dashboard!E2 & " | " & Dashboard!B3 & " " & Dashboard!C3 & " " & Dashboard!D3 & " " & Dashboard!E3 & " | " & Dashboard!B4 & " " & Dashboard!C4 & " " & Dashboard!D4 & " " & Dashboard!E4 & " | " & Dashboard!B5 & " " & Dashboard!C5 & " " & Dashboard!D5 & " " & Dashboard!E5 & " ` +
    `Here are the Upcoming Matches: " & Dashboard!B8 & " " & Dashboard!C8 & " " & Dashboard!D8 & " " & Dashboard!E8 & " | " & Dashboard!B9 & " " & Dashboard!C9 & " " & Dashboard!D9 & " " & Dashboard!E9 & " | " & Dashboard!B10 & " " & Dashboard!C10 & " " & Dashboard!D10 & " " & Dashboard!E10 & " ` +
    `Review the live scores, upcoming schedule, and standings. Provide a conversational, insightful, and grounded brief highlighting the most interesting tactical storylines happening right now. ` +
    `To keep your analysis fresh, review this list of potential analytical angles, pick the 3 most compelling ones based on the current data, and ignore the rest: ` +
    `- UPSET ALERTS: Note any underdogs currently leading or heavy favorites at risk of dropping crucial points. ` +
    `- GOAL DIFFERENCE WATCH: Identify teams that need to actively improve their goal difference or protect a narrow margin for advancement. ` +
    `- 3RD-PLACE TRACKER: Explain how current live scores are affecting the projected point threshold needed to advance as a 3rd-place team. ` +
    `- HIGH-STAKES FIXTURES: Highlight the most consequential upcoming match on the slate and exactly what is on the line. ` +
    `- ELIMINATION RAMIFICATIONS: Identify teams facing immediate elimination or mathematical danger based on live results. ` +
    `- FLUID STANDINGS: Point out the group with the most volatile point distribution right now. ` +
    `- STATISTICAL STANDOUTS: Highlight notable offensive dominance (GF) or defensive resilience (GA). ` +
    `- SPOILER POTENTIAL: Note if an eliminated team is playing a crucial role in deciding another team's tournament fate. ` +
    `- TIEBREAKER WATCH: Call out any groups where teams are deadlocked on points and goal difference. ` +
    `- TIGHTLY CONTESTED GROUPS: Identify the group with the smallest margin between 1st and 4th place. ` +
    `- FORM CHECK: Note any top-tier teams that have safely secured advancement early or are surprisingly struggling at the bottom of their group. ` +
    `Deliver your analysis as a concise, 3-bullet-point executive summary (with a line break between each). Write in a clear, professional, and engaging tone. Avoid extreme hyperbole. Do not announce which angles you chose; simply weave them naturally into your insights. ` +
    `(Internal Token: ${timestamp})", Standings!A1:J83)`;

  // 4. Wipe and write
  targetCell.clearContent();
  SpreadsheetApp.flush();
  targetCell.setFormula(formulaString);
}*/
