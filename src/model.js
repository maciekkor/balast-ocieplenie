// Balast i Ocieplenie — fizyka balastu, komfort cieplny i nauka z ocen.
// Copyright (c) 2026 Maciej Korzeniowski. Wszelkie prawa zastrzeżone / All rights reserved.
// Kopiowanie i utwory zależne wymagają pisemnej zgody autora — zobacz LICENSE.
// ===== Model obliczeniowy =====
const RHO_PB = 11.34, RHO_NEO = 0.38, AIR = 0.00123; // kg/l
const COV = {full:0.90, longjohn:0.65, shorty:0.55, overhood:0.60, vest:0.40, hood:0.06, gloves:0.025, boots:0.035};
const TORSO = {full:1, longjohn:0.75, shorty:0.85, overhood:0.85, vest:0.6, hood:0, gloves:0, boots:0};
const PLATE = {steel:-1.9, alu:-0.5, soft:0.5};
const BUILD = {slim:-3, athletic:-6, muscular:-10, average:0, fuller:3, obese:5};
const PRIOR_SD = {wetsuit:0.8, over:0.8, hood:0.3, gloves:0.2, boots:0.2, dry:1.0, under:1.2, bcd:0.5, wing:0.5, tank:0.4, stage:0.4, fins:0.3};
const SD_BASE = 2.0, SD_NOISE = 0.7, HALF_LIFE = 30;
// doświadczenie: przesunięcie startowe korekty osobistej i jej niepewność
function totalDives(st){ return (+st.profile.divesBefore || 0) + st.dives.length; }
function expPrior(n){
  if (n < 25) return {mu: 1.0, sd: 2.5, label:'początkujący', key:'beg'};
  if (n < 100) return {mu: 0.5, sd: 2.0, label:'średnio zaawansowany', key:'mid'};
  if (n < 300) return {mu: 0.0, sd: 1.6, label:'doświadczony', key:'exp'};
  return {mu: -0.5, sd: 1.4, label:'bardzo doświadczony', key:'pro'};
}
const NEO_CATS = ['wetsuit','over','hood','gloves','boots'];

const compress = d => 0.6 * (1 - 1 / (1 + Math.max(0, d) / 10));
const bsa = pr => 0.007184 * Math.pow(pr.weight, 0.425) * Math.pow(pr.height, 0.725);
function bodyFat(pr){
  if (pr.bf != null && pr.bf !== '' && !isNaN(pr.bf)) return +pr.bf / 100;
  const bmi = pr.weight / Math.pow(pr.height / 100, 2);
  const bf = 1.2 * bmi + 0.23 * pr.age - 10.8 * (pr.sex === 'M' ? 1 : 0) - 5.4 + (BUILD[pr.build] || 0);
  return Math.min(0.5, Math.max(0.05, bf / 100));
}
function bodyBuoy(pr, rho){
  const bf = bodyFat(pr);
  const dens = 1 / (bf / 0.9007 + (1 - bf) / 1.100);
  const lungs = (pr.sex === 'M' ? 3.0 : 2.5) * pr.height / 175;
  return {tissue: pr.weight * (rho / dens - 1), lungs: lungs * rho, bf, dens};
}
function ageFactor(it, year){
  if (!it.year) return 1;
  const a = year - it.year;
  return a <= 0 ? 1 : a <= 3 ? 0.9 : 0.8;
}
function effT(p){ return p.tl != null ? (p.t + p.tl) / 2 : p.t; }

// Wyporność wpisana w katalogu w kilogramach dotyczy morza 1,025. Ta sama rzecz w innej wodzie
// wypiera tyle samo litrów, ale inaczej się to przelicza na kilogramy: B(ρ) = B + V·(ρ − 1,025).
// Objętość liczymy z masy, gdy ją znamy (V = (masa + B)/1,025), a w pozostałych kategoriach
// bierzemy typową — to te same rzędy wielkości co PLATE czy COV, opisane w SPEC 5.
const VDISP = {dry:4.5, dryCrushed:8.5, bcd:4.5, wing:4, fins:1.5, misc:1.6};
function dispVol(it){
  const p = it.p;
  if (p.vd != null) return p.vd;                                  // objętość podana wprost (butle)
  if (p.mass) return (p.mass / 1000 + (p.b || 0)) / 1.025;        // znana masa: objętość wprost z fizyki
  if (it.cat === 'dry') return p.shell === 'crushed' ? VDISP.dryCrushed : VDISP.dry;
  return VDISP[it.cat] || 0;
}
const atRho = (b, it, rho) => b + dispVol(it) * (rho - 1.025);

