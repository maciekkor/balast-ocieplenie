import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadApp} from './load.js';
const A = loadApp();
const ctx = {rho: 1.025, depth: 5, reserve: 50, year: 2026};

test('katalog: unikalne id, znane kategorie, wymagane pola', () => {
  const ids = A.CATALOG.map(c => c.id);
  assert.equal(ids.length, new Set(ids).size, 'duplikaty id');
  for (const c of A.CATALOG){
    assert.ok(A.CAT_ORDER.includes(c.cat), c.id + ' nieznana kategoria');
    assert.ok(c.brand && c.model && c.p && Array.isArray(c.sizes) && c.src, c.id + ' brak pól');
  }
});

test('komfort pianek zgodny z tabelami sklepów (±1 °C)', () => {
  const at = (ids, d) => A.thermalOfSet(ids.map(id => A.fromCat(id)), d).comfort;
  assert.ok(Math.abs(at(['mares-reef-3'], 20) - 22) < 1);
  assert.ok(Math.abs(at(['mares-flexa-543'], 20) - 17) < 1);
  assert.ok(Math.abs(at(['mares-evo-7'], 20) - 12) < 1.5);
  assert.ok(at(['mares-protherm-87'], 20) < 10);
});

test('temperatura nurkowania: 75% dno, 25% powierzchnia, kary', () => {
  assert.equal(A.tBreak({tBottom: 10, tSurf: 18, time: 45, nDay: 1}).t, 12);
  assert.equal(A.tBreak({tBottom: 10, tSurf: 18, time: 60, nDay: 2}).t, 10);
});

test('balast: przewidywanie w rozsądnym zakresie i przedział obejmuje wynik', () => {
  const st = A.seedState();
  const L = A.learnLead(st);
  const p = A.predictLead(A.resolveItems(st.plan.items, st), st, ctx, L);
  assert.ok(p.rec > 2 && p.rec < 15, 'rec=' + p.rec);
  assert.ok(p.lo <= p.dry && p.dry <= p.hi);
  assert.equal(p.rec * 2, Math.round(p.rec * 2), 'zaokrąglenie do 0,5 kg');
});

test('nauka: nurkowanie „za lekko” podnosi prognozę', () => {
  const st = A.seedState();
  const items = st.plan.items;
  const L0 = A.learnLead(st);
  const before = A.predictLead(A.resolveItems(items, st), st, ctx, L0).dry;
  st.dives.push({id: 't1', date: '2026-01-01', siteId: 'redsea', depth: 18, time: 45, tSurf: 26, tBottom: 25, nDay: 1, reserve: 50,
    items, lead: Math.ceil(before), leadFb: 'light', leadAdj: 2, thermal: 'ok'});
  const after = A.predictLead(A.resolveItems(items, st), st, ctx, A.learnLead(st)).dry;
  assert.ok(after > before + 0.5, `${before} -> ${after}`);
});

test('płetwy i buty z masą: wyporność liczona', () => {
  const pr = A.seedState().profile;
  assert.ok(A.itemBuoy(A.fromCat('fin-sp-jet'), pr, ctx) < -0.5);
  assert.ok(A.itemBuoy(A.fromCat('st-boots-titan-7'), pr, ctx) > 0);
});

test('i18n: każdy tekst w tr(...) w app.js ma tłumaczenie EN', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const keys = [...app.matchAll(/tr\('((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
  const missing = [...new Set(keys)].filter(k => A.EN[k] == null);
  assert.deepEqual(missing, []);
});
