const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'admin1234';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ROUND_SCORING = {
  'Round of 32': { winnerPts: 2, scorelineBonus: 2 },
  'Round of 16': { winnerPts: 3, scorelineBonus: 2 },
  'Quarter-final': { winnerPts: 4, scorelineBonus: 2 },
  'Quarter-finals': { winnerPts: 4, scorelineBonus: 2 },
  'Semi-final': { winnerPts: 5, scorelineBonus: 2 },
  'Semi-finals': { winnerPts: 5, scorelineBonus: 2 },
  'Third place': { winnerPts: 3, scorelineBonus: 2 },
  'Final': { winnerPts: 6, scorelineBonus: 3 }
};
const DEFAULT_SCORING = { winnerPts: 2, scorelineBonus: 2 };
const SETTINGS = { defaultScoring: DEFAULT_SCORING, roundScoring: ROUND_SCORING };

function scoringForRound(round) {
  return ROUND_SCORING[String(round || '').trim()] || DEFAULT_SCORING;
}

function starterFixtures() {
  return [
    fx('53452545','Round of 32','South Africa','Canada','2026-06-28T19:00:00.000Z','Los Angeles Stadium · Inglewood, CA'),
    fx('53452557','Round of 32','Brazil','Japan','2026-06-29T17:00:00.000Z','Houston Stadium · Houston, TX'),
    fx('53452541','Round of 32','Germany','Paraguay','2026-06-29T20:30:00.000Z','Boston Stadium · Foxborough, MA'),
    fx('53452547','Round of 32','Netherlands','Morocco','2026-06-30T01:00:00.000Z','Estadio Monterrey · Guadalupe'),
    fx('53452561','Round of 32','Ivory Coast','Norway','2026-06-30T17:00:00.000Z','Dallas Stadium · Arlington, TX'),
    fx('53452543','Round of 32','France','Sweden','2026-06-30T21:00:00.000Z','New York New Jersey Stadium · East Rutherford, NJ'),
    fx('53452563','Round of 32','Mexico','Ecuador','2026-07-01T01:00:00.000Z','Mexico City Stadium · Mexico City'),
    fx('53452565','Round of 32','England','TBD','2026-07-01T16:00:00.000Z','Atlanta Stadium · Atlanta, GA'),
    fx('53452555','Round of 32','Belgium','TBD','2026-07-01T20:00:00.000Z',''),
    fx('53452553','Round of 32','United States','Bosnia and Herzegovina','2026-07-02T00:00:00.000Z',''),
    fx('53452551','Round of 32','Spain','TBD','2026-07-02T19:00:00.000Z',''),
    fx('53452549','Round of 32','TBD','TBD','2026-07-02T23:00:00.000Z',''),
    fx('53452505','Round of 32','Switzerland','TBD','2026-07-03T03:00:00.000Z',''),
    fx('53452503','Round of 32','Australia','Egypt','2026-07-03T18:00:00.000Z',''),
    fx('53452569','Round of 32','Argentina','Cape Verde','2026-07-03T22:00:00.000Z',''),
    fx('53452507','Round of 32','TBD','TBD','2026-07-04T01:30:00.000Z','')
  ];
}
function roundOf16Fixtures() {
  return [
    fx('r16-1','Round of 16','TBD','TBD','','R16 placeholder 1'),
    fx('r16-2','Round of 16','TBD','TBD','','R16 placeholder 2'),
    fx('r16-3','Round of 16','TBD','TBD','','R16 placeholder 3'),
    fx('r16-4','Round of 16','TBD','TBD','','R16 placeholder 4'),
    fx('r16-5','Round of 16','TBD','TBD','','R16 placeholder 5'),
    fx('r16-6','Round of 16','TBD','TBD','','R16 placeholder 6'),
    fx('r16-7','Round of 16','TBD','TBD','','R16 placeholder 7'),
    fx('r16-8','Round of 16','TBD','TBD','','R16 placeholder 8')
  ];
}
function coreFixtures() {
  return [...starterFixtures(), ...roundOf16Fixtures()];
}
function fx(id, round, home, away, kickoff, venue) {
  return { id, round, home, away, kickoff, venue, locked: false, actual_h: null, actual_a: null };
}
function toFixture(row) {
  return {
    id: row.id,
    round: row.round,
    home: row.home,
    away: row.away,
    kickoff: row.kickoff,
    venue: row.venue || '',
    locked: Boolean(row.locked),
    actualH: row.actual_h,
    actualA: row.actual_a
  };
}
function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
}
function validPin(pin) {
  return /^\d{4,8}$/.test(String(pin || ''));
}
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(pin), salt + SESSION_SECRET, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}
function verifyPin(pin, salt, expected) {
  const actual = hashPin(pin, salt).hash;
  try { return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
  catch { return false; }
}
function makeToken() { return crypto.randomBytes(24).toString('hex'); }
function publicPlayer(p) { return { id: p.id, name: p.name, createdAt: p.created_at || p.createdAt }; }
function isAdmin(req) { return String(req.headers['x-admin-pin'] || '') === String(ADMIN_PIN); }
function sign(h, a) { return h > a ? 1 : h < a ? -1 : 0; }
function scoreOne(pred, fixture) {
  if (!pred || fixture.actualH === null || fixture.actualA === null) return null;
  const pts = scoringForRound(fixture.round);
  if (pred.h === fixture.actualH && pred.a === fixture.actualA) return pts.winnerPts + pts.scorelineBonus;
  if (sign(pred.h, pred.a) === sign(fixture.actualH, fixture.actualA)) return pts.winnerPts;
  return 0;
}
function requireDb(res) {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render.' });
    return false;
  }
  return true;
}
async function dbSelect(table, columns='*') {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw error;
  return data || [];
}
async function getFixtures() {
  const { data, error } = await supabase.from('fixtures').select('*').order('kickoff', { ascending: true });
  if (error) throw error;
  return (data || []).map(toFixture);
}
async function getPlayers() {
  return await dbSelect('players', '*');
}
async function getPlayerByName(name) {
  const { data, error } = await supabase.from('players').select('*').ilike('name', name).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
async function getPredictionsForPlayer(playerId) {
  const { data, error } = await supabase.from('predictions').select('*').eq('player_id', playerId);
  if (error) throw error;
  const out = {};
  for (const p of data || []) out[p.fixture_id] = { h: p.h, a: p.a, updatedAt: p.updated_at };
  return out;
}
async function getAllPredictions() {
  const rows = await dbSelect('predictions', '*');
  const out = {};
  for (const p of rows) {
    if (!out[p.player_id]) out[p.player_id] = {};
    out[p.player_id][p.fixture_id] = { h: p.h, a: p.a, updatedAt: p.updated_at };
  }
  return out;
}
async function auth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: sess, error: sessErr } = await supabase.from('sessions').select('*').eq('token', token).maybeSingle();
  if (sessErr) throw sessErr;
  if (!sess) return null;
  const { data: player, error: playerErr } = await supabase.from('players').select('*').eq('id', sess.player_id).maybeSingle();
  if (playerErr) throw playerErr;
  if (!player) return null;
  return { token, player };
}
async function leaderboard() {
  const [players, fixtures, predictions] = await Promise.all([getPlayers(), getFixtures(), getAllPredictions()]);
  return players.map(p => {
    const pp = predictions[p.id] || {};
    let pts = 0, exact = 0, counted = 0;
    for (const f of fixtures) {
      const s = scoreOne(pp[f.id], f);
      if (s !== null) { counted++; pts += s; }
      if (pp[f.id] && f.actualH !== null && pp[f.id].h === f.actualH && pp[f.id].a === f.actualA) exact++;
    }
    return { id: p.id, name: p.name, pts, exact, counted };
  }).sort((a, b) => b.pts - a.pts || b.exact - a.exact || a.name.localeCompare(b.name));
}
async function seedFixturesIfEmpty() {
  if (!supabase) return;
  const { data, error } = await supabase.from('fixtures').select('id');
  if (error) {
    console.error('Could not check fixtures table. Did you run supabase_schema.sql?', error.message);
    return;
  }
  const existing = new Set((data || []).map(r => r.id));
  const missing = coreFixtures().filter(f => !existing.has(f.id));
  if (missing.length) {
    const { error: insertError } = await supabase.from('fixtures').insert(missing);
    if (insertError) console.error('Could not seed missing fixtures:', insertError.message);
    else console.log(`Seeded ${missing.length} missing fixture(s) in Supabase.`);
  }
}