// wyporność pojedynczej sztuki sprzętu na głębokości d (kg, + unosi)
function itemBuoy(it, pr, ctx){
  const p = it.p, rho = ctx.rho;
  if (NEO_CATS.includes(it.cat) || (it.cat === 'dry' && p.shell === 'neo')){
    const cov = it.cat === 'dry' ? 0.95 : (COV[p.cover] || 0.5);
    const vol = bsa(pr) * cov * effT(p);             // litry
    const c = it.cat === 'dry' ? compress(ctx.depth) * 0.5 : compress(ctx.depth);
    const sole = it.cat === 'boots' && p.mass ? -0.00008 * p.mass : 0; // podeszwa gumowa
    return vol * (rho - RHO_NEO) * (1 - c) * ageFactor(it, ctx.year) + sole;
  }
  switch (it.cat){
    case 'dry': return atRho(p.b || 0, it, rho);
    case 'under': return (p.g || 0) * bsa(pr) / 1.9 * (rho / 1.025);   // to gaz: ta sama objętość, inna gęstość wody
    case 'bcd': return atRho(p.b || 0, it, rho);
    case 'wing': return atRho(p.b != null ? p.b : 0.3 + (PLATE[p.plate] ?? -0.5), it, rho);
    case 'tank': case 'stage': return p.be + (p.vd || p.vol * 1.15) * (rho - 1.025) - p.vol * ctx.reserve * AIR;
    case 'misc': case 'fins': return atRho(p.b || 0, it, rho);
  }
  return 0;
}

function physics(items, pr, ctx){
  const b = bodyBuoy(pr, ctx.rho);
  const comps = [
    {key:'tissue', label:'Ciało (tkanki)', v:b.tissue},
    {key:'lungs', label:'Płuca, pół oddechu', v:b.lungs}
  ];
  for (const it of items) comps.push({key:it.uid, label:itemName(it), v:itemBuoy(it, pr, ctx), cat:it.cat});
  return {comps, total: comps.reduce((s, c) => s + c.v, 0), body:b};
}
function itemName(it){ return it.brand === 'Ogólne' || it.brand === 'Własne' ? it.model : it.brand + ' ' + it.model; }
const toDry = (w, rho) => w / (1 - rho / RHO_PB);
const toWater = (d, rho) => d * (1 - rho / RHO_PB);
const roundUpHalf = x => Math.max(0, Math.ceil(x * 2 - 1e-9) / 2);

