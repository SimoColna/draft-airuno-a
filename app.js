/* Draft Airuno — logica di gioco e interfaccia.
   I dati dei giocatori arrivano da data.js (P = nomi e ruoli, K = livelli offuscati). */
'use strict';

const _k = atob(K);
const lv = i => _k.charCodeAt(i) ^ ((i * 37 + 11) & 255);
const PL = P.map((p, i) => ({ id: i, name: p[0], roles: p[1].split('/') }));

const ROLE_NAME = { POR: 'Portiere', TD: 'Terzino destro', DC: 'Difensore centrale', TS: 'Terzino sinistro', CC: 'Centrocampista', ED: 'Esterno destro', ES: 'Esterno sinistro', ATT: 'Attaccante' };
const AFFINE = { POR: [], TD: ['DC', 'ED', 'TS'], TS: ['DC', 'ES', 'TD'], DC: ['TD', 'TS', 'CC'], CC: ['DC', 'ED', 'ES'], ED: ['ES', 'ATT', 'TD'], ES: ['ED', 'ATT', 'TS'], ATT: ['ED', 'ES', 'CC'] };
const FORM = {
  '4-4-2': [['POR', 50, 90], ['TD', 84, 68], ['DC', 62, 74], ['DC', 38, 74], ['TS', 16, 68], ['ED', 84, 43], ['CC', 62, 48], ['CC', 38, 48], ['ES', 16, 43], ['ATT', 63, 16], ['ATT', 37, 16]],
  '4-3-3': [['POR', 50, 90], ['TD', 84, 68], ['DC', 62, 74], ['DC', 38, 74], ['TS', 16, 68], ['CC', 76, 47], ['CC', 50, 52], ['CC', 24, 47], ['ED', 82, 20], ['ATT', 50, 13], ['ES', 18, 20]],
  '3-5-2': [['POR', 50, 90], ['DC', 76, 73], ['DC', 50, 77], ['DC', 24, 73], ['ED', 86, 44], ['CC', 68, 49], ['CC', 50, 55], ['CC', 32, 49], ['ES', 14, 44], ['ATT', 64, 16], ['ATT', 36, 16]],
  '4-2-3-1': [['POR', 50, 90], ['TD', 84, 68], ['DC', 62, 74], ['DC', 38, 74], ['TS', 16, 68], ['CC', 64, 57], ['CC', 36, 57], ['ED', 83, 33], ['CC', 50, 36], ['ES', 17, 33], ['ATT', 50, 12]]
};
const STYLES = { off: { lab: 'Offensivo', att: 1.15, def: 1.10 }, bal: { lab: 'Equilibrato', att: 1, def: 1 }, dif: { lab: 'Difensivo', att: .85, def: .88 } };
const FORM_KEYS = Object.keys(FORM), STYLE_KEYS = Object.keys(STYLES);
const TC = ['var(--a)', 'var(--b)'];

/* ---------- casualità ----------
   Un telefono: Math.random. Due telefoni: generatore con seme, così entrambi
   calcolano la stessa identica sfida a partire dai due codici squadra. */
