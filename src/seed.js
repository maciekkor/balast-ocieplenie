// ===== Dane startowe wersji publicznej: przykładowy nurek, bez nurkowań =====
function fromCat(id, extra){
  const c = CATALOG.find(x => x.id === id);
  return Object.assign({uid: id + '-1', catId: id, cat: c.cat, brand: c.brand, model: c.model, size: '', year: null, p: JSON.parse(JSON.stringify(c.p)), src: c.src}, extra || {});
}
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const diverId = () => 'p-' + Math.random().toString(36).slice(2, 8);
const BASE_PROFILE = {name:'', sex:'M', age:40, height:178, weight:80, build:'average', bf:'', coldTol:0, divesBefore:0};

// Nurek bez danych: kreator dopyta o profil (onboarded=false), szafa ma tylko automat.
function emptyDiver(){
  return {
    id: diverId(), onboarded: false,
    profile: Object.assign({}, BASE_PROFILE),
    wardrobe: [fromCat('misc-reg')],
    dives: [],
    plan: {siteId:'redsea', date: isoOf(new Date()), depth:18, time:50, tSurf:26, tBottom:25, nDay:1, reserve:50, items:['misc-reg-1']}
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
    plan: {siteId:'redsea', date, depth:18, time:50, tSurf:26, tBottom:25, nDay:1, reserve:50,
      items:['mares-reef-3-1','mares-prestige-1','al-s80-1','fin-mares-aq-plus-1','misc-reg-1']}
  };
  const m = +date.slice(5, 7) - 1; s.plan.tSurf = SITE_PRESETS[0].ts[m]; s.plan.tBottom = SITE_PRESETS[0].tb[m];
  return s;
}
const seedSites = () => SITE_PRESETS.map(x => Object.assign({preset:true}, JSON.parse(JSON.stringify(x))));

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
    p.wardrobe.forEach(w => { if (w.rental == null && /wypożycz/i.test(w.model)) w.rental = true; });
    p.wardrobe.forEach(w => { if (w.catId && /^misc-fins/.test(w.catId)) w.cat = 'fins'; });
  });
  if (!Array.isArray(S.sites) || !S.sites.length) S.sites = seedSites();
  if (!S.profiles.some(p => p.id === S.activeId)) S.activeId = S.profiles[0].id;
  return S;
}