app.get('/api/health', async (req, res) => {
  if (!requireDb(res)) return;
  res.json({ ok: true, storage: 'supabase' });
});

app.get('/api/state', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const user = await auth(req);
    const [fixtures, board] = await Promise.all([getFixtures(), leaderboard()]);
    const preds = user ? await getPredictionsForPlayer(user.player.id) : {};
    res.json({
      fixtures,
      settings: SETTINGS,
      me: user ? publicPlayer(user.player) : null,
      myPredictions: preds,
      leaderboard: board,
      serverTime: new Date().toISOString()
    });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not load state.' }); }
});

app.post('/api/register', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const name = normalizeName(req.body.name);
    const pin = String(req.body.pin || '');
    if (!name) return res.status(400).json({ error: 'Enter a display name.' });
    if (!validPin(pin)) return res.status(400).json({ error: 'PIN must be 4 to 8 digits.' });
    const taken = await getPlayerByName(name);
    if (taken) return res.status(409).json({ error: 'This name already exists. Log in with the PIN, or choose another name.' });
    const id = 'p_' + crypto.randomBytes(8).toString('hex');
    const hp = hashPin(pin);
    const player = { id, name, pin_salt: hp.salt, pin_hash: hp.hash, created_at: new Date().toISOString() };
    const { error: insertError } = await supabase.from('players').insert(player);
    if (insertError) throw insertError;
    const token = makeToken();
    const { error: sessError } = await supabase.from('sessions').insert({ token, player_id: id, created_at: new Date().toISOString() });
    if (sessError) throw sessError;
    res.json({ token, me: publicPlayer(player) });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not create player.' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const name = normalizeName(req.body.name);
    const pin = String(req.body.pin || '');
    const player = await getPlayerByName(name);
    if (!player || !verifyPin(pin, player.pin_salt, player.pin_hash)) return res.status(401).json({ error: 'Wrong name or PIN.' });
    const token = makeToken();
    const { error } = await supabase.from('sessions').insert({ token, player_id: player.id, created_at: new Date().toISOString() });
    if (error) throw error;
    res.json({ token, me: publicPlayer(player) });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not log in.' }); }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token) await supabase.from('sessions').delete().eq('token', token);
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

app.put('/api/predictions/:fixtureId', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const user = await auth(req);
    if (!user) return res.status(401).json({ error: 'Log in first.' });
    const fixtures = await getFixtures();
    const fixture = fixtures.find(f => f.id === req.params.fixtureId);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found.' });
    if (fixture.locked || fixture.actualH !== null) return res.status(423).json({ error: 'This match is locked.' });
    const h = Number(req.body.h), a = Number(req.body.a);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 30 || a > 30) return res.status(400).json({ error: 'Enter valid scores.' });
    const row = { player_id: user.player.id, fixture_id: fixture.id, h, a, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('predictions').upsert(row, { onConflict: 'player_id,fixture_id' });
    if (error) throw error;
    res.json({ ok: true, prediction: { h, a, updatedAt: row.updated_at } });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not save prediction.' }); }
});



