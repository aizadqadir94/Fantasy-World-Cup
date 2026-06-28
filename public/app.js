const TEAMS = {
  'Mexico':'🇲🇽','USA':'🇺🇸','United States':'🇺🇸','Canada':'🇨🇦','Brazil':'🇧🇷','Argentina':'🇦🇷',
  'France':'🇫🇷','Spain':'🇪🇸','Germany':'🇩🇪','Netherlands':'🇳🇱','Portugal':'🇵🇹','England':'🦁',
  'Belgium':'🇧🇪','Croatia':'🇭🇷','Morocco':'🇲🇦','Japan':'🇯🇵','South Korea':'🇰🇷','Switzerland':'🇨🇭',
  'Colombia':'🇨🇴','Norway':'🇳🇴','Senegal':'🇸🇳','Ivory Coast':'🇨🇮','Cote dIvoire':'🇨🇮','Egypt':'🇪🇬',
  'Ghana':'🇬🇭','Australia':'🇦🇺','Paraguay':'🇵🇾','Ecuador':'🇪🇨','Uruguay':'🇺🇾','South Africa':'🇿🇦',
  'Bosnia and Herzegovina':'🇧🇦','Bosnia & Herz.':'🇧🇦','Cape Verde':'🇨🇻','Algeria':'🇩🇿','Austria':'🇦🇹',
  'DR Congo':'🇨🇩','Iran':'🇮🇷','Tunisia':'🇹🇳','Iraq':'🇮🇶','Saudi Arabia':'🇸🇦','Panama':'🇵🇦',
  'Sweden':'🇸🇪','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Uzbekistan':'🇺🇿','New Zealand':'🇳🇿','Qatar':'🇶🇦','Jordan':'🇯🇴',
  'Czechia':'🇨🇿','Italy':'🇮🇹','TBD':'⬜'
};
const TEAM_LIST = Object.keys(TEAMS).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a.localeCompare(b));
let STATE = null;
let TAB = 'play';
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
  const fixtures = STATE.fixtures.filter(f => !(f.home === 'TBD' && f.away === 'TBD'));
  let html = `<p class="sub" style="margin:4px 2px 0">Predicting as <b style="color:var(--gold)">${esc(STATE.me.name)}</b>. Enter both scores, then tap Save pick. It also auto-saves after you type.</p>`;
  const byRound = {};
  fixtures.forEach(f => (byRound[f.round] ||= []).push(f));
  Object.keys(byRound).forEach(round => {
    html += `<div class="roundlabel"><span>${esc(round)}</span><div class="ln"></div></div>`;
    byRound[round].forEach(f => html += matchCard(f));
  });
  app.innerHTML = html || '<div class="empty">No fixtures yet.</div>';
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
    btn.onclick = async () => {
      await savePredictionNow(btn.dataset.savePick);
    };
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
  if(h.value === '' || a.value === ''){
    setSaveStatus(fid, 'unsaved', 'Enter both scores');
    return;
  }
  const body = {h:Number(h.value), a:Number(a.value)};
  setSaveStatus(fid, 'saving', 'Saving...');
  const p = api('/api/predictions/' + encodeURIComponent(fid), { method:'PUT', body:JSON.stringify(body) })
    .then(() => {
      STATE.myPredictions[fid] = body;
      setSaveStatus(fid, 'saved', 'Saved');
      const chip = q('#chip-' + CSS.escape(fid));
      if(chip){ chip.classList.add('show'); setTimeout(()=>chip.classList.remove('show'),1300); }
    })
    .catch(async e => {
      setSaveStatus(fid, 'error', 'Not saved — tap Save again');
      toast(e.message);
      await load().catch(()=>{});
    })
    .finally(() => { delete savePromises[fid]; });
  savePromises[fid] = p;
  return p;
}
async function flushPendingSaves(){
  const ids = Array.from(new Set([
    ...Object.keys(saveTimers).filter(k => saveTimers[k]),
    ...qa('.scorein input').map(i => i.dataset.f).filter(Boolean)
  ]));
  for(const id of ids){
    const status = saveState[id];
    const h = q(`input[data-f="${CSS.escape(id)}"][data-s="h"]`);
    const a = q(`input[data-f="${CSS.escape(id)}"][data-s="a"]`);
    if(h && a && h.value !== '' && a.value !== '' && status !== 'saved'){
      await savePredictionNow(id);
    }
  }
  await Promise.all(Object.values(savePromises));
}
function sign(h,a){ return h>a?1:h<a?-1:0; }
function scoreOne(p,f){
  if(!p || f.actualH === null || f.actualA === null) return null;
  if(p.h === f.actualH && p.a === f.actualA) return STATE.settings.winnerPts + STATE.settings.scorelineBonus;
  if(sign(p.h,p.a) === sign(f.actualH,f.actualA)) return STATE.settings.winnerPts;
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
  app.innerHTML = html;
  q('#refresh').onclick = async () => { await load(); toast('Synced'); };
}

