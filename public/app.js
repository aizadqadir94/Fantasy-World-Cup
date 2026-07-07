const TEAMS = {
  'Mexico':'🇲🇽','USA':'🇺🇸','United States':'🇺🇸','Canada':'🇨🇦','Brazil':'🇧🇷','Argentina':'🇦🇷',
  'France':'🇫🇷','Spain':'🇪🇸','Germany':'🇩🇪','Netherlands':'🇳🇱','Portugal':'🇵🇹','England':'🦁',
  'Belgium':'🇧🇪','Croatia':'🇭🇷','Morocco':'🇲🇦','Japan':'🇯🇵','South Korea':'🇰🇷','Switzerland':'🇨🇭',
  'Colombia':'🇨🇴','Norway':'🇳🇴','Senegal':'🇸🇳','Ivory Coast':'🇨🇮','Cote dIvoire':'🇨🇮','Egypt':'🇪🇬',
  'Ghana':'🇬🇭','Australia':'🇦🇺','Paraguay':'🇵🇾','Ecuador':'🇪🇨','Uruguay':'🇺🇾','South Africa':'🇿🇦',
  'Bosnia and Herzegovina':'🇧🇦','Bosnia & Herz.':'🇧🇦','Cape Verde':'🇨🇻','Algeria':'🇩🇿','Austria':'🇦🇹',
  'DR Congo':'🇨🇩','Iran':'🇮🇷','Tunisia':'🇹🇳','Iraq':'🇮🇶','Saudi Arabia':'🇸🇦','Panama':'🇵🇦',
  'Sweden':'🇸🇪','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Uzbekistan':'🇺🇿','New Zealand':'🇳🇿','Qatar':'🇶🇦','Jordan':'🇯🇴',
  'Czechia':'🇨🇿','Italy':'🇮🇹','Turkey':'🇹🇷','Curacao':'🇨🇼','Haiti':'🇭🇹','TBD':'⬜'
};
const TEAM_LIST = Object.keys(TEAMS).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a.localeCompare(b));
const ROUND_ORDER = ['Round of 32','Round of 16','Quarter-final','Quarter-final','Quarter-finals','Semi-final','Semi-finals','Third place','Final'];
const ROUND_ADD_OPTIONS = ['Round of 32','Round of 16','Quarter-final','Semi-final','Third place','Final'];
let STATE = null;
let TAB = 'play';
let PLAY_ROUND = localStorage.getItem('knockout_play_round') || '';
let ADMIN_ROUND = localStorage.getItem('knockout_admin_round') || '';
let adminStatus = null;
let adminPicks = null;
let saveTimers = {};
let savePromises = {};
let saveState = {}; // fixture id -> 'saved' | 'saving' | 'error' | 'unsaved'
const app = document.getElementById('app');
const nav = document.getElementById('nav');