let rnd = Math.random;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function withSeed(seed, fn) { const prev = rnd; rnd = mulberry32(seed); try { return fn(); } finally { rnd = prev; } }
/* arrotondamenti: evitano che minime differenze di calcolo tra iPhone e Android cambino il risultato */
const q6 = x => Math.round(x * 1e6) / 1e6, q9 = x => Math.round(x * 1e9) / 1e9;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gauss = () => { let s = 0; for (let i = 0; i < 12; i++) s += rnd(); return s - 6; };
const poisson = l => { const L = q9(Math.exp(-l)); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
const pick = (items, w) => { const t = w.reduce((a, b) => a + b, 0); let r = rnd() * t; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const nm = id => PL[id] ? PL[id].name : '?';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

/* ---------- stato ---------- */
const newTeam = (name, prev) => ({ name: prev ? prev.name : name, form: prev ? prev.form : '4-4-2', style: prev ? prev.style : 'bal', picks: [], reroll: 1, pens: [] });
const freshLocal = prev => ({ phase: 'setup', draftMode: 'alt', teams: [0, 1].map(t => newTeam('Squadra ' + (t + 1), prev && prev.teams[t])), steps: [], si: 0, opts: [], matches: [], pens: null, penTeam: 0 });
const freshDuel = prev => ({ phase: 'setup', me: newTeam('', prev && prev.me), slot: 0, opts: [], myCode: '', oppCode: '', rematch: 0, teams: null, all: null, shown: 0, paste: '' });

let MODE = store.get('draftAiruno.mode') === 'duel' ? 'duel' : 'local';
let S = store.get('draftAiruno.local.v1'); if (!S || !S.teams) S = freshLocal();
let D = store.get('draftAiruno.duel.v1'); if (!D || !D.me) D = freshDuel();
const saveAll = () => { store.set('draftAiruno.local.v1', S); store.set('draftAiruno.duel.v1', D); store.set('draftAiruno.mode', MODE); };
const L = { rename: null, sel: null, restartArm: false, scanErr: '', pasteErr: '', copied: false, nameErr: '' };

const T = t => MODE === 'duel' ? D.teams[t] : S.teams[t];
const MATCHES = () => MODE === 'duel' ? (D.all ? D.all.m.slice(0, D.shown) : []) : S.matches;
const PENS = () => {
  if (MODE !== 'duel') return S.pens;
  if (!D.all || D.shown < 2 || tieWinner(D.all.m) >= 0) return null;
  return (D.phase === 'shootout' || D.phase === 'end') ? D.all.pens : null;
};
const slotRole = (team, i) => FORM[team.form][i][0];

/* ---------- draft ---------- */
function drawOptions(team, slot, avoid = []) {
  const role = slotRole(team, slot);
  const taken = new Set(team.picks.filter(x => x != null));
  const free = PL.filter(p => !taken.has(p.id));
  const prefer = list => { const s = shuffle(list); return s.filter(p => !avoid.includes(p.id)).concat(s.filter(p => avoid.includes(p.id))); };
  let opts = prefer(free.filter(p => p.roles.includes(role))).slice(0, 3);
  if (!opts.length) opts = prefer(free.filter(p => p.roles.some(r => AFFINE[role].includes(r)))).slice(0, 3);
  if (!opts.length) opts = prefer(free).slice(0, 3);
  return opts.map(p => p.id);
}

/* ---------- simulazione ---------- */
function strength(t) {
  const team = T(t); let sum = 0, w = 0;
  team.picks.forEach((id, i) => { const ww = slotRole(team, i) === 'POR' ? 1.4 : 1; sum += lv(id) * ww; w += ww; });
  return sum / w;
}
const SCORE_W = { ATT: 5, ED: 2.6, ES: 2.6, CC: 2, TD: .8, TS: .8, DC: .6, POR: .02 };
const LVL_W = { 1: .7, 2: 1, 3: 1.5 };
const shooter = t => { const tm = T(t); return pick(tm.picks, tm.picks.map((id, i) => SCORE_W[slotRole(tm, i)] * LVL_W[lv(id)])); };
const defender = t => { const tm = T(t); return pick(tm.picks, tm.picks.map((id, i) => ({ DC: 3, TD: 1.5, TS: 1.5, CC: 1, POR: .5 })[slotRole(tm, i)] || .3)); };
const keeper = t => T(t).picks[0];
function minute() {
  const r = rnd();
  if (r < .05) return { m: 45, x: 1 + Math.floor(rnd() * 3) };
  if (r < .11) return { m: 90, x: 1 + Math.floor(rnd() * 5) };
  return { m: 1 + Math.floor(rnd() * 89), x: 0 };
}
/* B e k tarati: con medie 2,5 contro 1,8 la squadra più forte vince circa il 65% delle partite */
function simMatch(home, away) {
  const B = 1.4, k = 1.2, HOME = .08;
  const d = (strength(home) + gauss() * .15) - (strength(away) + gauss() * .15) + HOME;
  const sh = STYLES[T(home).style], sa = STYLES[T(away).style];
  const lam = [q6(B * Math.exp(k * d / 2) * sh.att * sa.def), q6(B * Math.exp(-k * d / 2) * sa.att * sh.def)];
  const side = [home, away], ev = [];
  [0, 1].forEach(j => {
    const t = side[j], o = side[1 - j], g = poisson(lam[j]);
    for (let n = 0; n < g; n++) {
      if (rnd() < .04) ev.push({ ...minute(), side: j, type: 'og', p: defender(o) });
      else ev.push({ ...minute(), side: j, type: 'goal', p: shooter(t) });
    }
  });
  const extra = poisson(2.6);
  for (let n = 0; n < extra; n++) {
    const j = rnd() < lam[0] / (lam[0] + lam[1]) ? 0 : 1, t = side[j], o = side[1 - j], r = rnd();
    if (r < .45) ev.push({ ...minute(), side: j, type: 'save', p: shooter(t), gk: keeper(o) });
    else if (r < .75) ev.push({ ...minute(), side: j, type: 'post', p: shooter(t) });
    else ev.push({ ...minute(), side: j, type: 'miss', p: shooter(t) });
  }
  ev.sort((a, b) => (a.m * 10 + a.x) - (b.m * 10 + b.x));
  const score = [0, 0];
  ev.forEach(e => { if (e.type === 'goal' || e.type === 'og') { score[e.side]++; e.sc = [...score]; } });
  return { home, away, events: ev, score };
}
function simShootout() {
  const first = rnd() < .5 ? 0 : 1, kicks = [], g = [0, 0], n = [0, 0];
  const pScore = (sh, gk) => .74 + (lv(sh) - 2) * .07 - (lv(keeper(gk)) - 2) * .05;
  for (let i = 0; ; i++) {
    const t = i % 2 ? 1 - first : first;
    const sh = T(t).pens[n[t] % 5];
    const ok = rnd() < pScore(sh, 1 - t);
    n[t]++; if (ok) g[t]++;
    kicks.push({ t, p: sh, ok, how: ok ? 'gol' : (rnd() < .6 ? 'parato' : 'fuori'), g: [...g] });
    if (n[0] <= 5 && n[1] <= 5 && (n[0] < 5 || n[1] < 5)) {
      if (g[0] > g[1] + (5 - n[1]) || g[1] > g[0] + (5 - n[0])) break;
    } else if (n[0] === n[1] && g[0] !== g[1]) break;
  }
  return { first, kicks, g, winner: g[0] > g[1] ? 0 : 1 };
}
const legWinner = m => m.score[0] === m.score[1] ? -1 : (m.score[0] > m.score[1] ? m.home : m.away);
function tieWinner(ms) { const w = [0, 0]; ms.forEach(m => { const o = legWinner(m); if (o >= 0) w[o]++; }); return w[0] > w[1] ? 0 : w[1] > w[0] ? 1 : -1; }

/* ---------- codice squadra ----------
   byte: versione, impronta della lista, modulo+stile, 11 giocatori, 5 rigoristi (posto in campo),
   lunghezza nome, nome UTF-8, controllo. Poi base64url con prefisso. */
const CODE_PREFIX = 'DA1.';
const ROSTER_H = hashStr(P.map(p => p.join(':')).join('|') + K) & 255;
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Array.from(atob(s), c => c.charCodeAt(0)); };
function encodeTeam(t) {
  const name = Array.from(new TextEncoder().encode(t.name.slice(0, 20)));
  const bytes = [1, ROSTER_H, (FORM_KEYS.indexOf(t.form) << 2) | STYLE_KEYS.indexOf(t.style), ...t.picks, ...t.pens.map(id => t.picks.indexOf(id)), name.length, ...name];
  let c = 7; bytes.forEach(b => { c = (c * 31 + b) & 255; }); bytes.push(c);
  return CODE_PREFIX + b64u(bytes);
}
function decodeTeam(code) {
  const fail = msg => { throw new Error(msg); };
  let s = String(code || '').trim().replace(/\s+/g, '');
  if (s.startsWith(CODE_PREFIX)) s = s.slice(CODE_PREFIX.length);
  let b; try { b = unb64u(s); } catch (e) { fail('Codice non valido.'); }
  if (b.length < 21) fail('Codice incompleto.');
  let c = 7; b.slice(0, -1).forEach(x => { c = (c * 31 + x) & 255; });
  if (c !== b[b.length - 1]) fail('Codice rovinato: copialo di nuovo.');
  if (b[0] !== 1) fail('Codice di una versione diversa del gioco.');
  if (b[1] !== ROSTER_H) fail('I due telefoni hanno liste giocatori diverse: ricaricate la pagina su tutti e due.');
  const form = FORM_KEYS[b[2] >> 2], style = STYLE_KEYS[b[2] & 3];
  const picks = b.slice(3, 14), slots = b.slice(14, 19);
  if (!form || !style) fail('Codice non valido.');
  if (picks.some(id => !PL[id]) || new Set(picks).size !== 11) fail('Codice non valido.');
  if (slots.some(i => i > 10) || new Set(slots).size !== 5) fail('Codice non valido.');
  const n = b[19], name = new TextDecoder().decode(new Uint8Array(b.slice(20, 20 + n)));
  if (20 + n !== b.length - 1) fail('Codice non valido.');
  return { name: name || 'Avversario', form, style, picks, pens: slots.map(i => picks[i]), reroll: 0 };
}
/* stessa sfida su entrambi i telefoni: ordine e seme dipendono solo dai due codici */
function buildDuel() {
  const [x, y] = [D.myCode, D.oppCode].sort();
  D.teams = [decodeTeam(x), decodeTeam(y)];
  D.myIdx = x === D.myCode ? 0 : 1;
  const seed = hashStr(x + '|' + y + '|' + D.rematch);
  D.check = (seed >>> 0).toString(36).toUpperCase().slice(-4).padStart(4, '0');
  D.all = withSeed(seed, () => ({ m: [simMatch(0, 1), simMatch(1, 0)], pens: simShootout() }));
  D.shown = 0; D.phase = 'reveal';
}

/* ---------- velocità delle animazioni ----------
   millisecondi per minuto di gioco; il livello 5 è la velocità originale */
const SPEEDS = [null, { lab: 'Molto lenta', ms: 750 }, { lab: 'Lenta', ms: 480 }, { lab: 'Normale', ms: 300 }, { lab: 'Svelta', ms: 180 }, { lab: 'Veloce', ms: 110 }];
const DEFAULT_SPEED = 3, FAST_SPEED = 5;
let SPEED = +store.get('draftAiruno.speed') || DEFAULT_SPEED;
if (!SPEEDS[SPEED]) SPEED = DEFAULT_SPEED;
const msPerMinute = () => SPEEDS[SPEED].ms;
const halfTimePause = () => Math.max(900, msPerMinute() * 4);
const kickPause = () => 500 + msPerMinute() * 3;
function setSpeed(v) {
  SPEED = Math.min(FAST_SPEED, Math.max(1, Math.round(v)));
  store.set('draftAiruno.speed', SPEED);
  const sl = $('#spd'), lab = $('#spdlab');
  if (sl) sl.value = SPEED;
  if (lab) lab.textContent = SPEEDS[SPEED].lab;
}
const speedHTML = () => `<div class="speed"><label class="lbl" for="spd">Velocità · <span id="spdlab">${SPEEDS[SPEED].lab}</span></label>
  <div class="speedrow"><input type="range" id="spd" min="1" max="${FAST_SPEED}" step="1" value="${SPEED}" aria-label="Velocità della simulazione">
  <button class="ghost" id="fast">Veloce</button></div></div>`;

/* ---------- animazioni: aggiornano solo i pezzi che cambiano ---------- */
let anim = null, kickAnim = null;
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function stopAnims() { if (anim) clearTimeout(anim.t); if (kickAnim) clearTimeout(kickAnim.t); anim = kickAnim = null; }
function animateMatch(idx) {
  stopAnims();
  if (reduced()) { render(); return; }
  anim = { idx, clock: 0, shown: 0, done: false };
  render(true);
  const m = MATCHES()[idx];
  const tick = () => {
    if (!anim || anim.idx !== idx) return;
    anim.clock++;
    const sc = $('#sc'), ck = $('#clock'), feed = $('#feed');
    while (anim.shown < m.events.length && (m.events[anim.shown].m + (m.events[anim.shown].x ? .5 : 0)) <= anim.clock) {
      const e = m.events[anim.shown]; anim.shown++;
      if (feed) feed.insertAdjacentHTML('afterbegin', evHTML(e, m, true));
      if (e.sc && sc) sc.textContent = `${e.sc[0]}–${e.sc[1]}`;
    }
    if (ck) ck.textContent = anim.clock <= 90 ? `${anim.clock}'` : `90+${anim.clock - 90}'`;
    if (anim.clock >= 96) { anim.done = true; render(true); return; }
    anim.t = setTimeout(tick, anim.clock === 45 ? halfTimePause() : msPerMinute());
  };
  anim.t = setTimeout(tick, 400);
}
function animateShootout() {
  stopAnims();
  const n = PENS().kicks.length;
  kickAnim = { shown: reduced() ? n : 0 };
  render(true);
  if (reduced()) return;
  /* aggiorna solo tabellone e palloni, così lo slider della velocità resta utilizzabile */
  const step = () => {
    if (!kickAnim) return;
    kickAnim.shown++;
    const live = $('#shootlive');
    if (live && kickAnim.shown < n) live.innerHTML = shootLiveHTML(); else render(true);
    if (kickAnim.shown < n) kickAnim.t = setTimeout(step, kickPause());
  };
  kickAnim.t = setTimeout(step, kickPause());
}

/* ---------- pezzi di interfaccia ---------- */
const $ = s => document.querySelector(s);
function pitchHTML(team, t, { cur = -1, small = false } = {}) {
  return `<div class="pitch${small ? ' sm' : ''}" style="--tc:${TC[t]}">
    <div class="ln mid"></div><div class="ln circ"></div><div class="ln boxb"></div><div class="ln boxt"></div>
    ${FORM[team.form].map(([r, x, y], i) => {
      const id = team.picks[i], st = id != null ? 'filled' : (i === cur ? 'cur' : 'empty');
      return `<div class="tok ${st}" style="left:${x}%;top:${y}%"><div class="dot">${r}</div>${id != null ? `<div class="nm">${esc(nm(id))}</div>` : ''}</div>`;
    }).join('')}</div>`;
}
function header() {
  const inGame = MODE === 'duel' ? D.phase !== 'setup' : S.phase !== 'setup';
  return `<div class="top"><div class="brand">Draft <span>Airuno</span></div><div class="topr">
    ${inGame ? `<button class="ghost${L.restartArm ? ' warn' : ''}" id="restart">${L.restartArm ? 'Tocca ancora per ricominciare' : 'Ricomincia'}</button>` : ''}</div></div>`;
}
function modeSwitch() {
  return `<div class="seg big"><button data-mode="local" aria-pressed="${MODE === 'local'}">Un telefono</button><button data-mode="duel" aria-pressed="${MODE === 'duel'}">Due telefoni</button></div>`;
}
/* chi può rinominare: in modalità un telefono entrambi; con due telefoni solo la propria squadra prima dello scambio dei codici */
function nameBlock(t, team, { tag = 'h2', chip = false, editable = true } = {}) {
  if (editable && L.rename === t) return `<div class="renamer"><input class="txt" id="rn" value="${esc(team.name)}" maxlength="20" autocomplete="off"><button id="rnok">Salva</button></div>`;
  const name = chip ? `<span class="chip ${t ? 'b' : 'a'}">${esc(team.name)}</span>` : `<${tag} style="color:${TC[t]}">${esc(team.name)}</${tag}>`;
  return `<div class="tname">${name}${editable ? `<button class="pen" data-rename="${t}">Rinomina</button>` : ''}</div>`;
}
function teamCfg(t, team) {
  return `<div class="teamcfg ${t ? 'tb' : 'ta'}">
    <div><div class="lbl">Nome squadra</div><input class="txt" id="name${t}" value="${esc(team.name)}" maxlength="20" autocomplete="off" placeholder="Es. Real Airuno"></div>
    <div><div class="lbl">Modulo</div><div class="seg">${FORM_KEYS.map(f => `<button data-form="${t}:${f}" aria-pressed="${team.form === f}">${f}</button>`).join('')}</div></div>
    <div><div class="lbl">Stile</div><div class="seg">${Object.entries(STYLES).map(([k, v]) => `<button data-style="${t}:${k}" aria-pressed="${team.style === k}">${v.lab}</button>`).join('')}</div></div>
  </div>`;
}
function draftHTML(t, team, opts, sel, slot) {
  const role = slotRole(team, slot);
  return `<div class="draftHead" style="--tc:${TC[t]}"><div>${nameBlock(t, team, { chip: true })}
    <h2 style="margin-top:8px">${ROLE_NAME[role]}</h2></div><div class="slotno">${slot + 1} / 11</div></div>
  <div class="cards" style="--tc:${TC[t]};grid-template-columns:repeat(${Math.max(opts.length, 1)},minmax(0,1fr))">${opts.map((id, i) => {
    const p = PL[id];
    return `<button class="card" data-opt="${i}" aria-pressed="${sel === i}"><div class="mono">${esc(initials(p.name))}</div><div class="cn">${esc(p.name)}</div>
      <div class="rr">${p.roles.map(r => `<span class="${r === role ? 'hit' : ''}">${r}</span>`).join('')}</div></button>`;
  }).join('')}</div>
  <div class="row"><button class="btn alt" id="reroll" ${team.reroll < 1 ? 'disabled' : ''}>Rimescola (${team.reroll})</button>
    <button class="btn ${t ? 'b' : ''}" id="pick" ${sel == null ? 'disabled' : ''}>Scegli</button></div>
  ${pitchHTML(team, t, { cur: slot })}
  <p class="note">${esc(team.form)} · ${STYLES[team.style].lab}. Un solo rimescolo per tutto il draft.</p>`;
}
function penListHTML(t, team) {
  return `<div class="plist" style="--tc:${TC[t]}">${team.picks.map((id, i) => {
    const k = team.pens.indexOf(id);
    return `<button class="pl" data-pen="${id}" aria-pressed="${k >= 0}"><span class="ord">${k >= 0 ? k + 1 : ''}</span><span class="pn">${esc(nm(id))}</span><span class="pr">${slotRole(team, i)}</span></button>`;
  }).join('')}</div>`;
}
function revealSides(editable) {
  return `<div class="duo">${[0, 1].map(t => `<div class="side" style="--tc:${TC[t]}"><div class="sidehead">${nameBlock(t, T(t), { editable })}
    <span class="chip o">${T(t).form} · ${STYLES[T(t).style].lab}</span></div>${pitchHTML(T(t), t, { small: true })}</div>`).join('')}</div>`;
}
function evParts(e, m) {
  const tn = T(e.side ? m.away : m.home).name;
  switch (e.type) {
    case 'goal': return ['GOL', `${esc(nm(e.p))} <span class="muted">(${esc(tn)})</span>`];
    case 'og': return ['AUTOGOL', `${esc(nm(e.p))} la mette nella sua porta`];
    case 'save': return ['PARATA', `${esc(nm(e.gk))} dice no a ${esc(nm(e.p))}`];
    case 'post': return ['PALO', `${esc(nm(e.p))} colpisce il legno`];
    default: return ['FUORI', `${esc(nm(e.p))} spreca da buona posizione`];
  }
}
const minLab = e => e.x ? `${e.m}+${e.x}'` : `${e.m}'`;
function evHTML(e, m, isNew) {
  const [tag, txt] = evParts(e, m), team = e.side ? m.away : m.home;
  return `<li class="ev${isNew ? ' new' : ''}${e.type === 'goal' || e.type === 'og' ? ' goal' : ''}" style="--tc:${TC[team]}"><span class="m">${minLab(e)}</span><span class="t">${tag}</span><span class="d">${txt}</span></li>`;
}
function matchHTML(idx, actions) {
  const m = MATCHES()[idx], live = anim && anim.idx === idx && !anim.done;
  const evs = live ? m.events.slice(0, anim.shown) : m.events;
  const sc = live ? ((evs.filter(e => e.sc).pop() || {}).sc || [0, 0]) : m.score;
  const H = m.home, A = m.away;
  return `<div class="eyebrow">${idx === 0 ? 'Andata' : 'Ritorno'} · in casa di ${esc(T(H).name)}</div>
  <div class="board"><div class="tn" style="color:${TC[H]}">${esc(T(H).name)}</div><div class="sc" id="sc">${sc[0]}–${sc[1]}</div>
    <div class="tn r" style="color:${TC[A]}">${esc(T(A).name)}</div><div class="clock" id="clock">${live ? `${anim.clock}'` : 'Finale'}</div></div>
  ${live ? `${speedHTML()}<button class="btn alt" id="skip">Vai al risultato</button>` : actions}
  <ol class="feed" id="feed">${evs.slice().reverse().map(e => evHTML(e, m, false)).join('')}
    ${!live && !m.events.length ? '<li class="note">Novanta minuti di palla a centrocampo, nessuna emozione.</li>' : ''}</ol>`;
}
function legsBox(withPens) {
  const ms = MATCHES(), pens = PENS();
  return `<div class="legs">${ms.map((m, i) => `<span class="k">${i ? 'Ritorno' : 'Andata'}</span><span class="v">${esc(T(m.home).name)} ${m.score[0]}–${m.score[1]} ${esc(T(m.away).name)}</span>`).join('')}
   ${withPens && pens ? `<span class="k">Rigori</span><span class="v">${esc(T(0).name)} ${pens.g[0]}–${pens.g[1]} ${esc(T(1).name)}</span>` : ''}</div>`;
}
function shootLiveHTML() {
  const pens = PENS(), shown = kickAnim ? kickAnim.shown : pens.kicks.length;
  const ks = pens.kicks.slice(0, shown), g = ks.length ? ks[ks.length - 1].g : [0, 0], last = ks[ks.length - 1];
  return `<div class="board"><div class="tn" style="color:${TC[0]}">${esc(T(0).name)}</div><div class="sc">${g[0]}–${g[1]}</div>
    <div class="tn r" style="color:${TC[1]}">${esc(T(1).name)}</div>
    <div class="clock">${last ? `${esc(nm(last.p))}: ${last.ok ? 'gol' : last.how === 'parato' ? 'parato da ' + esc(nm(keeper(1 - last.t))) : 'fuori'}` : 'Pronti'}</div></div>
  <div class="kicks">${[0, 1].map(t => `<div class="krow" style="--tc:${TC[t]}"><div class="kn">${esc(T(t).name)}</div><div class="balls">
    ${ks.filter(k => k.t === t).map(k => `<span class="ball ${k.ok ? 'g' : 'x'}" title="${esc(nm(k.p))}"></span>`).join('')}</div></div>`).join('')}</div>`;
}
function shootoutHTML(actions) {
  const pens = PENS(), shown = kickAnim ? kickAnim.shown : pens.kicks.length;
  return `<div><div class="eyebrow">Inizia ${esc(T(pens.first).name)} (moneta)</div><h1>Lotteria</h1></div>
  <div id="shootlive" class="duo">${shootLiveHTML()}</div>
  ${shown >= pens.kicks.length ? actions : `${speedHTML()}<button class="btn alt" id="skipk">Vai al risultato</button>`}`;
}
function endHTML(actions) {
  const pens = PENS(), ms = MATCHES(), w = pens ? pens.winner : tieWinner(ms);
  const goals = [{}, {}];
  ms.forEach(m => m.events.forEach(e => { if (e.type === 'goal') { const t = e.side ? m.away : m.home; goals[t][e.p] = (goals[t][e.p] || 0) + 1; } }));
  const sc = t => Object.entries(goals[t]).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${esc(nm(+id))}${n > 1 ? ' ×' + n : ''}`).join(', ') || 'nessuno';
  return `<div class="winner" style="--tc:${TC[w]}"><div class="eyebrow">Passa il turno</div><div class="big">${esc(T(w).name)}</div>
    ${pens ? '<p class="note">ai calci di rigore</p>' : ''}</div>
  ${legsBox(true)}
  <div class="scorers">${[0, 1].map(t => `<p><b style="color:${TC[t]}">${esc(T(t).name)}</b> · ${sc(t)}</p>`).join('')}</div>${actions}`;
}
const intro = `<p class="muted">Per ogni posto in campo escono tre giocatori a caso: ne scegli uno. Andata e ritorno, e se serve si va ai rigori.</p>`;
const rulesNote = () => `<p class="note">Andata in casa di ${esc(T(0).name)}, ritorno in casa di ${esc(T(1).name)}. Conta chi vince più partite: con una vittoria a testa o due pareggi si va ai rigori.</p>`;