function renderRules(){
  app.innerHTML = `<div class="scoring"><h3>How points work</h3>
    <div class="sr"><span>Correct winner <small class="muted">or draw direction</small></span><b>+${STATE.settings.winnerPts}</b></div>
    <div class="sr"><span>Correct scoreline <small class="muted">bonus</small></span><b>+${STATE.settings.scorelineBonus}</b></div>
    <div class="sr"><span>Exact result + scoreline</span><b>+${STATE.settings.winnerPts + STATE.settings.scorelineBonus}</b></div>
    <div class="sr"><span>Wrong winner</span><b>0</b></div></div>
    <div class="hint">Predictions lock when the admin locks the tie or posts the result. The backend blocks edits after lock, so changing the browser code cannot bypass it.</div>
    <div class="codeline">Logged in as <b>${esc(STATE.me.name)}</b></div>
    <div class="switch" id="logout">Log out / switch player</div>`;
  q('#logout').onclick = async () => { try { await api('/api/logout', {method:'POST'}); } catch{} localStorage.removeItem('knockout_token'); await load(); };
}

function renderAdmin(){
  if(!adminPin()){
    app.innerHTML = `<div class="gate"><h2>Admin</h2><p>Enter your admin PIN to manage fixtures, locks, and results.</p><label class="fld">Admin PIN</label><input type="password" id="adminpin" inputmode="numeric"><button class="btn" id="unlockadmin">Unlock admin</button></div>`;
    q('#unlockadmin').onclick = () => { sessionStorage.setItem('knockout_admin_pin', q('#adminpin').value.trim()); renderAdmin(); };
    return;
  }
  let html = `<div class="hint">Admin controls. Lock matches before kickoff, update TBD teams, and post final scores. Admin PIN is checked by the server.</div>
    <div class="grid2" style="margin-bottom:12px"><button class="btn ghost" id="lockall">Lock Round of 32</button><button class="btn ghost" id="unlockall">Unlock Round of 32</button></div>`;
  STATE.fixtures.forEach(f => html += adminCard(f));
  html += `<button class="btn ghost" id="clearadmin">Forget admin PIN on this device</button>`;
  app.innerHTML = html;
  q('#lockall').onclick = () => lockRound(true);
  q('#unlockall').onclick = () => lockRound(false);
  q('#clearadmin').onclick = () => { sessionStorage.removeItem('knockout_admin_pin'); renderAdmin(); };
  qa('[data-admin-save]').forEach(b => b.onclick = () => saveFixture(b.dataset.adminSave));
  qa('[data-admin-lock]').forEach(b => b.onclick = () => lockFixture(b.dataset.adminLock, true));
  qa('[data-admin-unlock]').forEach(b => b.onclick = () => lockFixture(b.dataset.adminUnlock, false));
  qa('[data-admin-result]').forEach(b => b.onclick = () => postResult(b.dataset.adminResult));
  qa('[data-admin-clear]').forEach(b => b.onclick = () => clearResult(b.dataset.adminClear));
}
function teamOptions(selected){ return TEAM_LIST.map(t => `<option value="${esc(t)}" ${t===selected?'selected':''}>${flag(t)} ${esc(t)}</option>`).join(''); }
function adminCard(f){
  const local = f.kickoff ? new Date(f.kickoff).toISOString().slice(0,16) : '';
  return `<div class="adminbox">
    <div class="meta" style="margin-bottom:10px;color:var(--gold-deep)"><span>${esc(f.round)} · ${esc(f.id)}</span><span>${f.actualH!==null?'Result posted':f.locked?'Locked':'Open'}</span></div>
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
async function saveFixture(id){
  const get = k => q(`[data-fx="${CSS.escape(id)}"][data-k="${k}"]`).value;
  const kickoffLocal = get('kickoff');
  const kickoff = kickoffLocal ? new Date(kickoffLocal).toISOString() : '';
  try { await api('/api/admin/fixtures/' + encodeURIComponent(id), {method:'POST', body:JSON.stringify({home:get('home'), away:get('away'), kickoff, venue:get('venue')})}); await load(); toast('Tie saved'); }
  catch(e){ toast(e.message); }
}
async function lockFixture(id, locked){ try { await api(`/api/admin/fixtures/${encodeURIComponent(id)}/lock`, {method:'POST', body:JSON.stringify({locked})}); await load(); toast(locked?'Locked':'Unlocked'); } catch(e){ toast(e.message); } }
async function lockRound(locked){ try { await api('/api/admin/lock-round', {method:'POST', body:JSON.stringify({round:'Round of 32', locked})}); await load(); toast(locked?'Round locked':'Round unlocked'); } catch(e){ toast(e.message); } }
async function postResult(id){
  const h = q(`[data-fx="${CSS.escape(id)}"][data-k="actualH"]`).value;
  const a = q(`[data-fx="${CSS.escape(id)}"][data-k="actualA"]`).value;
  try { await api(`/api/admin/fixtures/${encodeURIComponent(id)}/result`, {method:'POST', body:JSON.stringify({h:Number(h), a:Number(a)})}); await load(); toast('Result posted'); } catch(e){ toast(e.message); }
}
async function clearResult(id){ try { await api(`/api/admin/fixtures/${encodeURIComponent(id)}/result`, {method:'POST', body:JSON.stringify({h:null,a:null})}); await load(); toast('Score cleared'); } catch(e){ toast(e.message); } }
function bindNav(){ qa('.tab').forEach(t => { t.classList.toggle('on', t.dataset.tab === TAB); t.onclick = async () => { if(TAB === 'play') await flushPendingSaves(); TAB = t.dataset.tab; if(TAB !== 'admin') await load(); else render(); }; }); }

load().catch(e => { app.innerHTML = `<div class="empty">Could not load app.<br>${esc(e.message)}</div>`; });
setInterval(() => { if(STATE?.me && TAB === 'board') load().catch(()=>{}); }, 15000);