app.get('/api/picks', async (req, res) => {
  res.status(403).json({ error: 'Prediction scorelines are admin-only.' });
});


app.get('/api/admin/picks', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const round = String(req.query.round || '').trim();
    const [players, fixtures, predictions] = await Promise.all([getPlayers(), getFixtures(), getAllPredictions()]);
    const cleanPlayers = players.map(publicPlayer).sort((a,b) => a.name.localeCompare(b.name));
    const cleanFixtures = fixtures.filter(f => {
      if (round && f.round !== round) return false;
      return !(f.home === 'TBD' && f.away === 'TBD');
    });
    const rows = cleanFixtures.map(f => ({
      id: f.id,
      round: f.round,
      home: f.home,
      away: f.away,
      kickoff: f.kickoff,
      venue: f.venue,
      locked: f.locked,
      actualH: f.actualH,
      actualA: f.actualA,
      predictions: cleanPlayers.map(p => {
        const pred = (predictions[p.id] || {})[f.id];
        const base = { playerId: p.id, name: p.name, submitted: Boolean(pred) };
        if (!pred) return base;
        const points = scoreOne(pred, f);
        return Object.assign(base, { h: pred.h, a: pred.a, updatedAt: pred.updatedAt, points });
      })
    }));
    res.json({ ok: true, round, players: cleanPlayers, rows });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not load admin picks.' }); }
});

app.post('/api/admin/fixtures', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const id = 'fx_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
    const row = {
      id,
      round: String(req.body.round || 'Round of 16').trim(),
      home: String(req.body.home || 'TBD').trim(),
      away: String(req.body.away || 'TBD').trim(),
      kickoff: String(req.body.kickoff || '').trim(),
      venue: String(req.body.venue || '').trim(),
      locked: false,
      actual_h: null,
      actual_a: null
    };
    const { data, error } = await supabase.from('fixtures').insert(row).select('*').maybeSingle();
    if (error) throw error;
    res.json({ ok: true, fixture: toFixture(data) });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not add fixture.' }); }
});