/* ---------- vista: un telefono ---------- */
function localView() {
  const ph = S.phase;
  if (ph === 'setup') return `${header()}
    <div><div class="eyebrow">U.S.O. Airuno Open A · ${PL.length} giocatori in archivio</div><h1>Due allenatori, una rosa di ex</h1></div>
    ${modeSwitch()}${intro}${teamCfg(0, S.teams[0])}${teamCfg(1, S.teams[1])}
    <div><div class="lbl">Ordine del draft</div><div class="seg">
      <button data-dmode="alt" aria-pressed="${S.draftMode === 'alt'}">Un ruolo a testa</button>
      <button data-dmode="seq" aria-pressed="${S.draftMode === 'seq'}">Tutta la squadra di fila</button></div></div>
    <button class="btn" id="go">Inizia il draft</button>`;
  if (ph === 'handoff') {
    const [t] = S.steps[S.si];
    return `${header()}<div class="hand" style="--tc:${TC[t]}"><div class="eyebrow">Passa il telefono</div><div class="big">${esc(T(t).name)}</div>
      <p class="muted">L'altro allenatore non guarda. Le rose restano coperte fino alla fine del draft.</p>
      <button class="btn ${t ? 'b' : ''}" id="ready">Ci sono, mostra le scelte</button></div>`;
  }
  if (ph === 'draft') { const [t, s] = S.steps[S.si]; return header() + draftHTML(t, T(t), S.opts, L.sel, s); }
  if (ph === 'reveal') return `${header()}<div><div class="eyebrow">Draft finito</div><h1>Le rose</h1></div>${revealSides(true)}${rulesNote()}
    <button class="btn" id="kick">Fischio d'inizio: andata</button>`;
  if (ph === 'match') {
    const idx = S.matches.length - 1;
    const lbl = idx === 0 ? 'Si va al ritorno' : tieWinner(S.matches) < 0 ? 'Si va ai rigori' : 'Risultato finale';
    return header() + matchHTML(idx, `<button class="btn" id="next">${lbl}</button>`);
  }
  if (ph === 'between') return `${header()}<div><div class="eyebrow">Fine andata</div><h1>Si torna in campo</h1></div>${legsBox(false)}
    <p class="note">Il ritorno si gioca in casa di ${esc(T(1).name)}.</p><button class="btn b" id="kick">Fischio d'inizio: ritorno</button>`;
  if (ph === 'penpick') {
    const t = S.penTeam;
    return `${header()}<div><div class="eyebrow">Una vittoria a testa o due pareggi</div><h1>Rigori</h1></div>${legsBox(false)}
      <div>${nameBlock(t, T(t), { chip: true })}<p style="margin-top:8px">Scegli i 5 rigoristi in ordine. Se dopo cinque è ancora pari, si riparte dal primo.</p></div>
      ${penListHTML(t, T(t))}
      <button class="btn ${t ? 'b' : ''}" id="penok" ${T(t).pens.length < 5 ? 'disabled' : ''}>${t === 0 ? `Conferma e passa a ${esc(T(1).name)}` : 'Si tira'}</button>`;
  }
  if (ph === 'shootout') return header() + shootoutHTML('<button class="btn" id="final">Risultato finale</button>');
  if (ph === 'end') return header() + endHTML('<button class="btn" id="again">Rivincita con le stesse rose</button><button class="btn alt" id="newdraft">Nuovo draft</button>');
  S.phase = 'setup'; return localView();
}
function localStartDraft() {
  S.teams.forEach((t, i) => { t.name = (t.name || '').trim() || ('Squadra ' + (i + 1)); t.picks = Array(11).fill(null); t.reroll = 1; t.pens = []; });
  S.steps = [];
  if (S.draftMode === 'alt') { for (let s = 0; s < 11; s++) S.steps.push([0, s], [1, s]); }
  else { for (const t of [0, 1]) for (let s = 0; s < 11; s++) S.steps.push([t, s]); }
  S.si = 0; S.matches = []; S.pens = null;
  localEnterStep(true);
}
function localEnterStep(first) {
  const [t, s] = S.steps[S.si];
  S.opts = drawOptions(T(t), s); L.sel = null;
  S.phase = (first || S.steps[S.si - 1][0] !== t) ? 'handoff' : 'draft';
}

