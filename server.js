const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'admin1234';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
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
function fx(id, round, home, away, kickoff, venue) {
  return { id, round, home, away, kickoff, venue, locked: false, actualH: null, actualA: null };
}

function newDb() {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: { winnerPts: 2, scorelineBonus: 2 },
    fixtures: starterFixtures(),
    players: {},
    predictions: {},
    sessions: {}
  };
}

function readDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) writeDb(newDb());
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDb(db) {
  ensureDataDir();
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
}
function validPin(pin) {
  return /^\d{4,8}$/.test(String(pin || ''));
}
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(pin), salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}
function verifyPin(pin, salt, expected) {
  const actual = hashPin(pin, salt).hash;
  try { return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
  catch { return false; }
}
function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, createdAt: p.createdAt };
}
function auth(req, db) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sess = db.sessions[token];
  if (!sess) return null;
  const player = db.players[sess.playerId];
  if (!player) return null;
  return { token, player };
}
function isAdmin(req) {
  return String(req.headers['x-admin-pin'] || '') === String(ADMIN_PIN);
}
function sign(h, a) { return h > a ? 1 : h < a ? -1 : 0; }
function scoreOne(pred, fixture, settings) {
  if (!pred || fixture.actualH === null || fixture.actualA === null) return null;
  if (pred.h === fixture.actualH && pred.a === fixture.actualA) return settings.winnerPts + settings.scorelineBonus;
  if (sign(pred.h, pred.a) === sign(fixture.actualH, fixture.actualA)) return settings.winnerPts;
  return 0;
}
function leaderboard(db) {
  return Object.values(db.players).map(p => {
    const pp = db.predictions[p.id] || {};
    let pts = 0, exact = 0, counted = 0;
    for (const f of db.fixtures) {
      const s = scoreOne(pp[f.id], f, db.settings);
      if (s !== null) { counted++; pts += s; }
      if (pp[f.id] && f.actualH !== null && pp[f.id].h === f.actualH && pp[f.id].a === f.actualA) exact++;
    }
    return { id: p.id, name: p.name, pts, exact, counted };
  }).sort((a, b) => b.pts - a.pts || b.exact - a.exact || a.name.localeCompare(b.name));
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/state', (req, res) => {
  const db = readDb();
  const user = auth(req, db);
  const preds = user ? (db.predictions[user.player.id] || {}) : {};
  res.json({
    fixtures: db.fixtures,
    settings: db.settings,
    me: user ? publicPlayer(user.player) : null,
    myPredictions: preds,
    leaderboard: leaderboard(db),
    serverTime: new Date().toISOString()
  });
});

app.post('/api/register', (req, res) => {
  const name = normalizeName(req.body.name);
  const pin = String(req.body.pin || '');
  if (!name) return res.status(400).json({ error: 'Enter a display name.' });
  if (!validPin(pin)) return res.status(400).json({ error: 'PIN must be 4 to 8 digits.' });
  const db = readDb();
  const taken = Object.values(db.players).find(p => p.name.toLowerCase() === name.toLowerCase());
  if (taken) return res.status(409).json({ error: 'This name already exists. Log in with the PIN, or choose another name.' });
  const id = 'p_' + crypto.randomBytes(8).toString('hex');
  const hp = hashPin(pin);
  db.players[id] = { id, name, pinSalt: hp.salt, pinHash: hp.hash, createdAt: new Date().toISOString() };
  db.predictions[id] = {};
  const token = makeToken();
  db.sessions[token] = { playerId: id, createdAt: new Date().toISOString() };
  writeDb(db);
  res.json({ token, me: publicPlayer(db.players[id]) });
});

app.post('/api/login', (req, res) => {
  const name = normalizeName(req.body.name);
  const pin = String(req.body.pin || '');
  const db = readDb();
  const player = Object.values(db.players).find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!player || !verifyPin(pin, player.pinSalt, player.pinHash)) return res.status(401).json({ error: 'Wrong name or PIN.' });
  const token = makeToken();
  db.sessions[token] = { playerId: player.id, createdAt: new Date().toISOString() };
  writeDb(db);
  res.json({ token, me: publicPlayer(player) });
});

app.post('/api/logout', (req, res) => {
  const db = readDb();
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token && db.sessions[token]) delete db.sessions[token];
  writeDb(db);
  res.json({ ok: true });
});

app.put('/api/predictions/:fixtureId', (req, res) => {
  const db = readDb();
  const user = auth(req, db);
  if (!user) return res.status(401).json({ error: 'Log in first.' });
  const fixture = db.fixtures.find(f => f.id === req.params.fixtureId);
  if (!fixture) return res.status(404).json({ error: 'Fixture not found.' });
  if (fixture.locked || fixture.actualH !== null) return res.status(423).json({ error: 'This match is locked.' });
  const h = Number(req.body.h), a = Number(req.body.a);
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 30 || a > 30) {
    return res.status(400).json({ error: 'Enter valid scores.' });
  }
  db.predictions[user.player.id] ||= {};
  db.predictions[user.player.id][fixture.id] = { h, a, updatedAt: new Date().toISOString() };
  writeDb(db);
  res.json({ ok: true, prediction: db.predictions[user.player.id][fixture.id] });
});

app.post('/api/admin/fixtures/:fixtureId', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
  const db = readDb();
  const f = db.fixtures.find(x => x.id === req.params.fixtureId);
  if (!f) return res.status(404).json({ error: 'Fixture not found.' });
  for (const key of ['home','away','round','kickoff','venue']) {
    if (req.body[key] !== undefined) f[key] = String(req.body[key]).trim();
  }
  writeDb(db);
  res.json({ ok: true, fixture: f });
});

app.post('/api/admin/fixtures/:fixtureId/lock', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
  const db = readDb();
  const f = db.fixtures.find(x => x.id === req.params.fixtureId);
  if (!f) return res.status(404).json({ error: 'Fixture not found.' });
  f.locked = Boolean(req.body.locked);
  writeDb(db);
  res.json({ ok: true, fixture: f });
});

app.post('/api/admin/lock-round', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
  const round = String(req.body.round || 'Round of 32');
  const locked = Boolean(req.body.locked);
  const db = readDb();
  db.fixtures.forEach(f => { if (f.round === round) f.locked = locked; });
  writeDb(db);
  res.json({ ok: true, fixtures: db.fixtures });
});

app.post('/api/admin/fixtures/:fixtureId/result', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
  const db = readDb();
  const f = db.fixtures.find(x => x.id === req.params.fixtureId);
  if (!f) return res.status(404).json({ error: 'Fixture not found.' });
  const h = req.body.h === null || req.body.h === '' ? null : Number(req.body.h);
  const a = req.body.a === null || req.body.a === '' ? null : Number(req.body.a);
  if (h === null || a === null) { f.actualH = null; f.actualA = null; }
  else {
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 30 || a > 30) return res.status(400).json({ error: 'Enter valid scores.' });
    f.actualH = h; f.actualA = a; f.locked = true;
  }
  writeDb(db);
  res.json({ ok: true, fixture: f, leaderboard: leaderboard(db) });
});

app.post('/api/admin/reset-fixtures', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Admin PIN required.' });
  const db = readDb();
  db.fixtures = starterFixtures();
  writeDb(db);
  res.json({ ok: true, fixtures: db.fixtures });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Fantasy Knockout running on port ${PORT}`));
