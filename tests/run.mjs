// Test senza dipendenze: node tests/run.mjs
// Carica data.js e app.js in contesti separati (uno per "telefono") con un DOM finto.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url);
const src = ['data.js', 'app.js'].map(f => fs.readFileSync(new URL(f, root), 'utf8')).join('\n;\n');

function phone() {
  const app = { innerHTML: '' }, handlers = {}, ls = {};
  const ctx = {
    console, setTimeout: (f) => setTimeout(f, 0), clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
    TextEncoder, TextDecoder, Uint8Array,
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    document: { querySelector: s => s === '#app' ? app : null, getElementById: () => null, activeElement: null, addEventListener: (t, f) => { handlers[t] = f; } },
    navigator: {}, qrcode: undefined, jsQR: undefined,
  };
  ctx.window = { scrollTo() { }, matchMedia: () => ({ matches: true }) };
  ctx.matchMedia = ctx.window.matchMedia;
  vm.createContext(ctx);
  vm.runInContext(src.replace(/^'use strict';/m, ''), ctx);
  const click = (id, data = {}) => handlers.click({ target: { closest: () => ({ id, dataset: data }) } });
  return { app, click, ev: s => vm.runInContext(s, ctx) };
}

let failures = 0;
const test = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { failures++; console.log('FAIL', name, '\n     ', e.message); } };

// draft completo su un telefono in modalità "due telefoni", fino al codice squadra
function draftDuel(p, name) {
  p.click('', { mode: 'duel' });
  p.ev(`D.me.name=${JSON.stringify(name)}`);
  p.click('dstart');
  for (let i = 0; i < 11; i++) { p.click('', { opt: '0' }); p.click('pick'); }
  const picks = JSON.parse(p.ev('JSON.stringify(D.me.picks)'));
  picks.slice(0, 5).forEach(id => p.click('', { pen: String(id) }));
  p.click('dpenok');
  return p.ev('D.myCode');
}

test('codice squadra: andata e ritorno', () => {
  const p = phone();
  const code = draftDuel(p, 'Leoni àè');
  const t = JSON.parse(p.ev(`JSON.stringify(decodeTeam(${JSON.stringify(code)}))`));
  assert.equal(t.name, 'Leoni àè');
  assert.deepEqual(t.picks, JSON.parse(p.ev('JSON.stringify(D.me.picks)')));
  assert.equal(t.pens.length, 5);
  assert.throws(() => p.ev(`decodeTeam(${JSON.stringify(code.slice(0, -2) + 'AA')})`));
});

test('due telefoni calcolano la stessa sfida', () => {
  for (let round = 0; round < 50; round++) {
    const a = phone(), b = phone();
    const ca = draftDuel(a, 'Casa'), cb = draftDuel(b, 'Ospiti');
    a.click('topaste'); a.ev(`D.paste=${JSON.stringify(cb)}`); a.click('pasteok');
    b.click('topaste'); b.ev(`D.paste=${JSON.stringify(ca)}`); b.click('pasteok');
    assert.equal(a.ev('D.phase'), 'reveal');
    assert.equal(a.ev('D.check'), b.ev('D.check'));
    assert.equal(a.ev('JSON.stringify(D.all)'), b.ev('JSON.stringify(D.all)'));
    assert.equal(a.ev('D.myIdx') + b.ev('D.myIdx'), 1);
    a.click('drematch'); b.click('drematch');
    assert.equal(a.ev('JSON.stringify(D.all)'), b.ev('JSON.stringify(D.all)'));
  }
});

test('flusso completo due telefoni fino al risultato', () => {
  const a = phone(), b = phone();
  const ca = draftDuel(a, 'A'), cb = draftDuel(b, 'B');
  a.click('topaste'); a.ev(`D.paste=${JSON.stringify(cb)}`); a.click('pasteok');
  a.click('dkick'); a.click('dnext'); a.click('dkick'); a.click('dnext');
  if (a.ev('D.phase') === 'shootout') a.click('dfinal');
  assert.equal(a.ev('D.phase'), 'end');
  assert.match(a.app.innerHTML, /Passa il turno/);
});

test('flusso completo un telefono', () => {
  const p = phone();
  p.click('go');
  let guard = 0;
  while (p.ev('S.phase') !== 'reveal' && guard++ < 200) {
    if (p.ev('S.phase') === 'handoff') p.click('ready'); else { p.click('', { opt: '0' }); p.click('pick'); }
  }
  p.click('kick'); p.click('next'); p.click('kick'); p.click('next');
  if (p.ev('S.phase') === 'penpick') {
    for (const t of [0, 1]) { JSON.parse(p.ev(`JSON.stringify(S.teams[${t}].picks.slice(0,5))`)).forEach(id => p.click('', { pen: String(id) })); p.click('penok'); }
    p.click('final');
  }
  assert.equal(p.ev('S.phase'), 'end');
});

test('il draft offre sempre almeno una scelta, senza doppioni', () => {
  const p = phone();
  for (const f of ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1']) for (let r = 0; r < 200; r++) {
    p.ev(`(()=>{const t={form:'${f}',picks:Array(11).fill(null)};for(let s=0;s<11;s++){const o=drawOptions(t,s);if(!o.length)throw new Error('vuoto');t.picks[s]=o[Math.floor(Math.random()*o.length)]}if(new Set(t.picks).size!==11)throw new Error('doppione')})()`);
  }
});

test('taratura: squadra forte contro debole', () => {
  const p = phone();
  const res = JSON.parse(p.ev(`(()=>{
    const best=r=>PL.filter(x=>x.roles.includes(r)).sort((a,b)=>lv(b.id)-lv(a.id));
    const mk=(rev)=>{const t={name:'x',form:'4-4-2',style:'bal',picks:[],pens:[]};FORM['4-4-2'].forEach(([r])=>{const l=best(r).filter(x=>!t.picks.includes(x.id));t.picks.push((rev?l[l.length-1]:l[0]).id)});return t};
    S.teams=[mk(false),mk(true)];
    const s=[strength(0),strength(1)];let w=0,d=0,N=20000;
    for(let i=0;i<N;i++){const m=simMatch(i%2,1-(i%2));const o=legWinner(m);if(o===0)w++;else if(o<0)d++}
    return JSON.stringify({s,win:w/N,draw:d/N});})()`));
  console.log(`      medie ${res.s.map(x => x.toFixed(2)).join(' vs ')} → vince la forte ${(res.win * 100).toFixed(1)}%, pareggi ${(res.draw * 100).toFixed(1)}%`);
  assert.ok(res.win > 0.6 && res.win < 0.97);
});

console.log(failures ? `\n${failures} test falliti` : '\nTutti i test passati');
process.exit(failures ? 1 : 0);
