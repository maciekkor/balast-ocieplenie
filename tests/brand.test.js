// Wersje centrów nurkowych: konfiguracja, aktualności, build i izolacja service workerów.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {loadApp} from './load.js';

const A = loadApp();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = path.join(ROOT, 'brands', '_example');
const example = () => JSON.parse(readFileSync(path.join(EXAMPLE, 'brand.json'), 'utf8'));
const hasIn = dir => p => existsSync(path.join(dir, p));

test('szablon centrum jest poprawną konfiguracją', () => {
  assert.deepEqual([...A.brandErrors(example(), hasIn(EXAMPLE), A.SITE_PRESETS)], []);
});

test('walidacja konfiguracji łapie typowe błędy', () => {
  const bad = (patch, re) => {
    const b = Object.assign(example(), patch);
    const errs = [...A.brandErrors(b, hasIn(EXAMPLE), A.SITE_PRESETS)];
    assert.ok(errs.some(e => re.test(e)), `oczekiwany błąd ${re} dla ${JSON.stringify(patch)}, jest: ${errs.join(' | ')}`);
  };
  bad({id: 'Divemania'}, /^id:/);                 // wielkie litery nie przejdą do adresu
  bad({id: 'icons'}, /zajęte/);                   // kolizja z katalogiem aplikacji
  bad({appName: 'Centrum Nurkowe XYZ'}, /12 znaków/);
  bad({logo: 'brak.svg'}, /nie ma pliku brak\.svg/);
  bad({logoDark: 'ciemne.svg'}, /logoDark: nie ma pliku ciemne\.svg/);
  bad({site: 'atlantyda'}, /akwenu „atlantyda”/);
  bad({colors: {light: {accent: 'blue', accentInk: '#fff', teal: '#000000', tealSoft: '#000000'}, dark: example().colors.dark}}, /colors\.light\.accent/);
  bad({news: [{img: 'news/wyjazd.svg', until: '31.10.2026'}]}, /until: data/);
  bad({news: [{img: 'news/wyjazd.svg', url: 'http://centrum.pl'}]}, /https/);
  bad({news: [{title: 'bez grafiki'}]}, /grafika jest wymagana/);
});

test('aktualności: termin, ukrycie, najwyżej dwie', () => {
  const n = (id, from, until) => ({id, img: id + '.jpg', from, until});
  const news = [n('a', '2026-09-01', '2026-09-30'), n('b', null, '2026-09-10'), n('c', '2026-10-01', null), n('d'), n('e')];
  const ids = (today, seen) => [...A.activeNews(news, today, seen)].map(x => x.id).join(',');
  assert.equal(ids('2026-09-20', []), 'a,d', 'b po terminie, c jeszcze nie, e poza limitem dwóch');
  assert.equal(ids('2026-09-30', []), 'a,d', 'until działa włącznie');
  assert.equal(ids('2026-09-20', ['a']), 'd,e', 'ukryta ustępuje miejsca następnej');
  assert.equal(ids('2026-10-05', ['d', 'e']), 'c');
  assert.equal(A.NEWS_MAX, 2);
  // bez id pamiętamy po grafice — nowa grafika pokaże się temu, kto ukrył poprzednią
  assert.equal(A.newsId({img: 'news/x.jpg'}), 'news/x.jpg');
  assert.equal(A.brandText({pl: 'Wyjazd'}, 'en'), 'Wyjazd', 'brak EN — bierzemy PL');
  assert.equal(A.brandText('Kurs', 'en'), 'Kurs');
});

