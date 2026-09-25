// Balast i Ocieplenie — dane startowe i migracje zapisanego stanu.
// Copyright (c) 2026 Maciej Korzeniowski. Wszelkie prawa zastrzeżone / All rights reserved.
// Kopiowanie i utwory zależne wymagają pisemnej zgody autora — zobacz LICENSE.
// ===== Dane startowe wersji publicznej: przykładowy nurek, bez nurkowań =====
function fromCat(id, extra){
  const c = CATALOG.find(x => x.id === id);
  return Object.assign({uid: id + '-1', catId: id, cat: c.cat, brand: c.brand, model: c.model, size: '', year: null, p: JSON.parse(JSON.stringify(c.p)), src: c.src}, extra || {});
}
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const diverId = () => 'p-' + Math.random().toString(36).slice(2, 8);
const BASE_PROFILE = {name:'', sex:'M', age:40, height:178, weight:80, build:'average', bf:'', coldTol:0, divesBefore:0};

// Akwen, od którego startuje nowy nurek: w wersji centrum — jego domowy akwen (BRAND.site),
// w głównej — Marsa Alam. Temperatury bierzemy z presetu na bieżący miesiąc.
const HOME_SITE = () => (typeof BRAND !== 'undefined' && BRAND && BRAND.site) || 'marsaalam';
function homePlanTemps(siteId, date){
  const pre = SITE_PRESETS.find(x => x.id === siteId) || SITE_PRESETS[0], m = +date.slice(5, 7) - 1;
  return {tSurf: pre.ts[m], tBottom: pre.tb[m]};
}
// Nurek bez danych: kreator dopyta o profil (onboarded=false), szafa ma tylko automat.
function emptyDiver(){
  const siteId = HOME_SITE(), date = isoOf(new Date());
  return {
    id: diverId(), onboarded: false,
    profile: Object.assign({}, BASE_PROFILE),
    wardrobe: [fromCat('misc-reg')],
    dives: [],
    plan: Object.assign({siteId, date, depth:18, time:50, nDay:2, reserve:50, items:['misc-reg-1']}, homePlanTemps(siteId, date))
  };
}
// Przykładowy nurek z kompletnym zestawem — „Wczytaj przykład” i pierwsze uruchomienie.
function seedDiver(){
  const y = new Date().getFullYear();
  const d = new Date(); d.setDate(d.getDate() + 14);
  const date = isoOf(d);
  const s = {
    id: diverId(), onboarded: false,
    profile: Object.assign({}, BASE_PROFILE, {divesBefore: 20}),
    wardrobe: [
      fromCat('mares-reef-3', {year:y}), fromCat('gen-vest-hood-5', {year:y}), fromCat('mares-flexa-boots-5', {year:y}),
      fromCat('mares-prestige', {year:y}), fromCat('al-s80'), fromCat('st-12-232'),
      fromCat('fin-mares-aq-plus', {year:y}), fromCat('misc-reg')
    ],
    dives: [],
    plan: {siteId:'marsaalam', date, depth:18, time:50, tSurf:26, tBottom:25, nDay:2, reserve:50,
      items:['mares-reef-3-1','mares-prestige-1','al-s80-1','fin-mares-aq-plus-1','misc-reg-1']}
  };
  const m = +date.slice(5, 7) - 1; s.plan.tSurf = SITE_PRESETS[0].ts[m]; s.plan.tBottom = SITE_PRESETS[0].tb[m];
  return s;
}
const seedSites = () => SITE_PRESETS.map(x => Object.assign({preset:true}, JSON.parse(JSON.stringify(x))));

// Pierwsze uruchomienie: pusty nurek i pusta szafa — kreator dopyta o profil i sprzęt.
// Przykładowy nurek zostaje tylko pod „Wczytaj przykład" w Profilu.
function freshState(){
  const d = emptyDiver();
  return {v: 1, sites: seedSites(), profiles: [d], activeId: d.id};
}
function seedState(){
  const d = seedDiver();
  return {v: 1, sites: seedSites(), profiles: [d], activeId: d.id};
}