/* ---------- vista: due telefoni ---------- */
const ME = 0; /* prima dello scambio dei codici la propria squadra usa il colore arancione */
function duelView() {
  const ph = D.phase, me = D.me;
  if (ph === 'setup') return `${header()}
    <div><div class="eyebrow">U.S.O. Airuno Open A · ${PL.length} giocatori in archivio</div><h1>Ognuno col suo telefono</h1></div>
    ${modeSwitch()}
    <ol class="steps"><li>Ognuno fa il draft sul suo telefono e sceglie 5 rigoristi.</li><li>Ognuno inquadra il QR dell'altro.</li><li>La sfida è la stessa su tutti e due i telefoni.</li></ol>
    ${teamCfg(ME, me)}
    ${L.nameErr ? `<div class="err">${esc(L.nameErr)}</div>` : ''}
    <button class="btn" id="dstart">Inizia il draft</button>`;
  if (ph === 'draft') return header() + draftHTML(ME, me, D.opts, L.sel, D.slot);
  if (ph === 'pens') return `${header()}<div><div class="eyebrow">Draft finito</div><h1>I rigoristi</h1></div>
    <p>Scegli 5 rigoristi in ordine. Servono solo se si arriva ai rigori; dopo il quinto si riparte dal primo.</p>
    ${penListHTML(ME, me)}
    <button class="btn" id="dpenok" ${me.pens.length < 5 ? 'disabled' : ''}>Crea il codice squadra</button>`;
  if (ph === 'code') return `${header()}<div><div class="eyebrow">Squadra pronta</div><h1>Fatti inquadrare</h1></div>
    <div class="qrbox" id="qr">${qrSVG(D.myCode)}</div>
    <div class="row"><button class="btn" id="scan">Inquadra l'altro</button><button class="btn alt" id="topaste">Codice a mano</button></div>
    <details><summary class="note">Il tuo codice in testo</summary><div class="codetxt" style="margin-top:8px">${esc(D.myCode)}</div>
      <button class="ghost" id="copy" style="margin-top:8px">${L.copied ? 'Copiato' : 'Copia'}</button></details>
    <div class="side" style="--tc:${TC[ME]}"><div class="sidehead">${nameBlock(ME, me, { editable: false })}<span class="chip o">${me.form} · ${STYLES[me.style].lab}</span></div>${pitchHTML(me, ME, { small: true })}</div>
    <button class="btn alt" id="redraft">Rifai il draft</button>`;
  if (ph === 'scan') return `${header()}<div><div class="eyebrow">Fotocamera</div><h1>Inquadra il QR</h1></div>
    <div class="cam"><video id="video" playsinline muted></video><div class="frame"></div></div>
    ${L.scanErr ? `<div class="err">${esc(L.scanErr)}</div>` : '<p class="note">Tieni il QR dell\'altro telefono dentro il riquadro.</p>'}
    <div class="row"><button class="btn alt" id="stopscan">Indietro</button><button class="btn alt" id="topaste">Codice a mano</button></div>`;
  if (ph === 'paste') return `${header()}<div><div class="eyebrow">Codice a mano</div><h1>Incolla il codice</h1></div>
    <textarea class="txt" id="pastebox" autocomplete="off" spellcheck="false" placeholder="DA1.…">${esc(D.paste)}</textarea>
    ${L.pasteErr ? `<div class="err">${esc(L.pasteErr)}</div>` : ''}
    <div class="row"><button class="btn alt" id="tocode">Indietro</button><button class="btn" id="pasteok">Usa il codice</button></div>`;
  const checkBox = `<div class="check"><span class="note">Controllate che sui due telefoni ci sia lo stesso codice partita</span><b>${esc(D.check)}</b></div>`;
  if (ph === 'reveal') return `${header()}<div><div class="eyebrow">${D.rematch ? 'Rivincita n. ' + D.rematch : 'Si gioca'}</div><h1>Le rose</h1></div>
    ${checkBox}${revealSides(false)}${rulesNote()}<button class="btn" id="dkick">Fischio d'inizio: andata</button>`;
  if (ph === 'match') {
    const idx = D.shown - 1;
    const lbl = idx === 0 ? 'Si va al ritorno' : tieWinner(D.all.m) < 0 ? 'Si va ai rigori' : 'Risultato finale';
    return header() + matchHTML(idx, `<button class="btn" id="dnext">${lbl}</button>`);
  }
  if (ph === 'between') return `${header()}<div><div class="eyebrow">Fine andata</div><h1>Si torna in campo</h1></div>${legsBox(false)}
    <p class="note">Il ritorno si gioca in casa di ${esc(T(1).name)}.</p><button class="btn b" id="dkick">Fischio d'inizio: ritorno</button>`;
  if (ph === 'shootout') return header() + shootoutHTML('<button class="btn" id="dfinal">Risultato finale</button>');
  if (ph === 'end') return `${header()}${endHTML(`<button class="btn" id="drematch">Rivincita con le stesse rose</button>
    <button class="btn alt" id="newopp">Stessa squadra, altro avversario</button><button class="btn alt" id="dnew">Nuovo draft</button>`)}
    <p class="note">Per la rivincita toccate il tasto su tutti e due i telefoni: il codice partita deve tornare uguale.</p>`;
  D.phase = 'setup'; return duelView();
}

