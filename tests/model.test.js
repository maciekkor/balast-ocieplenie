import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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

test('katalog: uczciwe źródła i brak duplikatów nazw', () => {
  // „producent (grubość)” wolno deklarować tylko wtedy, gdy grubość jest częścią oznaczenia modelu
  const overclaimed = A.CATALOG.filter(c => /producent/.test(c.src) && /grubość/.test(c.src) && !/\d\s*mm|\d[./]\d/.test(c.model));
  // uwaga: tablice z katalogu żyją w kontekście vm, więc porównujemy długości, nie obiekty
  assert.equal(overclaimed.length, 0, 'źródło „producent (grubość)” bez grubości w nazwie modelu: ' + overclaimed.map(c => c.id).join(', '));
  const names = A.CATALOG.map(c => c.brand + ' ' + c.model);
  const dups = names.filter((n, i) => names.indexOf(n) !== i);
  assert.equal(dups.length, 0, 'dwie pozycje o tej samej nazwie: ' + dups.join(', '));
  // wartości nie od producenta muszą się do tego przyznawać
  for (const c of A.CATALOG) assert.ok(/producent|szacunek|wpisz|wypiera/.test(c.src), c.id + ': nieczytelne źródło „' + c.src + '”');
});

test('twinset i stage: butle liczone tą samą fizyką', () => {
  const buoy = id => A.itemBuoy(A.fromCat(id), A.diverState(A.seedState()).profile, ctx);
  const single = buoy('st-12-232'), twin = buoy('tw-2x12-232');
  // twinset to dwie butle plus manifold i obejmy — musi ciągnąć w dół mocniej niż dwie pojedyncze
  assert.ok(twin < 2 * single, `twinset ${twin} nie jest cięższy od dwóch butli ${2 * single}`);
  assert.ok(twin > 2 * single - 5, 'twinset nie może być cięższy o więcej niż kilka kg od dwóch butli');
  // stage liczy się jak butla: aluminiowa S80 pusta z rezerwą unosi
  const stage = buoy('stg-al-s80');
  assert.ok(stage > 0, `aluminiowy stage powinien unosić, jest ${stage}`);
  assert.ok(Math.abs(stage - buoy('al-s80')) < 0.5, 'stage S80 ma wypornosć zbliżoną do tej samej butli w roli podstawowej');
  // stage nie zastępuje butli podstawowej — to osobna kategoria
  assert.equal(A.CATALOG.find(c => c.id === 'stg-al-s80').cat, 'stage');
  assert.equal(A.CATALOG.find(c => c.id === 'tw-2x12-232').cat, 'tank');
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

test('zasolenie akwenu: gęstość wody zmienia wyporność każdej kategorii', () => {
  const pr = A.diverState(A.seedState()).profile;
  const at = (id, rho) => A.itemBuoy(A.fromCat(id), pr, {rho, depth:5, reserve:50, year:2026});
  // 1.025 to punkt kalibracji: w morzu pozycja ma dokładnie tyle, ile mówi katalog
  assert.ok(Math.abs(at('santi-elite', 1.025) - 0.3) < 1e-9, 'suchy skafander w morzu = wartość z katalogu');
  assert.ok(Math.abs(at('mares-prestige', 1.025) - 1.0) < 1e-9, 'kamizelka w morzu = wartość z katalogu');
  assert.ok(Math.abs(at('xdeep-zeos28', 1.025) + 0.2) < 1e-9, 'skrzydło w morzu = wartość z płyty');
  assert.ok(Math.abs(at('misc-reg', 1.025) + 0.9) < 1e-9, 'automat w morzu = wartość z katalogu');
  // w wodzie słodkiej ta sama rzecz wypiera tyle samo litrów, ale mniej kilogramów
  for (const id of ['santi-elite','santi-bz400x','mares-prestige','xdeep-zeos28','fin-mares-aq-plus','misc-reg','sp-everflex-75','st-12-232'])
    assert.ok(at(id, 1.000) < at(id, 1.029) - 0.02, id + ': wyporność nie reaguje na zasolenie');
  // konkretne liczby: suchy skafander 0,188 kg w słodkiej wobec 0,300 w morzu (V ≈ 4,5 l × 0,025)
  assert.ok(Math.abs(at('santi-elite', 1.000) - 0.188) < 0.005, 'suchy skafander w słodkiej wodzie: ' + at('santi-elite', 1.000));
  assert.ok(Math.abs(at('mares-prestige', 1.000) - 0.888) < 0.005, 'kamizelka w słodkiej wodzie: ' + at('mares-prestige', 1.000));
});

test('zasolenie akwenu: w Bałtyku mniej ołowiu niż w Morzu Czerwonym', () => {
  const pr = A.diverState(A.seedState()).profile;
  const lead = rho => {
    const items = ['santi-elite','santi-bz400x','xdeep-zeos28','fin-mares-aq-plus','misc-reg','st-12-232'].map(A.fromCat);
    return A.roundUpHalf(A.toDry(A.physics(items, pr, {rho, depth:5, reserve:50, year:2026}).total, rho));
  };
  const fresh = lead(1.000), baltic = lead(1.005), red = lead(1.029);
  assert.ok(fresh < baltic, `słodka ${fresh} nie jest lżejsza od Bałtyku ${baltic}`);
  assert.ok(baltic < red, `Bałtyk ${baltic} nie jest lżejszy od Morza Czerwonego ${red}`);
  // różnica jest duża — kilka kilogramów, nie zaokrąglenie
  assert.ok(red - fresh >= 2.5, `różnica słodka→Czerwone tylko ${red - fresh} kg`);
  // gęstości w presetach są ułożone tak, jak w rzeczywistości
  const rho = id => A.SITE_PRESETS.find(s => s.id === id).rho;
  assert.ok(rho('deepspot') < rho('baltic'), 'basen musi być słodszy od Bałtyku');
  assert.ok(rho('baltic') < rho('croatia'), 'Bałtyk musi być słodszy od Adriatyku');
  assert.ok(rho('croatia') < rho('marsaalam'), 'Adriatyk musi być słodszy od Morza Czerwonego');
});

test('płetwy i buty z masą: wyporność liczona', () => {
  const pr = A.diverState(A.seedState()).profile;
  assert.ok(A.itemBuoy(A.fromCat('fin-sp-jet'), pr, ctx) < -0.5);
  assert.ok(A.itemBuoy(A.fromCat('st-boots-titan-7'), pr, ctx) > 0);
});

test('motyw: migracja normalizuje pole, a arkusz zna oba wymuszenia', () => {
  // stare kopie nie mają pola — mają dostać „jak w telefonie", a nie undefined
  assert.equal(A.migrate(A.seedState()).theme, 'auto');
  const brudny = Object.assign(A.seedState(), {theme: 'różowy'});
  assert.equal(A.migrate(brudny).theme, 'auto', 'wartość spoza listy wraca do auto');
  for (const t of ['light', 'dark']){
    const st = Object.assign(A.seedState(), {theme: t});
    assert.equal(A.migrate(st).theme, t, t + ' ma przetrwać migrację');
  }
  // wymuszenie działa tylko wtedy, gdy CSS rozpoznaje oba atrybuty
  const css = readFileSync(new URL('../src/shell.html', import.meta.url), 'utf8');
  assert.ok(css.includes(':root[data-theme="dark"]'), 'brak reguły dla wymuszonego ciemnego');
  assert.ok(css.includes(':root:not([data-theme="light"])'), 'jasny nie przebija systemowego ciemnego');
});

test('app.js i sw.template.js parsują się', () => {
  // Reszta testów ładuje data/model/import/seed/i18n — app.js tylko czyta jako tekst,
  // więc literówka w składni przechodziła przez cały zestaw aż do przeglądarki.
  for (const f of ['app.js', 'sw.template.js']){
    const src = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    assert.doesNotThrow(() => new vm.Script(src, {filename: f}), f + ' ma błąd składni');
  }
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

test('import Suunto: nagłówek, zamienione nazwy temperatur i GPS w radianach', () => {
  // Kształt jak w prawdziwym eksporcie z aplikacji Suunto (Ocean/Nautic), ale bez cudzych danych:
  // „Max” w Header.Temperature bywa chłodniejsze niż „Min”, a współrzędne są w radianach.
  const file = JSON.stringify({DeviceLog: {
    Header: {ActivityType: 51, DateTime: '2026-08-15T10:54:09.830+02:00', Depth: {Max: 27.99},
      DiveTime: 1911.2, Duration: 2218.479, Temperature: {Max: 290.3, Min: 298.5}, Notes: '',
      Device: {Info: {HW: 'Seal_RevA3'}, Name: 'Porvoo'}},
    Samples: [
      {TimeISO8601: '2026-08-15T10:54:17.870+02:00', Temperature: 297.67},
      {TimeISO8601: '2026-08-15T11:10:00.000+02:00', Temperature: 290.3, Depth: 27.79},
      {TimeISO8601: '2026-08-15T11:26:59.000+02:00', Latitude: 0.7819315904371371, Longitude: 0.25764416551186664}
    ]}});
  const r = A.parseSuuntoJson(file);
  assert.equal(r.ok, true);
  assert.equal(r.dive.date, '2026-08-15');
  assert.equal(r.dive.depth, 28);
  assert.equal(r.dive.time, 32, 'DiveTime w sekundach → minuty');
  assert.equal(r.dive.tSurf, 24.5, 'najcieplejsza próbka to powierzchnia');
  assert.equal(r.dive.tBottom, 17.2, 'najzimniejsza to dno');
  assert.equal(r.dive.gps.lat, 44.8014, 'radiany → stopnie');
  assert.equal(r.dive.gps.lon, 14.7619);
});

test('import Suunto: bez próbek liczy z nagłówka, śmieci odrzuca', () => {
  const only = JSON.stringify({DeviceLog: {Header: {ActivityType: 51, DateTime: '2026-05-05T08:00:00+02:00',
    Depth: {Max: 18.4}, DiveTime: 2400, Temperature: {Max: 285.15, Min: 295.15}}}});
  const r = A.parseSuuntoJson(only);
  assert.equal(r.ok, true);
  assert.equal(r.dive.time, 40);
  assert.equal(r.dive.tSurf, 22, 'cieplejsza z pary to powierzchnia, mimo nazwy „Min”');
  assert.equal(r.dive.tBottom, 12);
  assert.equal(r.dive.gps, null);
  assert.equal(A.parseSuuntoJson('').why, 'notJson');
  assert.equal(A.parseSuuntoJson('{"foo":1}').why, 'notSuunto');
  assert.equal(A.parseSuuntoJson(JSON.stringify({DeviceLog: {Header: {ActivityType: 1, DateTime: '2026-01-01T10:00:00+01:00'}}})).why, 'notDive');
  assert.equal(A.kelvinToC(273.15), 0);
});

test('najbliższy akwen z przycisku: liczy się dystans, nie zasięg rejonu', () => {
  const sites = A.seedSites();
  const near = (lat, lon) => { const m = A.nearestSite({lat, lon}, sites); return m && m.id; };
  // zgłoszone z Warszawy: Deepspot 45 km, ale poza swoim promieniem — a Bałtyk to teraz pas wybrzeża, nie koło o promieniu 400 km
  assert.equal(near(52.2297, 21.0122), 'deepspot', 'z Warszawy najbliżej jest Deepspot, nie Bałtyk');
  assert.equal(A.matchSite({lat: 52.2297, lon: 21.0122}, sites), null, 'reguła rejonowa nie ma z Warszawy żadnego trafienia — bo nikt tam nie nurkuje');
  assert.equal(near(52.22, 18.25), 'honoratka', 'spod Konina najbliżej Honoratka');
  assert.equal(near(54.52, 18.53), 'baltic', 'z Gdyni najbliżej Bałtyk');
  assert.equal(near(50.06, 19.94), 'zakrzowek', 'z Krakowa najbliżej Zakrzówek — leży w samym mieście');
  assert.equal(near(50.20, 19.28), 'koparki', 'z Jaworzna najbliżej Koparki');
  assert.equal(near(50.57, 21.68), 'tarnobrzeskie', 'z Tarnobrzega najbliżej Jezioro Tarnobrzeskie');
  assert.equal(near(53.75, 21.30), 'pilakno', 'spod Mrągowa najbliżej Piłakno');
  assert.equal(near(35.68, 139.69), null, 'z Tokio żaden akwen nie jest blisko');
  assert.equal(A.nearestSite(null, sites), null);
});

test('akwen z listy nurkowisk: odległość do najbliższego, promień na punkt', () => {
  const sites = A.seedSites(), baltic = sites.find(s => s.id === 'baltic');
  // Gdynia: środek Bałtyku z jednym punktem leżał 180 km dalej, lista nurkowisk daje kilka km
  assert.ok(A.siteDistKm({lat: 54.52, lon: 18.53}, baltic) < 10, 'z Gdyni do Bałtyku to kilka km');
  // akwen bez listy liczy się od swojego środka
  const deep = sites.find(s => s.id === 'deepspot');
  assert.ok(A.siteDistKm({lat: deep.lat, lon: deep.lon}, deep) < 0.1);
  // promień bierzemy z punktu, nie z akwenu: punkt o r = 20 łapie pozycję 15 km od siebie,
  // choć domyślny promień akwenu to 15
  const wide = {id:'x', lat:54.83, lon:18.20, r:1, pts:[[54.83, 18.20, 20]]};
  assert.equal(A.matchSite({lat: 54.70, lon: 18.20}, [wide]).id, 'x', 'promień punktu ma pierwszeństwo przed promieniem akwenu');
  assert.equal(A.matchSite({lat: 54.20, lon: 18.20}, [wide]), null, 'poza promieniem punktu już nie łapie');
  // każdy punkt to [lat, lon, r] — trzy liczby albo dwie
  for (const s of sites) for (const pt of (s.pts || []))
    assert.ok(pt.length >= 2 && pt.length <= 3 && pt.every(x => typeof x === 'number'), s.id + ': zły punkt ' + JSON.stringify(pt));
});

test('dopasowanie akwenu do pozycji z komputera', () => {
  const sites = A.seedSites();
  const at = (lat, lon) => { const m = A.matchSite({lat, lon}, sites); return m && m.id; };
  assert.equal(at(44.8014, 14.7619), 'croatia', 'Rab leży w rejonie Adriatyku');
  assert.equal(at(25.07, 34.90), 'marsaalam', 'Marsa Alam ma własny wpis, nie zbiorczy redsea');
  assert.equal(at(28.50, 34.51), 'dahab', 'Dahab osobno');
  assert.equal(at(27.2, 33.8), 'redsea', 'Hurghada: brak własnego wpisu, zostaje zbiorcze Morze Czerwone');
  assert.equal(at(35.89, 14.45), 'malta');
  assert.equal(at(36.04, 14.24), 'gozo', 'Gozo bliżej niż Malta');
  assert.equal(at(52.98, 18.00), 'piechcin', 'kamieniołom trafiony w punkt');
  assert.equal(at(51.97, 20.51), 'deepspot');
  // pozycja z prawdziwego nurkowania w Honoratce: mały akwen musi wygrać z ogromnym Bałtykiem
  assert.equal(at(52.3402, 18.2686), 'honoratka', 'Honoratka, nie Bałtyk 278 km dalej');
  assert.equal(at(0, 0), null, 'Zatoka Gwinejska nie jest żadnym z akwenów');
  assert.equal(at(35.6, 139.7), null, 'Tokio też nie');
  assert.equal(A.matchSite(null, sites), null);
  // przy nakładających się promieniach wygrywa ten, w którego zasięgu pozycja siedzi głębiej (km/r)
  const m = A.matchSite({lat: 52.98, lon: 18.00}, sites);
  assert.ok(m.km <= 8, 'odległość raportowana w km: ' + m.km);
  // akwen dopisany ręcznie nie ma współrzędnych i nie bierze udziału
  assert.equal(A.matchSite({lat: 50, lon: 20}, [{id: 'x', name: 'Własny'}]), null);
  assert.ok(Math.abs(A.distanceKm(52, 21, 52, 22) - 68.5) < 2, 'stopień długości na 52°N to ~68 km');
});