function q(s){ return document.querySelector(s); }
function qa(s){ return Array.from(document.querySelectorAll(s)); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function flag(t){ return TEAMS[t] || '🏳️'; }
function token(){ return localStorage.getItem('knockout_token') || ''; }
function adminPin(){ return sessionStorage.getItem('knockout_admin_pin') || ''; }
function toast(msg){ const t=q('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),1900); }
function fmtDate(iso){
  if(!iso) return 'Time TBC';
  try { return new Intl.DateTimeFormat(undefined, { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(iso)); }
  catch { return iso; }
}
function roundRank(round){
  const idx = ROUND_ORDER.findIndex(r => r.toLowerCase() === String(round || '').toLowerCase());
  return idx === -1 ? 999 : idx;
}
function getRounds(fixtures = STATE?.fixtures || []){
  const set = new Set(fixtures.map(f => f.round).filter(Boolean));
  return Array.from(set).sort((a,b) => roundRank(a) - roundRank(b) || a.localeCompare(b));
}
function ensureRound(active, rounds){ return rounds.includes(active) ? active : (rounds[0] || 'Round of 32'); }
function roundTabs(rounds, active, area){
  if(!rounds.length) return '';
  return `<div class="roundtabs">${rounds.map(r => `<button type="button" class="roundtab ${r===active?'on':''}" data-round-area="${area}" data-round="${esc(r)}">${esc(shortRound(r))}</button>`).join('')}</div>`;
}
function shortRound(round){
  const r = String(round || '');
  if(r === 'Round of 32') return 'R32';
  if(r === 'Round of 16') return 'R16';
  if(r.toLowerCase().startsWith('quarter')) return 'QF';
  if(r.toLowerCase().startsWith('semi')) return 'SF';
  if(r === 'Third place') return '3rd';
  if(r === 'Final') return 'Final';
  return r;
}
function scoringForRound(round){
  const settings = STATE?.settings || {};
  return (settings.roundScoring && settings.roundScoring[String(round || '').trim()]) || settings.defaultScoring || { winnerPts: 2, scorelineBonus: 2 };
}
function scoreLabel(round){
  const s = scoringForRound(round);
  return `+${s.winnerPts} winner · +${s.scorelineBonus} exact bonus · max ${s.winnerPts + s.scorelineBonus}`;
}
function bindRoundTabs(){
  qa('[data-round-area]').forEach(btn => {
    btn.onclick = async () => {
      const round = btn.dataset.round;
      if(btn.dataset.roundArea === 'play') { PLAY_ROUND = round; localStorage.setItem('knockout_play_round', round); renderPlay(); bindNav(); }
      if(btn.dataset.roundArea === 'admin') { ADMIN_ROUND = round; localStorage.setItem('knockout_admin_round', round); await Promise.all([loadAdminStatus(round).catch(()=>{}), loadAdminPicks(round).catch(()=>{})]); renderAdmin(); bindNav(); }
    };
  });
}
async function api(path, opts={}){
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
  if(token()) headers.Authorization = 'Bearer ' + token();
  if(adminPin()) headers['x-admin-pin'] = adminPin();
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function load(){ STATE = await api('/api/state'); render(); }

function render(){
  nav.classList.toggle('hide', !STATE?.me);
  if(!STATE?.me) return renderGate();
  if(TAB === 'play') renderPlay();
  else if(TAB === 'board') renderBoard();
  else if(TAB === 'rules') renderRules();
  else renderAdmin();
  bindNav();
}

function renderGate(){
  nav.classList.add('hide');
  app.innerHTML = `
    <div class="gate">
      <h2>Join the league</h2>
      <p>Create your player with a private PIN. Use the same name + PIN later to return from any phone or laptop.</p>
      <label class="fld">Display name</label>
      <input type="text" id="nm" placeholder="e.g. Aizad" maxlength="24" autocomplete="username">
      <label class="fld" style="margin-top:12px">PIN, 4–8 digits</label>
      <input type="password" id="pin" placeholder="Create or enter PIN" inputmode="numeric" maxlength="8" autocomplete="current-password">
      <div class="grid2">
        <button class="btn" id="login">Log in</button>
        <button class="btn ghost" id="register">Create player</button>
      </div>
      <div class="hint">Do not share your PIN. Other players can see the table but cannot edit your picks without it.</div>
    </div>`;
  q('#login').onclick = () => auth('login');
  q('#register').onclick = () => auth('register');
  q('#pin').addEventListener('keydown', e => { if(e.key === 'Enter') auth('login'); });
}
async function auth(mode){
  const name = q('#nm').value.trim();
  const pin = q('#pin').value.trim();
  try {
    const data = await api('/api/' + mode, { method:'POST', body:JSON.stringify({name,pin}) });
    localStorage.setItem('knockout_token', data.token);
    await load();
    toast(mode === 'register' ? 'Player created' : 'Logged in');
  } catch(e){ toast(e.message); }
}

function matchState(f){ if(f.actualH !== null) return 'done'; return f.locked ? 'locked' : 'open'; }
function renderPlay(){
  const rounds = getRounds(STATE.fixtures);
  PLAY_ROUND = ensureRound(PLAY_ROUND, rounds);
  const selected = STATE.fixtures.filter(f => f.round === PLAY_ROUND && !(f.home === 'TBD' && f.away === 'TBD'));
  let html = `<p class="sub" style="margin:4px 2px 0">Predicting as <b style="color:var(--gold)">${esc(STATE.me.name)}</b>. Enter both scores, then tap Save pick. It also auto-saves after you type.</p>`;
  html += roundTabs(rounds, PLAY_ROUND, 'play');
  html += `<div class="roundscore">${esc(PLAY_ROUND)} scoring: ${esc(scoreLabel(PLAY_ROUND))}</div>`;
  if(selected.length){
    html += `<div class="roundlabel"><span>${esc(PLAY_ROUND)}</span><div class="ln"></div></div>`;
    selected.forEach(f => html += matchCard(f));
  } else {
    html += `<div class="empty">${esc(PLAY_ROUND)} is ready, but no teams are set yet.<br>Admin can open the ${esc(shortRound(PLAY_ROUND))} tab and fill the teams manually.</div>`;
  }
  app.innerHTML = html || '<div class="empty">No fixtures yet.</div>';
  bindRoundTabs();
  bindMatchInputs();
}
function matchCard(f){
  const st = matchState(f);
  const p = STATE.myPredictions[f.id];
  const ph = p ? p.h : '';
  const pa = p ? p.a : '';
  const pillText = st === 'done' ? 'Result in' : st === 'locked' ? 'Locked' : 'Open';
  let bottom = '';
  if(st === 'open'){
    bottom = `<div class="scorein">
      <input type="text" inputmode="numeric" maxlength="2" data-f="${esc(f.id)}" data-s="h" value="${esc(ph)}" placeholder="0">
      <span class="dash">–</span>
      <input type="text" inputmode="numeric" maxlength="2" data-f="${esc(f.id)}" data-s="a" value="${esc(pa)}" placeholder="0">
    </div>
    <div class="savebar">
      <span class="savestatus ${p ? 'saved' : ''}" id="status-${esc(f.id)}">${p ? 'Saved' : 'Enter score, then save'}</span>
      <button class="btn sm savepick" data-save-pick="${esc(f.id)}" type="button">Save pick</button>
    </div>`;
  } else if(st === 'done'){
    const pts = scoreOne(p, f);
    const chip = p ? `<span class="pts ${pts>0?'hit':'miss'}">${pts>0?'+'+pts:'0'} pts</span>` : '<span class="pts miss">no pick</span>';
    bottom = `<div class="actual"><span class="muted">Full time</span><span class="res">${f.actualH}–${f.actualA}</span>${chip}</div>`;
    if(p) bottom += `<div class="yourpred">Your call: <b>${ph}–${pa}</b></div>`;
  } else {
    bottom = `<div class="actual"><span class="muted">Predictions closed</span>${p ? `<span class="yourpred" style="margin:0">Your call: <b>${ph}–${pa}</b></span>` : '<span class="pts miss">no pick</span>'}</div>`;
  }
  return `<div class="match ${st}">
    <span class="savechip" id="chip-${esc(f.id)}">Saved ✓</span>
    <div class="meta"><span>${esc(fmtDate(f.kickoff))}${f.venue ? ' · ' + esc(f.venue) : ''}</span><span class="pill ${st}">${pillText}</span></div>
    <div class="pointsline">${esc(scoreLabel(f.round))}</div>
    <div class="teams">
      <div class="team"><span class="flag">${flag(f.home)}</span><span class="tname">${esc(f.home)}</span></div>
      <span class="vs">v</span>
      <div class="team away"><span class="flag">${flag(f.away)}</span><span class="tname">${esc(f.away)}</span></div>
    </div>${bottom}</div>`;
}
function bindMatchInputs(){
  qa('.scorein input').forEach(inp => {
    inp.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/[^0-9]/g,'').slice(0,2);
      setSaveStatus(e.target.dataset.f, 'unsaved', 'Not saved yet');
      queueSave(e.target.dataset.f);
    });
    inp.addEventListener('blur', e => queueSave(e.target.dataset.f, 0));
  });
  qa('[data-save-pick]').forEach(btn => {
    btn.onclick = async () => { await savePredictionNow(btn.dataset.savePick); };
  });
}
function setSaveStatus(fid, cls, text){
  saveState[fid] = cls;
  const el = q('#status-' + CSS.escape(fid));
  if(!el) return;
  el.className = 'savestatus ' + cls;
  el.textContent = text;
}
function queueSave(fid, delay=500){
  clearTimeout(saveTimers[fid]);
  saveTimers[fid] = setTimeout(() => savePredictionNow(fid), delay);
}
async function savePredictionNow(fid){
  clearTimeout(saveTimers[fid]);
  const h = q(`input[data-f="${CSS.escape(fid)}"][data-s="h"]`);
  const a = q(`input[data-f="${CSS.escape(fid)}"][data-s="a"]`);
  if(!h || !a) return;
  if(h.value === '' || a.value === ''){ setSaveStatus(fid, 'unsaved', 'Enter both scores'); return; }
  const body = {h:Number(h.value), a:Number(a.value)};
  setSaveStatus(fid, 'saving', 'Saving...');
  const p = api('/api/predictions/' + encodeURIComponent(fid), { method:'PUT', body:JSON.stringify(body) })
    .then(() => {
      STATE.myPredictions[fid] = body;
      setSaveStatus(fid, 'saved', 'Saved');
      const chip = q('#chip-' + CSS.escape(fid));
      if(chip){ chip.classList.add('show'); setTimeout(()=>chip.classList.remove('show'),1300); }
    })
    .catch(async e => { setSaveStatus(fid, 'error', 'Not saved — tap Save again'); toast(e.message); await load().catch(()=>{}); })
    .finally(() => { delete savePromises[fid]; });
  savePromises[fid] = p;
  return p;
}
async function flushPendingSaves(){
  const ids = Array.from(new Set([...Object.keys(saveTimers).filter(k => saveTimers[k]), ...qa('.scorein input').map(i => i.dataset.f).filter(Boolean)]));
  for(const id of ids){
    const status = saveState[id];
    const h = q(`input[data-f="${CSS.escape(id)}"][data-s="h"]`);
    const a = q(`input[data-f="${CSS.escape(id)}"][data-s="a"]`);
    if(h && a && h.value !== '' && a.value !== '' && status !== 'saved') await savePredictionNow(id);
  }
  await Promise.all(Object.values(savePromises));
}
function sign(h,a){ return h>a?1:h<a?-1:0; }
function scoreOne(p,f){
  if(!p || f.actualH === null || f.actualA === null) return null;
  const pts = scoringForRound(f.round);
  if(p.h === f.actualH && p.a === f.actualA) return pts.winnerPts + pts.scorelineBonus;
  if(sign(p.h,p.a) === sign(f.actualH,f.actualA)) return pts.winnerPts;
  return 0;
}

function renderBoard(){
  const settled = STATE.fixtures.filter(f => f.actualH !== null).length;
  let html = `<div class="roundlabel"><span>Standings</span><div class="ln"></div></div><p class="sub" style="margin:-4px 2px 14px">${settled} results counted · ${STATE.leaderboard.length} players</p>`;
  if(!STATE.leaderboard.length) html += '<div class="empty">No players yet.</div>';
  STATE.leaderboard.forEach((r,i) => {
    const rank = i + 1;
    html += `<div class="lbrow ${r.id===STATE.me.id?'me':''}"><div class="rank ${rank<=3?'r'+rank:''}">${rank}</div><div class="lbname">${esc(r.name)}${r.id===STATE.me.id ? '<small>you</small>' : `<small>${r.exact} exact ${r.exact===1?'score':'scores'}</small>`}</div><div class="lbpts">${r.pts}<small> pts</small></div></div>`;
  });
  html += '<button class="btn ghost" id="refresh">Refresh table</button>';
  html += '<div class="hint" style="margin-top:14px">Player scorelines are not shown in the Table tab. Only the admin can view submitted scorelines in Admin → Admin scorelines.</div>';
  app.innerHTML = html;
  q('#refresh').onclick = async () => { await load(); renderBoard(); toast('Synced'); };
}

function renderRules(){
  const rows = [
    ['Round of 32', 'R32'],
    ['Round of 16', 'R16'],
    ['Quarter-final', 'QF'],
    ['Semi-final', 'SF'],
    ['Third place', '3rd'],
    ['Final', 'Final']
  ];
  let scoreRows = rows.map(([round, label]) => {
    const s = scoringForRound(round);
    return `<div class="sr"><span>${esc(label)} <small class="muted">winner + exact bonus</small></span><b>${s.winnerPts} + ${s.scorelineBonus} = ${s.winnerPts + s.scorelineBonus}</b></div>`;
  }).join('');
  app.innerHTML = `<div class="scoring"><h3>How points work</h3>
    ${scoreRows}
    <div class="sr"><span>Wrong winner</span><b>0</b></div></div>
    <div class="hint">Round of 16 uses <b>+3 for correct winner/draw direction</b> and <b>+2 exact-score bonus</b>, so an exact R16 prediction is worth <b>5 points</b>. Quarter-final uses <b>+3 for correct winner/draw direction</b> and <b>+3 exact-score bonus</b>, so an exact QF prediction is worth <b>6 points</b>. Predictions lock when the admin locks the tie or posts the result. The backend blocks edits after lock, so changing browser code cannot bypass it.</div>
    <div class="codeline">Logged in as <b>${esc(STATE.me.name)}</b></div>
    <div class="switch" id="logout">Log out / switch player</div>`;
  q('#logout').onclick = async () => { try { await api('/api/logout', {method:'POST'}); } catch{} localStorage.removeItem('knockout_token'); await load(); };
}


async function loadAdminStatus(round = ADMIN_ROUND){
  adminStatus = await api('/api/admin/status?round=' + encodeURIComponent(round));
  return adminStatus;
}
async function loadAdminPicks(round = ADMIN_ROUND){
  adminPicks = await api('/api/admin/picks?round=' + encodeURIComponent(round));
  return adminPicks;
}
function renderAdmin(){
  if(!adminPin()){
    app.innerHTML = `<div class="gate"><h2>Admin</h2><p>Enter your admin PIN to manage fixtures, locks, results, prediction status, and players.</p><label class="fld">Admin PIN</label><input type="password" id="adminpin" inputmode="numeric"><button class="btn" id="unlockadmin">Unlock admin</button></div>`;
    q('#unlockadmin').onclick = async () => { sessionStorage.setItem('knockout_admin_pin', q('#adminpin').value.trim()); await Promise.all([loadAdminStatus(ADMIN_ROUND).catch(e=>toast(e.message)), loadAdminPicks(ADMIN_ROUND).catch(e=>toast(e.message))]); renderAdmin(); };
    return;
  }
  const rounds = getRounds(STATE.fixtures);
  ADMIN_ROUND = ensureRound(ADMIN_ROUND, rounds);
  const selectedFixtures = STATE.fixtures.filter(f => f.round === ADMIN_ROUND);
  if(!adminStatus || adminStatus.round !== ADMIN_ROUND){ loadAdminStatus(ADMIN_ROUND).then(()=>render()).catch(e=>toast(e.message)); }
  if(!adminPicks || adminPicks.round !== ADMIN_ROUND){ loadAdminPicks(ADMIN_ROUND).then(()=>render()).catch(e=>toast(e.message)); }
  let html = `<div class="hint">Admin controls. Use the round tabs so you do not need to scroll through old rounds. Round of 16 has 8 placeholder ties ready and Quarter-final has 4 placeholder ties ready; fill teams manually and tap Save tie. The admin-only scorelines section shows every submitted pick, including open and past matches.</div>`;
  html += roundTabs(rounds, ADMIN_ROUND, 'admin');
  html += `<div class="grid2" style="margin-bottom:12px"><button class="btn ghost" id="lockround">Lock ${esc(shortRound(ADMIN_ROUND))}</button><button class="btn ghost" id="unlockround">Unlock ${esc(shortRound(ADMIN_ROUND))}</button></div>`;
  html += renderAdminStatus();
  html += renderAdminPicks();
  html += renderAddFixture();
  html += `<div class="roundlabel"><span>${esc(ADMIN_ROUND)} fixtures</span><div class="ln"></div></div>`;
  selectedFixtures.forEach(f => html += adminCard(f));
  if(!selectedFixtures.length) html += '<div class="empty">No fixtures in this round yet. Use Add fixture above.</div>';
  html += `<button class="btn ghost" id="clearadmin">Forget admin PIN on this device</button>`;
  app.innerHTML = html;
  bindRoundTabs();
  q('#lockround').onclick = () => lockRound(ADMIN_ROUND, true);
  q('#unlockround').onclick = () => lockRound(ADMIN_ROUND, false);
  q('#clearadmin').onclick = () => { sessionStorage.removeItem('knockout_admin_pin'); adminStatus=null; adminPicks=null; renderAdmin(); };
  q('#addfixture').onclick = () => addFixture();
  qa('[data-admin-save]').forEach(b => b.onclick = () => saveFixture(b.dataset.adminSave));
  qa('[data-admin-lock]').forEach(b => b.onclick = () => lockFixture(b.dataset.adminLock, true));
  qa('[data-admin-unlock]').forEach(b => b.onclick = () => lockFixture(b.dataset.adminUnlock, false));
  qa('[data-admin-result]').forEach(b => b.onclick = () => postResult(b.dataset.adminResult));
  qa('[data-admin-clear]').forEach(b => b.onclick = () => clearResult(b.dataset.adminClear));
  qa('[data-remove-player]').forEach(b => b.onclick = () => removePlayer(b.dataset.removePlayer, b.dataset.playerName));
  qa('[data-admin-pick-save]').forEach(b => b.onclick = () => adminSavePick(b.dataset.fixtureId, b.dataset.playerId, b.dataset.playerName));
  qa('[data-admin-pick-clear]').forEach(b => b.onclick = () => adminClearPick(b.dataset.fixtureId, b.dataset.playerId, b.dataset.playerName));
  qa('[data-pick-input]').forEach(i => i.addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g,'').slice(0,2); }));
}
function renderAdminStatus(){
  if(!adminStatus) return `<div class="panel compact"><h2>Prediction Status</h2><p>Loading status...</p></div>`;
  let html = `<div class="panel compact"><h2>Prediction Status</h2><p>${esc(ADMIN_ROUND)} · ${adminStatus.totalFixtures} visible fixtures</p>`;
  if(!adminStatus.rows.length) html += '<div class="empty small">No players yet.</div>';
  adminStatus.rows.forEach(r => {
    const done = r.total && r.made === r.total;
    html += `<div class="statusrow ${done?'complete':'missing'}">
      <div class="statusmain"><b>${esc(r.name)}</b><small>${r.made}/${r.total} picks${r.missing.length ? ' · missing ' + r.missing.length : ' · complete'}</small></div>
      <button class="btn sm danger" data-remove-player="${esc(r.id)}" data-player-name="${esc(r.name)}" type="button">Remove</button>
    </div>`;
    if(r.missing.length){
      html += `<div class="missinglist">${r.missing.slice(0,5).map(m => esc(m.label)).join('<br>')}${r.missing.length>5?'<br>…':''}</div>`;
    }
  });
  html += `<button class="btn ghost" id="refreshstatus" type="button">Refresh status</button></div>`;
  setTimeout(() => { const b=q('#refreshstatus'); if(b) b.onclick = async () => { await loadAdminStatus(ADMIN_ROUND); renderAdmin(); toast('Status refreshed'); }; }, 0);
  return html;
}
function renderAdminPicks(){
  if(!adminPicks) return `<div class="panel compact"><h2>Admin scorelines</h2><p>Loading submitted scorelines...</p></div>`;
  let html = `<div class="panel compact adminpicks"><h2>Admin scorelines</h2><p>${esc(ADMIN_ROUND)} · admin-only view. You can view, edit, or clear any player pick here. Timestamps are hidden.</p>`;
  if(!adminPicks.rows.length){
    html += '<div class="empty small">No fixtures in this round yet.</div>';
  } else {
    adminPicks.rows.forEach(f => {
      const status = f.actualH !== null ? `Result ${f.actualH}–${f.actualA}` : f.locked ? 'Locked' : 'Open';
      html += `<div class="pickmatch adminpickmatch"><div class="pickhead"><b>${flag(f.home)} ${esc(f.home)} v ${esc(f.away)} ${flag(f.away)}</b><small>${esc(fmtDate(f.kickoff))} · ${esc(status)}</small></div>`;
      f.predictions.forEach(p => {
        const hVal = p.submitted ? p.h : '';
        const aVal = p.submitted ? p.a : '';
        let current = '<span class="missingtxt">No pick</span>';
        if(p.submitted){
          const pts = p.points === null || p.points === undefined ? '' : `<small class="pickpoints">${p.points > 0 ? '+' + p.points : '0'} pts</small>`;
          current = `<b>${p.h}–${p.a}</b>${pts}`;
        }
        html += `<div class="pickrow editpickrow">
          <span>${esc(p.name)}</span>
          <span class="adminpickcell">
            <span class="currentpick">${current}</span>
            <span class="adminpickedit">
              <input type="text" inputmode="numeric" data-pick-input data-pick-fixture="${esc(f.id)}" data-pick-player="${esc(p.playerId)}" data-side="h" value="${esc(hVal)}" placeholder="H" maxlength="2">
              <span class="dash">–</span>
              <input type="text" inputmode="numeric" data-pick-input data-pick-fixture="${esc(f.id)}" data-pick-player="${esc(p.playerId)}" data-side="a" value="${esc(aVal)}" placeholder="A" maxlength="2">
              <button class="btn sm" type="button" data-admin-pick-save="1" data-fixture-id="${esc(f.id)}" data-player-id="${esc(p.playerId)}" data-player-name="${esc(p.name)}">Save</button>
              <button class="btn sm ghost" type="button" data-admin-pick-clear="1" data-fixture-id="${esc(f.id)}" data-player-id="${esc(p.playerId)}" data-player-name="${esc(p.name)}">Clear</button>
            </span>
          </span>
        </div>`;
      });
      html += '</div>';
    });
  }
  html += `<button class="btn ghost" id="refreshadminpicks" type="button">Refresh scorelines</button></div>`;
  setTimeout(() => { const b=q('#refreshadminpicks'); if(b) b.onclick = async () => { await loadAdminPicks(ADMIN_ROUND); renderAdmin(); toast('Scorelines refreshed'); }; }, 0);
  return html;
}
function renderAddFixture(){
  return `<div class="adminbox"><div class="meta" style="margin-bottom:10px;color:var(--gold-deep)"><span>Add fixture</span><span>${esc(ADMIN_ROUND)}</span></div>
    <label class="fld">Round</label><select id="newround" style="margin-bottom:9px">${ROUND_ADD_OPTIONS.map(r => `<option value="${esc(r)}" ${r===ADMIN_ROUND?'selected':''}>${esc(r)}</option>`).join('')}</select>
    <div class="selrow"><select id="newhome">${teamOptions('TBD')}</select><select id="newaway">${teamOptions('TBD')}</select></div>
    <label class="fld">Kickoff</label><input type="datetime-local" id="newkickoff" style="margin-bottom:9px">
    <label class="fld">Venue</label><input type="text" id="newvenue" placeholder="Venue" style="margin-bottom:10px">
    <button class="btn" id="addfixture" type="button">Add fixture</button></div>`;
}
function teamOptions(selected){ return TEAM_LIST.map(t => `<option value="${esc(t)}" ${t===selected?'selected':''}>${flag(t)} ${esc(t)}</option>`).join(''); }
function roundSelect(selected){ return ROUND_ADD_OPTIONS.map(r => `<option value="${esc(r)}" ${r===selected?'selected':''}>${esc(r)}</option>`).join(''); }
function adminCard(f){
  const local = f.kickoff ? new Date(f.kickoff).toISOString().slice(0,16) : '';
  return `<div class="adminbox">
    <div class="meta" style="margin-bottom:10px;color:var(--gold-deep)"><span>${esc(f.round)} · ${esc(f.id)}</span><span>${f.actualH!==null?'Result posted':f.locked?'Locked':'Open'}</span></div>
    <div class="pointsline adminpoints">${esc(scoreLabel(f.round))}</div>
    <label class="fld">Round</label><select data-fx="${esc(f.id)}" data-k="round" style="margin-bottom:9px">${roundSelect(f.round)}</select>
    <div class="selrow"><select data-fx="${esc(f.id)}" data-k="home">${teamOptions(f.home)}</select><select data-fx="${esc(f.id)}" data-k="away">${teamOptions(f.away)}</select></div>
    <label class="fld">Kickoff</label><input type="datetime-local" data-fx="${esc(f.id)}" data-k="kickoff" value="${esc(local)}" style="margin-bottom:9px">
    <label class="fld">Venue</label><input type="text" data-fx="${esc(f.id)}" data-k="venue" value="${esc(f.venue || '')}" placeholder="Venue" style="margin-bottom:10px">
    <div class="grid3"><input type="text" inputmode="numeric" class="num" data-fx="${esc(f.id)}" data-k="actualH" value="${f.actualH ?? ''}" placeholder="–"><span class="dash">–</span><input type="text" inputmode="numeric" class="num" data-fx="${esc(f.id)}" data-k="actualA" value="${f.actualA ?? ''}" placeholder="–"></div>
    <div style="display:flex;gap:8px;margin-top:11px;flex-wrap:wrap">
      <button class="btn sm" data-admin-save="${esc(f.id)}">Save tie</button>
      <button class="btn sm ghost" data-admin-lock="${esc(f.id)}">Lock</button>
      <button class="btn sm ghost" data-admin-unlock="${esc(f.id)}">Unlock</button>
      <button class="btn sm ghost" data-admin-result="${esc(f.id)}">Post result</button>
      <button class="btn sm ghost" data-admin-clear="${esc(f.id)}">Clear score</button>
    </div></div>`;
}
async function addFixture(){
  const kickoffLocal = q('#newkickoff').value;
  const kickoff = kickoffLocal ? new Date(kickoffLocal).toISOString() : '';
  const body = { round:q('#newround').value, home:q('#newhome').value, away:q('#newaway').value, kickoff, venue:q('#newvenue').value };
  try { await api('/api/admin/fixtures', {method:'POST', body:JSON.stringify(body)}); ADMIN_ROUND = body.round; localStorage.setItem('knockout_admin_round', ADMIN_ROUND); await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND); toast('Fixture added'); }
  catch(e){ toast(e.message); }
}
async function saveFixture(id){
  const get = k => q(`[data-fx="${CSS.escape(id)}"][data-k="${k}"]`).value;
  const kickoffLocal = get('kickoff');
  const kickoff = kickoffLocal ? new Date(kickoffLocal).toISOString() : '';
  try { await api('/api/admin/fixtures/' + encodeURIComponent(id), {method:'POST', body:JSON.stringify({round:get('round'), home:get('home'), away:get('away'), kickoff, venue:get('venue')})}); ADMIN_ROUND=get('round'); localStorage.setItem('knockout_admin_round', ADMIN_ROUND); await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND); toast('Tie saved'); }
  catch(e){ toast(e.message); }
}
async function lockFixture(id, locked){ try { await api(`/api/admin/fixtures/${encodeURIComponent(id)}/lock`, {method:'POST', body:JSON.stringify({locked})}); await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND); toast(locked?'Locked':'Unlocked'); } catch(e){ toast(e.message); } }
async function lockRound(round, locked){ try { await api('/api/admin/lock-round', {method:'POST', body:JSON.stringify({round, locked})}); await load(); await loadAdminStatus(round); await loadAdminPicks(round); toast(locked?'Round locked':'Round unlocked'); } catch(e){ toast(e.message); } }
async function postResult(id){
  const h = q(`[data-fx="${CSS.escape(id)}"][data-k="actualH"]`).value;
  const a = q(`[data-fx="${CSS.escape(id)}"][data-k="actualA"]`).value;
  try { await api(`/api/admin/fixtures/${encodeURIComponent(id)}/result`, {method:'POST', body:JSON.stringify({h:Number(h), a:Number(a)})}); await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND); toast('Result posted'); } catch(e){ toast(e.message); }
}
async function clearResult(id){ try { await api(`/api/admin/fixtures/${encodeURIComponent(id)}/result`, {method:'POST', body:JSON.stringify({h:null,a:null})}); await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND); toast('Score cleared'); } catch(e){ toast(e.message); } }
async function adminSavePick(fixtureId, playerId, playerName){
  const hEl = q(`[data-pick-fixture="${CSS.escape(fixtureId)}"][data-pick-player="${CSS.escape(playerId)}"][data-side="h"]`);
  const aEl = q(`[data-pick-fixture="${CSS.escape(fixtureId)}"][data-pick-player="${CSS.escape(playerId)}"][data-side="a"]`);
  const h = hEl ? hEl.value.trim() : '';
  const a = aEl ? aEl.value.trim() : '';
  if(h === '' || a === '') { toast('Enter both scores first'); return; }
  try {
    await api(`/api/admin/predictions/${encodeURIComponent(fixtureId)}/${encodeURIComponent(playerId)}`, {method:'PUT', body:JSON.stringify({h:Number(h), a:Number(a)})});
    await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND);
    renderAdmin(); toast(`Saved ${playerName}`);
  } catch(e){ toast(e.message); }
}
async function adminClearPick(fixtureId, playerId, playerName){
  if(!confirm(`Clear ${playerName}'s pick for this match?`)) return;
  try {
    await api(`/api/admin/predictions/${encodeURIComponent(fixtureId)}/${encodeURIComponent(playerId)}`, {method:'DELETE'});
    await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND);
    renderAdmin(); toast(`Cleared ${playerName}`);
  } catch(e){ toast(e.message); }
}
async function removePlayer(id, name){
  if(!confirm(`Remove ${name}? This deletes their player login and all their predictions.`)) return;
  try { await api('/api/admin/players/' + encodeURIComponent(id), {method:'DELETE'}); await load(); await loadAdminStatus(ADMIN_ROUND); await loadAdminPicks(ADMIN_ROUND); toast('Player removed'); }
  catch(e){ toast(e.message); }
}
function bindNav(){ qa('.tab').forEach(t => { t.classList.toggle('on', t.dataset.tab === TAB); t.onclick = async () => { if(TAB === 'play') await flushPendingSaves(); TAB = t.dataset.tab; if(TAB !== 'admin') await load(); else render(); }; }); }

load().catch(e => { app.innerHTML = `<div class="empty">Could not load app.<br>${esc(e.message)}</div>`; });
setInterval(() => { if(STATE?.me && TAB === 'board') load().catch(()=>{}); }, 15000);