/* ---------- QR ---------- */
function qrSVG(text) {
  if (typeof qrcode !== 'function') return `<div class="codetxt">${esc(text)}</div>`;
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
}
let scan = null;
async function startScan() {
  L.scanErr = '';
  D.phase = 'scan'; render(true);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { L.scanErr = 'Questo browser non dà accesso alla fotocamera. Usa il codice a mano.'; return render(true); }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const video = $('#video');
    if (!video || D.phase !== 'scan') { stream.getTracks().forEach(t => t.stop()); return; }
    scan = { stream, canvas: document.createElement('canvas'), raf: 0 };
    video.srcObject = stream; await video.play();
    const ctx = scan.canvas.getContext('2d', { willReadFrequently: true });
    const loop = () => {
      if (!scan) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        const w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
        scan.canvas.width = w; scan.canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (res && res.data && res.data.startsWith(CODE_PREFIX)) { stopScan(); return useOppCode(res.data, true); }
      }
      scan.raf = requestAnimationFrame(loop);
    };
    loop();
  } catch (e) {
    stopScan();
    L.scanErr = e && e.name === 'NotAllowedError' ? 'Permesso fotocamera negato. Consentilo dalle impostazioni del browser, oppure usa il codice a mano.' : 'Non riesco ad aprire la fotocamera. Usa il codice a mano.';
    render(true);
  }
}
function stopScan() { if (!scan) return; cancelAnimationFrame(scan.raf); scan.stream.getTracks().forEach(t => t.stop()); scan = null; }
function useOppCode(code, fromScan) {
  try {
    decodeTeam(code);
    if (code.replace(/\s+/g, '') === D.myCode) throw new Error('Questo è il tuo codice: inquadra quello dell\'altro telefono.');
    D.oppCode = code.trim().replace(/\s+/g, ''); if (!D.oppCode.startsWith(CODE_PREFIX)) D.oppCode = CODE_PREFIX + D.oppCode;
    D.rematch = 0; L.pasteErr = ''; L.scanErr = '';
    buildDuel(); saveAll(); window.scrollTo({ top: 0 }); render(true);
  } catch (e) {
    if (fromScan) { L.scanErr = e.message; D.phase = 'scan'; render(true); setTimeout(() => { if (D.phase === 'scan' && !scan) startScan(); }, 1500); }
    else { L.pasteErr = e.message; render(true); }
  }
}

