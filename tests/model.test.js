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
  const st = A.diverState(A.seedState());
  const L = A.learnLead(st);
  const p = A.predictLead(A.resolveItems(st.plan.items, st), st, ctx, L);
  assert.ok(p.rec > 2 && p.rec < 15, 'rec=' + p.rec);
  assert.ok(p.lo <= p.dry && p.dry <= p.hi);
  assert.equal(p.rec * 2, Math.round(p.rec * 2), 'zaokrąglenie do 0,5 kg');
});

test('nauka: nurkowanie „za lekko” podnosi prognozę', () => {
  const st = A.diverState(A.seedState());
  const items = st.plan.items;
  const L0 = A.learnLead(st);
  const before = A.predictLead(A.resolveItems(items, st), st, ctx, L0).dry;
  st.dives.push({id: 't1', date: '2026-01-01', siteId: 'redsea', depth: 18, time: 45, tSurf: 26, tBottom: 25, nDay: 1, reserve: 50,
    items, lead: Math.ceil(before), leadFb: 'light', leadAdj: 2, thermal: 'ok'});
  const after = A.predictLead(A.resolveItems(items, st), st, ctx, A.learnLead(st)).dry;
  assert.ok(after > before + 0.5, `${before} -> ${after}`);
});

test('płetwy i buty z masą: wyporność liczona', () => {
  const pr = A.diverState(A.seedState()).profile;
  assert.ok(A.itemBuoy(A.fromCat('fin-sp-jet'), pr, ctx) < -0.5);
  assert.ok(A.itemBuoy(A.fromCat('st-boots-titan-7'), pr, ctx) > 0);
});

test('i18n: każdy tekst w tr(...) w app.js ma tłumaczenie EN', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const keys = [...app.matchAll(/tr\('((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
  const missing = [...new Set(keys)].filter(k => A.EN[k] == null);
  assert.deepEqual(missing, []);
});

test('stan startowy: jeden nurek, kreator do wypełnienia', () => {
  const S = A.seedState();
  assert.equal(S.v, 1);
  assert.equal(S.profiles.length, 1);
  assert.equal(S.activeId, S.profiles[0].id);
  assert.equal(S.profiles[0].onboarded, false, 'pierwsze uruchomienie pyta o profil');
  assert.ok(S.sites.length, 'akweny wspólne w S.sites');
  assert.equal(A.emptyDiver().onboarded, false);
  assert.equal(A.emptyDiver().wardrobe.length, 1, 'pusta szafa to sam automat');
});

test('migracja: stan sprzed wielu profili trafia do S.profiles[]', () => {
  const old = {v: 1, lang: 'en', learnSince: '2026-01-01',
    profile: {name: 'Ala', sex: 'K', age: 30, height: 165, weight: 60, build: 'slim', bf: '', coldTol: 1, dives: 40},
    wardrobe: [A.fromCat('mares-reef-3'), {uid: 'x1', catId: null, cat: 'misc', brand: 'Własne', model: 'Jacket z wypożyczalni', size: '', year: null, p: {b: 0}, src: 'wpis własny'}],
    sites: A.seedSites(), dives: [{id: 'd1', date: '2026-02-02', siteId: 'redsea', items: [], lead: 6, leadFb: 'ok', leadAdj: 1}],
    plan: {siteId: 'redsea', date: '2026-03-03', depth: 18, time: 50, tSurf: 26, tBottom: 25, nDay: 1, reserve: 50, items: []}};
  const S = A.migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(S.profiles.length, 1);
  const p = S.profiles[0];
  assert.equal(S.activeId, p.id);
  assert.equal(p.onboarded, true, 'dane z dysku nie uruchamiają kreatora');
  assert.equal(p.profile.name, 'Ala');
  assert.equal(p.profile.divesBefore, 39, 'profile.dives − dziennik → divesBefore');
  assert.equal(p.dives.length, 1);
  assert.equal(p.learnSince, '2026-01-01');
  assert.equal(p.wardrobe[1].rental, true, 'nazwa „z wypożyczalni” → sprzęt wypożyczony');
  assert.equal(S.lang, 'en');
  assert.equal(S.profile, undefined, 'stare pola zniknęły z korzenia');
  assert.equal(S.wardrobe, undefined);
});

test('migracja: bieżący schemat przechodzi bez zmian, śmieci odrzucone', () => {
  const S = A.seedState();
  const out = A.migrate(JSON.parse(JSON.stringify(S)));
  assert.equal(out.profiles[0].onboarded, false, 'migracja nie zamyka kreatora');
  assert.equal(out.activeId, S.activeId);
  assert.equal(A.migrate(null), null);
  assert.equal(A.migrate({v: 2, profiles: []}), null);
  assert.equal(A.migrate({v: 1, hello: 'world'}), null);
});

test('wielu nurków: osobne szafy i dzienniki, wspólne akweny', () => {
  const S = A.seedState();
  const b = A.emptyDiver();
  b.profile = Object.assign({}, b.profile, {name: 'Bob', weight: 95, height: 186});
  S.profiles.push(b);
  const a1 = A.diverState(S, S.profiles[0].id), b1 = A.diverState(S, b.id);
  assert.notEqual(a1.wardrobe.length, b1.wardrobe.length);
  assert.equal(b1.dives.length, 0);
  assert.equal(a1.sites, b1.sites, 'akweny to ten sam obiekt dla obu nurków');
  b1.dives.push({id: 'bd1', date: '2026-04-04', siteId: 'redsea', items: [], lead: 8, leadFb: 'ok', leadAdj: 1});
  assert.equal(S.profiles[1].dives.length, 1, 'zapis trafia do właściwego nurka');
  assert.equal(S.profiles[0].dives.length, 0);
  assert.equal(A.diverState(S).id, S.profiles[0].id, 'domyślnie aktywny nurek');
  S.activeId = b.id;
  assert.equal(A.diverState(S).profile.name, 'Bob');
});