test('kolory centrum nadpisują tokeny we wszystkich trzech blokach motywu', () => {
  const css = A.brandTokensCss(example());
  assert.ok(/^:root\{--accent:#0E7C66/.test(css), 'jasny w gołym :root');
  assert.ok(css.includes('@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--accent:#3CC4A6'), 'ciemny systemowy');
  assert.ok(css.includes(':root[data-theme="dark"]{--accent:#3CC4A6'), 'ciemny wymuszony');
});

test('migracja: newsSeen zawsze jest listą napisów', () => {
  assert.deepEqual([...A.migrate(A.seedState()).newsSeen], []);
  const st = Object.assign(A.seedState(), {newsSeen: ['a', 3, null, 'b']});
  assert.deepEqual([...A.migrate(st).newsSeen], ['a', 'b']);
});

// ---------- build z centrum ----------
function buildWith(prepare){
  const tmp = mkdtempSync(path.join(tmpdir(), 'bio-brand-'));
  const brands = path.join(tmp, 'brands'), out = path.join(tmp, 'dist');
  cpSync(EXAMPLE, path.join(brands, 'przyklad'), {recursive: true});
  if (prepare) prepare(path.join(brands, 'przyklad'));
  const res = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs')], {env: Object.assign({}, process.env, {BRANDS_DIR: brands, OUT_DIR: out}), encoding: 'utf8'});
  return {res, out, done: () => rmSync(tmp, {recursive: true, force: true})};
}

test('build: centrum dostaje własną aplikację pod własnym adresem', () => {
  const {res, out, done} = buildWith();
  try {
    assert.equal(res.status, 0, res.stderr);
    const dir = path.join(out, 'przyklad');
    const html = readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('const BRAND = {"id":"przyklad"'), 'BRAND wstawiony');
    assert.ok(html.includes('<title>Centrum Nurkowe Przykład · Balast i Ocieplenie</title>'));
    assert.ok(html.includes('content="Przykład"'), 'nazwa pod ikoną na iPhonie');
    assert.ok(html.includes(':root[data-theme="dark"]{--accent:#3CC4A6'), 'kolory centrum w arkuszu');
    const man = JSON.parse(readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8'));
    assert.equal(man.short_name, 'Przykład');
    assert.equal(man.id, './'); assert.equal(man.scope, './'); assert.equal(man.start_url, './');
    assert.equal(man.icons[0].src, 'brand/icon-192.png');
    assert.ok(existsSync(path.join(dir, 'brand', 'news', 'wyjazd.svg')), 'grafika aktualności skopiowana');
    assert.ok(!existsSync(path.join(dir, 'brand', 'brand.json')), 'konfiguracja nie jest publikowana osobno');
    const sw = readFileSync(path.join(dir, 'sw.js'), 'utf8');
    assert.ok(/const CACHE = "balast-przyklad-[0-9a-f]{8}"/.test(sw));
    assert.ok(sw.includes('"./brand/news/wyjazd.svg"'), 'aktualności działają offline');
    // główna wersja dalej jest główna i omija podkatalog centrum
    const main = readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.ok(main.includes('const BRAND = null;'));
    assert.ok(readFileSync(path.join(out, 'sw.js'), 'utf8').includes('const SKIP = ["./przyklad/"]'));
  } finally { done(); }
});

test('build: logo na ciemne tło jedzie z aplikacją i działa offline', () => {
  const {res, out, done} = buildWith(dir => {
    const b = JSON.parse(readFileSync(path.join(dir, 'brand.json'), 'utf8'));
    cpSync(path.join(dir, 'logo.svg'), path.join(dir, 'logo-dark.svg'));
    b.logoDark = 'logo-dark.svg'; writeFileSync(path.join(dir, 'brand.json'), JSON.stringify(b));
  });
  try {
    assert.equal(res.status, 0, res.stderr);
    const dir = path.join(out, 'przyklad');
    assert.ok(readFileSync(path.join(dir, 'index.html'), 'utf8').includes('"logoDark":"brand/logo-dark.svg"'));
    assert.ok(readFileSync(path.join(dir, 'sw.js'), 'utf8').includes('"./brand/logo-dark.svg"'));
    // który logotyp widać, rozstrzygają tokeny motywu — muszą być we wszystkich trzech blokach
    const css = readFileSync(path.join(ROOT, 'src', 'shell.html'), 'utf8');
    assert.equal((css.match(/--logo-l:none; --logo-d:block/g) || []).length, 2, 'oba ciemne bloki');
    assert.ok(css.includes('--logo-l:block; --logo-d:none'), 'jasny blok');
    assert.equal((css.match(/--logo-plate:#EEF3F3/g) || []).length, 2, 'plakietka w obu ciemnych blokach');
    assert.ok(css.includes('--logo-plate:transparent'), 'w jasnym plakietki nie widać');
  } finally { done(); }
});

test('build: zepsuta konfiguracja centrum zatrzymuje build', () => {
  const {res, out, done} = buildWith(dir => {
    const b = JSON.parse(readFileSync(path.join(dir, 'brand.json'), 'utf8'));
    b.appName = 'Nazwa zdecydowanie za długa'; b.news[0].img = 'news/nie-ma.jpg';
    writeFileSync(path.join(dir, 'brand.json'), JSON.stringify(b));
  });
  try {
    assert.equal(res.status, 1, 'build musi się nie udać');
    assert.ok(/12 znaków/.test(res.stderr) && /nie-ma\.jpg/.test(res.stderr), res.stderr);
    assert.ok(!existsSync(path.join(out, 'index.html')), 'nic nie trafia do dist/');
  } finally { done(); }
});

// ---------- service workery: wspólna pamięć przeglądarki, osobne cache ----------
function runWorker(file, scope, keys){
  const on = {}, deleted = [];
  const self = {addEventListener: (t, f) => { on[t] = f; }, registration: {scope}, skipWaiting(){}, clients: {claim(){}}};
  const caches = {keys: async () => keys, delete: async k => { deleted.push(k); return true; }, open: async () => ({addAll: async () => {}, match: async () => null, put(){}})};
  vm.runInNewContext(readFileSync(file, 'utf8'), {self, caches, URL, location: new URL(scope), fetch: async () => ({clone(){ return this; }})});
  return {on, deleted};
}
async function activate(w){ let p; w.on.activate({waitUntil: x => { p = x; }}); await p; return w.deleted.sort(); }

test('service workery nie kasują sobie nawzajem cache', async () => {
  const {res, out, done} = buildWith();
  try {
    assert.equal(res.status, 0, res.stderr);
    const mainSw = readFileSync(path.join(out, 'sw.js'), 'utf8'), brandSw = readFileSync(path.join(out, 'przyklad', 'sw.js'), 'utf8');
    const mainCur = mainSw.match(/const CACHE = "([^"]+)"/)[1], brandCur = brandSw.match(/const CACHE = "([^"]+)"/)[1];
    const keys = ['balast-1a2b3c4d', 'balast-main-00000000', mainCur, 'balast-przyklad-00000000', brandCur, 'balast-deepspot-12345678'];
    const base = 'https://maciekkor.github.io/balast-ocieplenie/';
    // główny: stary format sprzed podziału i własne stare wersje — nic z centrów
    assert.deepEqual(await activate(runWorker(path.join(out, 'sw.js'), base, keys)), ['balast-1a2b3c4d', 'balast-main-00000000']);
    // centrum: tylko własne stare wersje
    assert.deepEqual(await activate(runWorker(path.join(out, 'przyklad', 'sw.js'), base + 'przyklad/', keys)), ['balast-przyklad-00000000']);
    // główny nie odpowiada za podkatalog centrum
    const w = runWorker(path.join(out, 'sw.js'), base, keys);
    let answered = false;
    w.on.fetch({request: {method: 'GET', url: base + 'przyklad/index.html'}, respondWith(){ answered = true; }});
    assert.equal(answered, false, 'żądanie z podkatalogu centrum zostaje dla jego workera');
    w.on.fetch({request: {method: 'GET', url: base + 'index.html'}, respondWith(){ answered = true; }});
    assert.equal(answered, true, 'własne żądania obsługuje');
  } finally { done(); }
});

test('nowy nurek w wersji centrum startuje z domowego akwenu', () => {
  const B = loadApp(['data.js', 'model.js', 'import.js', 'seed.js', 'i18n.js', 'brand.js'].map(f => f));
  assert.equal(B.emptyDiver().plan.siteId, 'marsaalam', 'wersja główna bez zmian');
  const ctx = vm.createContext({console, BRAND: {site: 'koparki'}});
  const src = ['data.js', 'model.js', 'import.js', 'seed.js'].map(f => readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
  vm.runInContext(src + '\n;globalThis.__d = emptyDiver();', ctx);
  assert.equal(ctx.__d.plan.siteId, 'koparki');
  const pre = B.SITE_PRESETS.find(s => s.id === 'koparki'), m = +ctx.__d.plan.date.slice(5, 7) - 1;
  assert.equal(ctx.__d.plan.tBottom, pre.tb[m], 'temperatura dna z presetu domowego akwenu na ten miesiąc');
});