/* ---------- render ---------- */
function render(force) {
  if (!force && anim && !anim.done) return;
  const focused = document.activeElement && document.activeElement.id;
  const caret = focused && document.activeElement.selectionStart;
  $('#app').innerHTML = MODE === 'duel' ? duelView() : localView();
  if (focused) { const el = document.getElementById(focused); if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { } } }
}
const top0 = () => window.scrollTo({ top: 0 });
function go(fn) { fn(); saveAll(); render(true); }

/* ---------- input ---------- */
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'pastebox') { D.paste = e.target.value; return; }
  if (id === 'spd') { setSpeed(+e.target.value); return; }
  const m = id && id.match(/^name(\d)$/); if (!m) return;
  const team = MODE === 'duel' ? D.me : S.teams[+m[1]];
  team.name = e.target.value; saveAll();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rn') { e.preventDefault(); const b = $('#rnok'); if (b) b.click(); } });
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id !== 'restart') L.restartArm = false;

  if (b.dataset.mode) { stopScan(); MODE = b.dataset.mode; return go(() => { }); }
  if (b.dataset.rename != null) { L.rename = +b.dataset.rename; render(true); const i = $('#rn'); if (i) i.focus(); return; }
  if (b.id === 'rnok') {
    const v = (($('#rn') || {}).value || '').trim(), t = L.rename; L.rename = null;
    if (v) { if (MODE === 'duel') D.me.name = v; else S.teams[t].name = v; saveAll(); }
    return render(true);
  }
  if (b.dataset.form || b.dataset.style) {
    const [t, v] = (b.dataset.form || b.dataset.style).split(':'), key = b.dataset.form ? 'form' : 'style';
    return go(() => { (MODE === 'duel' ? D.me : S.teams[+t])[key] = v; });
  }
  if (b.dataset.dmode) return go(() => { S.draftMode = b.dataset.dmode; });
  if (b.dataset.opt != null) { L.sel = +b.dataset.opt; return render(true); }
  if (b.dataset.pen != null) {
    const team = MODE === 'duel' ? D.me : T(S.penTeam), id = +b.dataset.pen, k = team.pens.indexOf(id);
    if (k >= 0) team.pens.splice(k, 1); else if (team.pens.length < 5) team.pens.push(id);
    return go(() => { });
  }
  switch (b.id) {
    case 'restart':
      if (!L.restartArm) { L.restartArm = true; return render(true); }
      L.restartArm = false; stopAnims(); stopScan();
      return go(() => { if (MODE === 'duel') D = freshDuel(D); else S = freshLocal(S); });
    case 'skip': if (anim) { clearTimeout(anim.t); anim.done = true; } return render(true);
    case 'fast': return setSpeed(FAST_SPEED);
    case 'skipk': if (kickAnim) { clearTimeout(kickAnim.t); kickAnim.shown = PENS().kicks.length; } return render(true);
  }
  return MODE === 'duel' ? duelClick(b.id) : localClick(b.id);
});
function localClick(id) {
  switch (id) {
    case 'go': return go(localStartDraft);
    case 'ready': return go(() => { S.phase = 'draft'; });
    case 'reroll': return go(() => { const [t, s] = S.steps[S.si]; if (T(t).reroll < 1) return; T(t).reroll--; S.opts = drawOptions(T(t), s, S.opts); L.sel = null; });
    case 'pick':
      if (L.sel == null) return;
      return go(() => { const [t, s] = S.steps[S.si]; T(t).picks[s] = S.opts[L.sel]; S.si++; if (S.si >= S.steps.length) { S.phase = 'reveal'; top0(); } else localEnterStep(false); });
    case 'kick': {
      const leg = S.matches.length;
      S.matches.push(leg === 0 ? simMatch(0, 1) : simMatch(1, 0));
      S.phase = 'match'; saveAll(); top0(); return animateMatch(leg);
    }
    case 'next':
      top0();
      if (S.matches.length === 1) return go(() => { S.phase = 'between'; });
      if (tieWinner(S.matches) < 0) return go(() => { S.phase = 'penpick'; S.penTeam = 0; S.teams.forEach(t => { t.pens = []; }); });
      return go(() => { S.phase = 'end'; });
    case 'penok':
      if (T(S.penTeam).pens.length < 5) return;
      top0();
      if (S.penTeam === 0) return go(() => { S.penTeam = 1; });
      S.pens = simShootout(); S.phase = 'shootout'; saveAll(); return animateShootout();
    case 'final': kickAnim = null; top0(); return go(() => { S.phase = 'end'; });
    case 'again': stopAnims(); top0(); return go(() => { S.matches = []; S.pens = null; S.teams.forEach(t => { t.pens = []; }); S.phase = 'reveal'; });
    case 'newdraft': stopAnims(); top0(); return go(() => { S = freshLocal(S); });
  }
}
function duelClick(id) {
  const me = D.me;
  switch (id) {
    case 'dstart':
      if (!(me.name || '').trim()) { L.nameErr = 'Dai un nome alla tua squadra: lo vedrà anche l\'altro telefono.'; return render(true); }
      L.nameErr = ''; top0();
      return go(() => { me.name = me.name.trim(); me.picks = Array(11).fill(null); me.reroll = 1; me.pens = []; D.slot = 0; D.opts = drawOptions(me, 0); L.sel = null; D.phase = 'draft'; });
    case 'reroll': return go(() => { if (me.reroll < 1) return; me.reroll--; D.opts = drawOptions(me, D.slot, D.opts); L.sel = null; });
    case 'pick':
      if (L.sel == null) return;
      return go(() => { me.picks[D.slot] = D.opts[L.sel]; D.slot++; L.sel = null; if (D.slot >= 11) { D.phase = 'pens'; D.opts = []; top0(); } else D.opts = drawOptions(me, D.slot); });
    case 'dpenok':
      if (me.pens.length < 5) return;
      top0(); return go(() => { D.myCode = encodeTeam(me); D.phase = 'code'; });
    case 'scan': return startScan();
    case 'stopscan': stopScan(); return go(() => { D.phase = 'code'; });
    case 'topaste': stopScan(); L.pasteErr = ''; return go(() => { D.phase = 'paste'; });
    case 'tocode': return go(() => { D.phase = 'code'; });
    case 'pasteok': return useOppCode(D.paste, false);
    case 'copy': {
      const done = () => { L.copied = true; render(true); setTimeout(() => { L.copied = false; render(); }, 1500); };
      try { navigator.clipboard.writeText(D.myCode).then(done, () => { }); } catch (e) { }
      return;
    }
    case 'redraft': top0(); return go(() => { D = freshDuel(D); });
    case 'dkick': D.shown++; D.phase = 'match'; saveAll(); top0(); return animateMatch(D.shown - 1);
    case 'dnext':
      top0();
      if (D.shown === 1) return go(() => { D.phase = 'between'; });
      if (tieWinner(D.all.m) < 0) { D.phase = 'shootout'; saveAll(); return animateShootout(); }
      return go(() => { D.phase = 'end'; });
    case 'dfinal': kickAnim = null; top0(); return go(() => { D.phase = 'end'; });
    case 'drematch': stopAnims(); top0(); D.rematch++; buildDuel(); return go(() => { });
    case 'newopp': stopAnims(); top0(); return go(() => { D.oppCode = ''; D.all = null; D.teams = null; D.shown = 0; D.rematch = 0; D.phase = 'code'; });
    case 'dnew': stopAnims(); top0(); return go(() => { D = freshDuel(D); });
  }
}

/* ripresa dopo un ricaricamento */
if (S.phase === 'match' && !S.matches.length) S.phase = 'reveal';
if (S.phase === 'shootout' && !S.pens) S.phase = 'penpick';
if (S.phase === 'draft' && (!S.steps.length || S.si >= S.steps.length)) S.phase = 'setup';
if (D.phase === 'scan') D.phase = 'code';
if (['reveal', 'match', 'between', 'shootout', 'end'].includes(D.phase) && !D.all) D.phase = D.myCode ? 'code' : 'setup';
render();