app.post('/api/admin/fixtures/:fixtureId', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const patch = {};
    if (req.body.home !== undefined) patch.home = String(req.body.home).trim();
    if (req.body.away !== undefined) patch.away = String(req.body.away).trim();
    if (req.body.round !== undefined) patch.round = String(req.body.round).trim();
    if (req.body.kickoff !== undefined) patch.kickoff = String(req.body.kickoff).trim();
    if (req.body.venue !== undefined) patch.venue = String(req.body.venue).trim();
    const { data, error } = await supabase.from('fixtures').update(patch).eq('id', req.params.fixtureId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Fixture not found.' });
    res.json({ ok: true, fixture: toFixture(data) });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not save fixture.' }); }
});

app.post('/api/admin/fixtures/:fixtureId/lock', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const { data, error } = await supabase.from('fixtures').update({ locked: Boolean(req.body.locked) }).eq('id', req.params.fixtureId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Fixture not found.' });
    res.json({ ok: true, fixture: toFixture(data) });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not lock fixture.' }); }
});

app.post('/api/admin/lock-round', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const round = String(req.body.round || 'Round of 32');
    const locked = Boolean(req.body.locked);
    const { error } = await supabase.from('fixtures').update({ locked }).eq('round', round);
    if (error) throw error;
    res.json({ ok: true, fixtures: await getFixtures() });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not lock round.' }); }
});

app.post('/api/admin/fixtures/:fixtureId/result', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const h = req.body.h === null || req.body.h === '' ? null : Number(req.body.h);
    const a = req.body.a === null || req.body.a === '' ? null : Number(req.body.a);
    const patch = {};
    if (h === null || a === null) { patch.actual_h = null; patch.actual_a = null; }
    else {
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 30 || a > 30) return res.status(400).json({ error: 'Enter valid scores.' });
      patch.actual_h = h; patch.actual_a = a; patch.locked = true;
    }
    const { data, error } = await supabase.from('fixtures').update(patch).eq('id', req.params.fixtureId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Fixture not found.' });
    res.json({ ok: true, fixture: toFixture(data), leaderboard: await leaderboard() });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not post result.' }); }
});


app.get('/api/admin/status', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const round = String(req.query.round || '').trim();
    const [players, fixtures, predictions] = await Promise.all([getPlayers(), getFixtures(), getAllPredictions()]);
    const relevantFixtures = fixtures.filter(f => {
      if (round && f.round !== round) return false;
      return !(f.home === 'TBD' && f.away === 'TBD');
    });
    const rows = players.map(p => {
      const pp = predictions[p.id] || {};
      const missing = relevantFixtures
        .filter(f => !pp[f.id])
        .map(f => ({ id: f.id, label: `${f.home} vs ${f.away}`, round: f.round }));
      return {
        id: p.id,
        name: p.name,
        made: relevantFixtures.length - missing.length,
        total: relevantFixtures.length,
        missing
      };
    }).sort((a, b) => (b.total ? (a.missing.length - b.missing.length) : 0) || a.name.localeCompare(b.name));
    res.json({ ok: true, round, rows, totalFixtures: relevantFixtures.length });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not load prediction status.' }); }
});

app.delete('/api/admin/players/:playerId', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const playerId = String(req.params.playerId || '');
    const { data: player, error: findError } = await supabase.from('players').select('id,name').eq('id', playerId).maybeSingle();
    if (findError) throw findError;
    if (!player) return res.status(404).json({ error: 'Player not found.' });
    const { error } = await supabase.from('players').delete().eq('id', playerId);
    if (error) throw error;
    res.json({ ok: true, removed: player, leaderboard: await leaderboard() });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not remove player.' }); }
});

app.post('/api/admin/reset-fixtures', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
    const { error } = await supabase.from('fixtures').upsert(coreFixtures(), { onConflict: 'id' });
    if (error) throw error;
    res.json({ ok: true, fixtures: await getFixtures() });
  } catch (e) { res.status(500).json({ error: e.message || 'Could not reset fixtures.' }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

seedFixturesIfEmpty().finally(() => {
  app.listen(PORT, () => console.log(`Fantasy Knockout running on port ${PORT} using Supabase`));
});