// ===== algebra =====
function invert(M){
  const n = M.length, A = M.map((r, i) => [...r, ...Array.from({length:n}, (_, j) => i === j ? 1 : 0)]);
  for (let c = 0; c < n; c++){
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c]; for (let k = 0; k < 2 * n; k++) A[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c){ const f = A[r][c]; if (f) for (let k = 0; k < 2 * n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map(r => r.slice(n));
}

function diveCtx(dv, st){
  const site = st.sites.find(s => s.id === dv.siteId) || {rho:1.025};
  return {rho: site.rho, depth: 5, reserve: dv.reserve ?? 50, year: +String(dv.date).slice(0, 4)};
}
// Pozycja wzięta prosto z katalogu, bez wpisywania do szafy: uid „cat:<id>”.
// Służy do szybkiego wyboru standardowej butli na ekranie Oblicz — model liczy ją jak każdą inną,
// ale nie jest cechą w nauce (nie ma historii nurkowań w tej konkretnej sztuce).
const CAT_ITEMS = {};
function catalogItem(id){
  if (!CAT_ITEMS[id]){
    const c = CATALOG.find(x => x.id === id); if (!c) return null;
    CAT_ITEMS[id] = {uid: 'cat:' + id, catId: id, cat: c.cat, brand: c.brand, model: c.model, size: '', year: null, p: c.p, src: c.src, fromCatalog: true};
  }
  return CAT_ITEMS[id];
}
const itemOf = (uid, st) => st.wardrobe.find(w => w.uid === uid) || (String(uid).startsWith('cat:') ? catalogItem(String(uid).slice(4)) : null);
function resolveItems(uids, st){ return uids.map(u => itemOf(u, st)).filter(Boolean); }

// Stan pojedynczego nurka w formie, jakiej oczekuje model: profil, szafa, dziennik i akweny (wspólne).
function diverState(S, id){
  const p = S.profiles.find(x => x.id === (id == null ? S.activeId : id)) || S.profiles[0];
  return {id: p.id, profile: p.profile, wardrobe: p.wardrobe, dives: p.dives, plan: p.plan, sites: S.sites, learnSince: p.learnSince};
}

// ===== nauka balastu: regresja grzbietowa z priorytetami =====
function learnLead(st){
  const feats = st.wardrobe.filter(w => w.cat !== 'misc');
  const idx = {}; feats.forEach((w, i) => idx[w.uid] = i + 1);
  const n = feats.length + 1, EP = expPrior(totalDives(st));
  const prec = Array.from({length:n}, (_, i) => Array.from({length:n}, (_, j) => i === j ? 1 / Math.pow(i === 0 ? EP.sd : (PRIOR_SD[feats[i - 1].cat] || 0.8), 2) : 0));
  const xty = Array(n).fill(0);
  const dives = st.dives.filter(d => d.lead != null && d.lead !== '' && d.leadFb).sort((a, b) => a.date < b.date ? 1 : -1);
  const used = [];
  dives.forEach((dv, rank) => {
    const w = Math.pow(0.5, rank / HALF_LIFE) / (SD_NOISE * SD_NOISE);
    const ctx = diveCtx(dv, st), items = resolveItems(dv.items, st);
    const ideal = +dv.lead + (dv.leadFb === 'light' ? +dv.leadAdj : dv.leadFb === 'heavy' ? -dv.leadAdj : 0);
    const y = toWater(ideal, ctx.rho) - physics(items, st.profile, ctx).total - EP.mu;
    const x = Array(n).fill(0); x[0] = 1; items.forEach(it => { if (idx[it.uid]) x[idx[it.uid]] = 1; });
    for (let i = 0; i < n; i++){ if (!x[i]) continue; xty[i] += w * y; for (let j = 0; j < n; j++) if (x[j]) prec[i][j] += w; }
    used.push({id: dv.id, resid: y});
  });
  const cov = invert(prec);
  const theta = cov.map(r => r.reduce((s, v, j) => s + v * xty[j], 0));
  return {idx, theta, cov, n: dives.length, used, feats, exp: EP, total: totalDives(st)};
}

function predictLead(items, st, ctx, L){
  const ph = physics(items, st.profile, ctx);
  const x = Array(L.theta.length).fill(0); x[0] = 1;
  items.forEach(it => { if (L.idx[it.uid]) x[L.idx[it.uid]] = 1; });
  let corr = L.exp.mu, v = 0;
  for (let i = 0; i < x.length; i++){ if (!x[i]) continue; corr += L.theta[i]; for (let j = 0; j < x.length; j++) if (x[j]) v += L.cov[i][j]; }
  const learned = [{key:'exp', label:'Doświadczenie (' + L.total + ' nurk.)', v:L.exp.mu}, {key:'theta0', label:'Korekta osobista (nauka)', v:L.theta[0], learned:true}];
  items.forEach(it => { const k = L.idx[it.uid]; if (k && Math.abs(L.theta[k]) >= 0.05) learned.push({key:'th-' + it.uid, label:'Korekta: ' + itemName(it), v:L.theta[k], learned:true}); });
  const water = ph.total + corr;
  const sd = Math.sqrt(v + 0.25);
  return {comps: ph.comps, learned, water, sd, dry: toDry(water, ctx.rho),
    lo: toDry(water - 1.28 * sd, ctx.rho), hi: toDry(water + 1.28 * sd, ctx.rho),
    rec: roundUpHalf(toDry(water, ctx.rho)), body: ph.body};
}

// ===== ocieplenie =====
// dolna granica komfortu wg typowych tabel producentów/sklepów (3 mm: 22 °C, 5 mm: 17 °C, 7 mm: 10–12 °C, półsucha 8/7: 5–10 °C)
const COMFORT = [[1,26],[3,22],[5,17],[7,12],[9,9],[11,7]];
const REF_AVG_DEPTH = 7.5; // tabele opisują typowe nurkowanie rekreacyjne, więc kompresję liczymy względem niego
function comfortFromEq(eq){
  if (eq <= 1) return 26 + (1 - eq) * 2;
  if (eq >= 11) return 7 - (eq - 11);
  for (let i = 0; i < COMFORT.length - 1; i++){
    const [a, ta] = COMFORT[i], [b, tb] = COMFORT[i + 1];
    if (eq <= b) return ta + (eq - a) / (b - a) * (tb - ta);
  }
}
function thermalOfSet(items, maxDepth){
  const dry = items.find(i => i.cat === 'dry');
  if (dry){
    const u = items.find(i => i.cat === 'under');
    const base = dry.p.shell === 'neo' ? 14 : dry.p.shell === 'crushed' ? 15 : 20;
    const tc = u ? Math.min(u.p.tmin, base) : base;
    return {comfort: tc - (items.some(i => i.cat === 'gloves') ? 0.5 : 0), eq: null, kind:'dry'};
  }
  const c = compress(maxDepth / 2);
  let eq = 0, hood = false;
  for (const it of items){
    if (!['wetsuit','over','hood'].includes(it.cat)) continue;
    const p = it.p; if (p.hood || it.cat === 'hood') hood = true;
    eq += p.t * (TORSO[p.cover] ?? 0) * (p.semi ? 1.15 : 1);
  }
  if (eq === 0 && !hood) return {comfort: 31, eq: 0, kind:'none'};
  eq = eq * (1 - 0.5 * c) / (1 - 0.5 * compress(REF_AVG_DEPTH)) + (hood ? 1 : 0);
  return {comfort: comfortFromEq(eq), eq, kind:'wet'};
}
function tEf(plan, delta){
  const b = tBreak(plan); return b.t + delta;
}
// temperatura nurkowania: większość czasu spędzamy przy dnie, więc dno waży 75%, powierzchnia 25%;
// długie nurkowanie i kolejne nurkowania w ciągu dnia obniżają ją (wychłodzenie narasta)
const W_BOTTOM = 0.75;
function tBreak(plan){
  const base = W_BOTTOM * plan.tBottom + (1 - W_BOTTOM) * plan.tSurf;
  const long = Math.max(0, (plan.time - 45) / 15), rep = Math.max(1, plan.nDay || 1) - 1;
  return {base, long, rep, t: base - long - rep};
}
const BANDS = {cold:[-Infinity,-2], cool:[-2,0], ok:[0,Infinity], warm:[4,Infinity]};
function learnThermal(st){
  let s = 0, w = 0; const pts = [];
  st.dives.filter(d => d.thermal).forEach(dv => {
    const items = resolveItems(dv.items, st);
    const m0 = tEf(dv, 0) - thermalOfSet(items, dv.depth).comfort;
    const [lo, hi] = BANDS[dv.thermal];
    const target = Math.min(hi, Math.max(lo, m0 + (+st.profile.coldTol || 0)));
    const d = target - (m0 + (+st.profile.coldTol || 0));
    if (Math.abs(d) > 1e-9){ s += d; w += 1; }
    pts.push({id: dv.id, m0});
  });
  return {delta: s / (w + 1.5), n: w, pts};
}

if (typeof module !== 'undefined') module.exports = {dispVol, diverState, catalogItem, itemOf, bsa, bodyBuoy, bodyFat, itemBuoy, physics, learnLead, predictLead, thermalOfSet, tEf, learnThermal, toDry, roundUpHalf, compress};