// ===== Migracja zapisanego stanu do bieżącego schematu =====
// Zwraca poprawiony stan albo null, jeśli to nie są dane tej aplikacji.
// Używana przy starcie (load) i przy imporcie kopii — także kopii sprzed wielu profili.
function migrate(o){
  if (!o || typeof o !== 'object' || o.v !== 1) return null;
  const S = Object.assign({}, o);
  if (!Array.isArray(S.profiles)){
    // schemat jednego nurka: profil, szafa, dziennik i plan leżały bezpośrednio w S
    if (!o.profile || !Array.isArray(o.wardrobe)) return null;
    const d = {id: diverId(), onboarded: true, profile: o.profile, wardrobe: o.wardrobe, dives: Array.isArray(o.dives) ? o.dives : [], plan: o.plan || emptyDiver().plan};
    if (o.learnSince) d.learnSince = o.learnSince;
    S.profiles = [d]; S.activeId = d.id;
    delete S.profile; delete S.wardrobe; delete S.dives; delete S.plan; delete S.learnSince;
  }
  if (!S.profiles.length) S.profiles = [emptyDiver()];
  S.profiles.forEach(p => {
    if (!p.id) p.id = diverId();
    if (p.onboarded == null) p.onboarded = true;          // dane z dysku = profil już wypełniony
    if (!p.profile) p.profile = Object.assign({}, BASE_PROFILE);
    if (!Array.isArray(p.wardrobe)) p.wardrobe = [];
    if (!Array.isArray(p.dives)) p.dives = [];
    if (!p.plan) p.plan = emptyDiver().plan;
    if (p.profile.divesBefore == null) p.profile.divesBefore = Math.max(0, (+p.profile.dives || 0) - p.dives.length);
    // plan nie ma już pól na rezerwę i kolejność nurkowania — trzymamy w nim ostrożne założenia
    p.plan.reserve = 50;
    if (!(p.plan.nDay >= 2)) p.plan.nDay = 2;
    if (p.plan.time == null) p.plan.time = 50;
    p.wardrobe.forEach(w => { if (w.rental == null && /wypożycz/i.test(w.model)) w.rental = true; });
    p.wardrobe.forEach(w => { if (w.catId && /^misc-fins/.test(w.catId)) w.cat = 'fins'; });
  });
  // motyw: nowe pole, stare kopie go nie mają — brak i wartość spoza listy znaczą „jak w telefonie"
  if (!['auto', 'light', 'dark'].includes(S.theme)) S.theme = 'auto';
  // aktualności ukryte przez nurka (wersje centrów); pilnujemy typu i długości, bo lista tylko rośnie
  S.newsSeen = Array.isArray(S.newsSeen) ? S.newsSeen.filter(x => typeof x === 'string').slice(-60) : [];
  if (!Array.isArray(S.sites) || !S.sites.length) S.sites = seedSites();
  // współrzędne akwenów z listy bierzemy zawsze z presetu: nie ma ich w edytorze,
  // a zapisane kopie mogą nieść stare lub brakujące wartości (Honoratka była o 12 km obok)
  S.sites.forEach(s => {
    const pre = SITE_PRESETS.find(x => x.id === s.id);
    if (pre){ s.lat = pre.lat; s.lon = pre.lon; s.r = pre.r; if (pre.pts) s.pts = JSON.parse(JSON.stringify(pre.pts)); else delete s.pts; }
  });
  // nowe presety (np. Marsa Alam i Dahab osobno) dokładamy do list założonych wcześniej
  SITE_PRESETS.forEach(pre => {
    if (!S.sites.some(s => s.id === pre.id)) S.sites.push(Object.assign({preset: true}, JSON.parse(JSON.stringify(pre))));
  });
  // zbiorcze wpisy zmieniły znaczenie; nazwę poprawiamy tylko wtedy, gdy użytkownik jej nie zmienił
  const RENAMED = {redsea: ['Morze Czerwone (Marsa Alam, Dahab)', 'Morze Czerwone (inne)'], malta: ['Malta, Gozo', 'Malta']};
  S.sites.forEach(s => { const r = RENAMED[s.id]; if (r && s.name === r[0]) s.name = r[1]; });
  if (!S.profiles.some(p => p.id === S.activeId)) S.activeId = S.profiles[0].id;
  return S;
}
