// ===== Aplikacja =====
const KEY = 'balast-ocieplenie.v1';
let S, L, T, memOnly = false, tab = 'calc', ui = {draft:null, editGear:null, editSite:null, addQ:'', addCat:'', confirmWipe:false, quick:null, siteQ:null, hl:0, wiz:0, delDiver:null, explain:false};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (x, d = 1) => { const s = (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); return LANG === 'en' ? s : s.replace('.', ','); };
const sgn = (x, d = 1) => (x >= 0 ? '+' : '−') + fmt(Math.abs(x), d);
const num = v => v === '' || v == null ? null : +String(v).replace(',', '.');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const newId = p => p + '-' + Math.random().toString(36).slice(2, 8);
const THERM = {cold:'Zimno', cool:'Chłodno', ok:'OK', warm:'Za ciepło'};
const nm = it => frag(itemName(it));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
function validDate(s){ if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + 'T12:00:00'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }

// Aktywny nurek. S.profiles[] trzyma profil, szafę, dziennik, plan i naukę każdego z nich;
// akweny (S.sites) i język są wspólne dla całej aplikacji.
const P = () => S.profiles.find(p => p.id === S.activeId) || S.profiles[0];
const dst = () => diverState(S);
const diverLabel = (p, i) => (p.profile.name || '').trim() || tr('Nurek {n}', {n: i + 1});
const wizardOn = () => !P().onboarded;

function load(){
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch(e){ memOnly = true; }
  try { S = migrate(raw ? JSON.parse(raw) : seedState()) || seedState(); }
  catch(e){ S = seedState(); }
  LANG = S.lang === 'en' ? 'en' : 'pl';
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); memOnly = false; } catch(e){ memOnly = true; } }
function learnState(){ const d = dst(); return d.learnSince ? Object.assign({}, d, {dives: d.dives.filter(x => x.date >= d.learnSince)}) : d; }
function recompute(){ const ls = learnState(); L = learnLead(ls); T = learnThermal(ls); }
function commit(){ save(); recompute(); render(); }
function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

const siteOf = id => S.sites.find(s => s.id === id) || S.sites[0];
function siteName(s){
  if (LANG === 'en' && s.preset && SITE_EN[s.id]){ const p = SITE_PRESETS.find(x => x.id === s.id); if (p && p.name === s.name) return SITE_EN[s.id]; }
  return s.name;
}
const waterLabel = rho => lbl().water[String(rho)] || tr('gęstość {x}', {x: rho});
const monthOf = date => Math.max(0, Math.min(11, (+String(date).slice(5, 7) || 1) - 1));
function planCtx(pl){ return {rho: siteOf(pl.siteId).rho, depth: 5, reserve: pl.reserve ?? 50, year: +String(pl.date).slice(0, 4) || new Date().getFullYear()}; }
function fillTemps(pl){
  if (pl.tMeasured) return;                    // wczytane z komputera — podpowiedź akwenu ich nie rusza
  const s = siteOf(pl.siteId), m = monthOf(pl.date); pl.tSurf = s.ts[m]; pl.tBottom = s.tb[m];
}
const EXPO = ['wetsuit','over','hood','dry','under'];
const SINGLE = {wetsuit:['wetsuit'], dry:['dry'], under:['under'], bcd:['bcd','wing'], wing:['bcd','wing'], tank:['tank'], fins:['fins']};
const targetOf = pre => pre === 'd-' && ui.draft ? ui.draft : P().plan;

function toggleItem(list, uid){
  const it = itemOf(uid, P()); if (!it) return list;
  if (list.includes(uid)) return list.filter(u => u !== uid);
  let out = list.slice();
  const drop = cats => { out = out.filter(u => { const w = itemOf(u, P()); return w && !cats.includes(w.cat); }); };
  if (SINGLE[it.cat]) drop(SINGLE[it.cat]);
  if (it.cat === 'dry' || it.cat === 'under') drop(['wetsuit','over']);
  if (it.cat === 'wetsuit' || it.cat === 'over') drop(['dry','under']);
  out.push(uid); return out;
}
function setIssues(items){
  const iss = [];
  if (!items.some(i => i.cat === 'bcd' || i.cat === 'wing')) iss.push(tr('kamizelki lub skrzydła'));
  if (!items.some(i => i.cat === 'tank')) iss.push(tr('butli'));
  return iss;
}

// ---------- ikony i kafelki wyboru (mniej wpisywania, więcej klikania) ----------
const SVG = (inner, vb) => `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${inner}</svg>`;
// sylwetka: barki i talia w jednostkach SVG — różnica między budowami jest widoczna na kafelku
const bodyIcon = (sh, wa) => SVG(`<circle cx="12" cy="4.8" r="2.7"/><path d="M${12 - sh} 9.8q0-1.2 ${sh} -1.2t${sh} 1.2l${wa - sh} 10.4q0 1.3 -${wa} 1.3t-${wa} -1.3z"/>`);
const barsIcon = n => SVG([0, 1, 2, 3].map(i => `<rect x="${3 + i * 5}" y="${18 - i * 4}" width="3.6" height="${3 + i * 4}" rx="1"${i < n ? ' fill="currentColor"' : ''}/>`).join(''));
const snowIcon = `<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/><path d="M12 6.5 9.8 5M12 6.5l2.2-1.5M12 17.5l-2.2 1.5M12 17.5l2.2 1.5"/>`;
const flameIcon = `<path d="M12 3c.5 3 2 3.8 3.3 5.4A6 6 0 1 1 6 12.4c0-1.4.5-2.6 1.4-3.6.2 1.6.9 2.4 1.9 2.6C8.6 8 10.3 5.3 12 3z"/>`;
const ICON = {
  male: SVG('<circle cx="10" cy="14.2" r="5.2"/><path d="M14.2 10 20 4.2M15 4h5v5"/>'),
  female: SVG('<circle cx="12" cy="9" r="5.2"/><path d="M12 14.2v7M9 18.2h6"/>'),
  cold1: SVG(snowIcon),
  temp: SVG('<path d="M14 14.9V5.5a2 2 0 1 0-4 0v9.4a4 4 0 1 0 4 0z"/><path d="M12 8.5v5.5"/>'),
  warm1: SVG(flameIcon),
  ok: SVG('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),
  edge: SVG('<path d="M3 15c2.2 0 2.2-3 4.5-3S9.7 15 12 15s2.2-3 4.5-3 2.2 3 4.5 3"/><path d="M12 3.5v3M12 19v2"/>'),
  ask: SVG('<circle cx="12" cy="12" r="9"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.4 3.3c-.5.2-.7.6-.7 1.1v.6"/><path d="M12 17.4v.2"/>')
};
const THERM_ICON = {cold: ICON.cold1, cool: ICON.temp, ok: ICON.ok, warm: ICON.warm1};
const FLAG = {
  pl: `<svg viewBox="0 0 24 16" class="flag" aria-hidden="true"><rect x=".6" y=".6" width="22.8" height="14.8" rx="2" fill="#fff" stroke="#00000022"/><path d="M1 8h22v5.4a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#D4213D"/></svg>`,
  en: `<svg viewBox="0 0 24 16" class="flag" aria-hidden="true"><rect width="24" height="16" rx="2" fill="#012169"/><path d="M0 0l24 16M24 0L0 16" stroke="#fff" stroke-width="3.2"/><path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" stroke-width="1.8"/><path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5.2"/><path d="M12 0v16M0 8h24" stroke="#C8102E" stroke-width="3"/></svg>`
};
// kafelki: jeden tap zamiast wpisywania liczby
function tiles(act, opts, on, cls){
  return `<div class="picks${cls ? ' ' + cls : ''}" role="group">${opts.map(o =>
    `<button type="button" class="pick${o.cls ? ' ' + o.cls : ''}" data-act="${act}" data-v="${esc(o.v)}" aria-pressed="${on(o)}">${o.icon || ''}<span>${esc(o.label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>`;
}
const fieldset = (lab, body, hint) => `<div class="fieldset"><span class="label">${lab}</span>${body}${hint ? `<p class="small muted" style="margin:6px 0 0">${hint}</p>` : ''}</div>`;
const SLIDE_RANGE = {height:[130, 210, 1, 'cm'], weight:[35, 180, 0.5, 'kg']};
function slider(k, lab){
  const [min, max, step, unit] = SLIDE_RANGE[k], val = P().profile[k];
  return `<div class="fieldset"><label class="label" for="num-${k}">${lab}</label><div class="slider">
    <input type="range" id="pr-${k}" min="${min}" max="${max}" step="${step}" value="${esc(val)}" data-act="slide" data-k="${k}" aria-label="${lab}">
    <span class="val"><input id="num-${k}" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${esc(val)}" data-act="typed" data-k="${k}"><small>${unit}</small></span>
  </div></div>`;
}
// suwak i pole trzymają tę samą wartość; drugie pole tylko odświeżamy, żeby nie przerywać wpisywania
function setBodyValue(k, v, from){
  P().profile[k] = v;
  const other = document.getElementById((from === 'typed' ? 'pr-' : 'num-') + k);
  if (other && +other.value !== v) other.value = v;
  refreshBody();
}

const AGE_BANDS = [{v:22, label:'do 25', lo:0, hi:25}, {v:30, label:'26–35', lo:26, hi:35}, {v:40, label:'36–45', lo:36, hi:45}, {v:50, label:'46–55', lo:46, hi:55}, {v:62, label:'56+', lo:56, hi:200}];
const BUILD_SHAPE = {slim:[4.4, 3.6], athletic:[6.8, 4.4], muscular:[8.4, 5.8], average:[6, 5.8], fuller:[6.4, 8.2], obese:[7.2, 9.8]};
// ikona niesie kierunek, podpis i wartość w °C — natężenie; rozmiar ikon jednakowy, inaczej kafelki się rozjeżdżają
const COLD_LEVELS = [{v:-2, label:'Bardzo marznę', icon:ICON.cold1}, {v:-1, label:'Marznę', icon:ICON.cold1},
  {v:0, label:'Przeciętnie', icon:ICON.temp}, {v:1, label:'Odporny', icon:ICON.warm1}, {v:2, label:'Bardzo odporny', icon:ICON.warm1}];
const EXP_BANDS = [{v:0, key:'beg', label:'początkujący', sub:'< 25'}, {v:25, key:'mid', label:'średnio zaawansowany', sub:'25–99'}, {v:100, key:'exp', label:'doświadczony', sub:'100–299'}, {v:300, key:'pro', label:'bardzo doświadczony', sub:'300+'}];

const langTiles = () => fieldset(tr('Język'), tiles('lang-pick', [{v:'pl', label:'Polski', icon:FLAG.pl}, {v:'en', label:'English', icon:FLAG.en}], o => o.v === LANG, 'two'));
const sexTiles = pr => fieldset(tr('Płeć'), tiles('pick-sex', [{v:'M', label:tr('Mężczyzna'), icon:ICON.male}, {v:'K', label:tr('Kobieta'), icon:ICON.female}], o => o.v === pr.sex, 'two'));
const ageTiles = pr => fieldset(tr('Wiek'), tiles('pick-age', AGE_BANDS.map(a => ({v:a.v, label:tr(a.label)})), o => { const a = AGE_BANDS.find(x => x.v === o.v); return pr.age >= a.lo && pr.age <= a.hi; }, 'compact'));
const buildTiles = pr => fieldset(tr('Budowa'), tiles('pick-build', Object.keys(BUILD_SHAPE).map(k => ({v:k, label:lbl().build[k], icon:bodyIcon(...BUILD_SHAPE[k])})), o => o.v === pr.build));
const coldTiles = pr => fieldset(tr('Tolerancja zimna'), tiles('pick-cold', COLD_LEVELS.map(c => ({v:c.v, label:tr(c.label), sub:sgn(c.v, 0) + ' °C', icon:c.icon})), o => Math.round(+pr.coldTol || 0) === o.v, 'rows'),
  tr('Model i tak poprawi to po kilku ocenach ciepła.'));
function expTiles(){
  const cur = L.exp.key;
  return fieldset(tr('Doświadczenie'), tiles('pick-exp', EXP_BANDS.map((e, i) => ({v:e.v, label:tr(e.label), sub:e.sub + ' ' + tr('nurk.'), icon:barsIcon(i + 1)})), o => EXP_BANDS.find(x => x.v === o.v).key === cur, 'rows'),
    tr('Łącznie {n} nurk. — poziom podnosi się sam, gdy dopiszesz nurkowania do dziennika.', {n: L.total}));
}
// wynik dla ciała: odświeżany bez przebudowy widoku, o stałej wysokości
function bodyOut(full){
  const pr = P().profile, ok = profileOk(pr), b = ok ? bodyBuoy(pr, 1.025) : null;
  const row = (dt, dd) => `<dt>${dt}</dt><dd>${dd}</dd>`;
  return `<dl class="kv fixed">${row(tr('Tłuszcz'), ok ? fmt(b.bf * 100) + ' %' : '—')}
    ${full ? row(tr('Gęstość ciała'), ok ? fmt(b.dens, 3) + ' kg/l' : '—') + row(tr('Powierzchnia ciała'), ok ? fmt(bsa(pr), 2) + ' m²' : '—') : ''}
    ${row(tr('Wyporność ciała w morzu, pół oddechu'), ok ? sgn(b.tissue + b.lungs) + ' kg' : '—')}</dl>`;
}
const bodyOutBox = full => `<div id="body-out" data-full="${full ? 1 : 0}" style="margin-top:14px">${bodyOut(full)}</div>`;
function refreshBody(){
  const el = document.getElementById('body-out');
  if (el) el.innerHTML = bodyOut(el.dataset.full === '1');
}

// ---------- komponenty ----------
function chipsFor(selected, act){
  const groups = CAT_ORDER.map(c => ({c, items: P().wardrobe.filter(w => w.cat === c)})).filter(g => g.items.length);
  if (!groups.length) return `<p class="muted small">${tr('Szafa jest pusta. Dodaj sprzęt w zakładce Szafa.')}</p>`;
  return groups.map(g => `<div class="group"><div class="label">${catLabel(g.c)}</div><div class="chips">${
    g.items.map(w => `<button class="chip" data-act="${act}" data-uid="${esc(w.uid)}" aria-pressed="${selected.includes(w.uid)}">${esc(nm(w))}${w.size ? ' · ' + esc(w.size) : ''}</button>`).join('')
  }</div></div>`).join('');
}
function siteMatches(q){
  const n = norm(q.trim());
  if (!n) return S.sites.slice();
  return S.sites.filter(s => { const name = norm(siteName(s)); return name.startsWith(n) || name.split(/[\s(),\-]+/).some(w => w.startsWith(n)); });
}
function hlName(name, q){
  const n = norm(q.trim()); if (!n) return esc(name);
  const nn = norm(name); let i = -1;
  for (let k = 0; k < nn.length; k++){ if ((k === 0 || /[\s(),\-]/.test(nn[k - 1])) && nn.startsWith(n, k)){ i = k; break; } }
  return i < 0 ? esc(name) : esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + n.length)) + '</b>' + esc(name.slice(i + n.length));
}
function siteCombo(pl, pre){
  const open = ui.siteQ && ui.siteQ.pre === pre, q = open ? ui.siteQ.q : '';
  const list = open ? siteMatches(q) : [];
  return `<div class="f wide combo"><label for="${pre}site">${tr('Akwen')}</label>
    <input id="${pre}site" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="${open}" aria-controls="${pre}site-list"
      data-act="siteq" data-pre="${pre}" placeholder="${tr('Wpisz pierwsze litery')}" value="${esc(open ? q : siteName(siteOf(pl.siteId)))}">
    ${open ? `<ul class="combo-list" id="${pre}site-list" role="listbox">${list.map((s, i) => `<li role="option" aria-selected="${i === ui.hl}"><button type="button" tabindex="-1" class="${i === ui.hl ? 'hl' : ''}" data-act="site-pick" data-pre="${pre}" data-id="${esc(s.id)}">${hlName(siteName(s), q)}</button></li>`).join('')
      || `<li class="none">${tr('Brak akwenu zaczynającego się od „{q}”', {q: esc(q)})}</li>`}</ul>` : ''}
  </div>`;
}
// Pole liczbowe z przyciskami −/+ : po nurkowaniu wpisuje się je kciukiem, często na kołyszącej się łodzi.
// Wpisanie z klawiatury dalej działa, przyciski tylko skracają drogę.
function stepField(id, lab, f, val, step, min, max){
  const bt = d => `<button type="button" data-act="step" data-t="${id}" data-d="${d}" aria-label="${d > 0 ? tr('więcej') : tr('mniej')}">${d > 0 ? '+' : '−'}</button>`;
  return `<div class="f"><label for="${id}">${lab}</label><div class="step">${bt(-step)}
    <input id="${id}" type="number" inputmode="decimal" data-f="${f}" value="${esc(val)}" step="${step}" min="${min}" max="${max}">${bt(step)}</div></div>`;
}
function planFields(pl, pre){
  return `<div class="grid2">
    ${siteCombo(pl, pre)}
    <div class="f wide"><label for="${pre}date">${tr('Data')}</label><div class="datebox">
      <input id="${pre}date" type="text" inputmode="numeric" maxlength="10" placeholder="${tr('rrrr-mm-dd')}" data-f="date" data-date="1" value="${esc(pl.date)}">
      <button type="button" class="calbtn" data-act="cal" data-pre="${pre}" aria-label="${tr('Kalendarz')}"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></button>
      <input type="date" class="datepick" id="${pre}datepick" data-pick="${pre}" tabindex="-1" aria-hidden="true" value="${esc(validDate(pl.date) ? pl.date : '')}"></div></div>
    ${stepField(pre + 'depth', tr('Głębokość maks. (m)'), 'depth', pl.depth, 1, 0, 120)}
    ${stepField(pre + 'time', tr('Czas (min)'), 'time', pl.time, 5, 1, 400)}
    ${stepField(pre + 'nday', tr('Nurkowanie dnia nr'), 'nDay', pl.nDay, 1, 1, 9)}
    ${stepField(pre + 'ts', tr('Temp. powierzchnia (°C)'), 'tSurf', pl.tSurf, 1, -2, 40)}
    ${stepField(pre + 'tb', tr('Temp. na dnie (°C)'), 'tBottom', pl.tBottom, 1, -2, 40)}
    ${stepField(pre + 'res', tr('Rezerwa w butli (bar)'), 'reserve', pl.reserve, 10, 0, 300)}
  </div>`;
}
function compLabel(r){
  if (r.key === 'tissue') return tr('Ciało (tkanki)');
  if (r.key === 'lungs') return tr('Płuca, pół oddechu');
  if (r.key === 'exp') return tr('Doświadczenie ({n} nurk.)', {n: L.total});
  if (r.key === 'theta0') return tr('Korekta osobista (nauka)');
  const uid = r.key.startsWith('th-') ? r.key.slice(3) : r.key, w = itemOf(uid, P());
  const name = w ? nm(w) : r.label;
  return r.key.startsWith('th-') ? tr('Korekta: {x}', {x: name}) : name;
}
function barsHtml(pred){
  const rows = pred.comps.concat(pred.learned);
  const max = Math.max(1, ...rows.map(r => Math.abs(r.v)));
  const bar = r => { const w = Math.abs(r.v) / max * 50; return `<div class="track"><div class="b ${r.v >= 0 ? 'p' : 'n'}${r.learned ? ' lr' : ''}" style="width:${w.toFixed(1)}%"></div></div>`; };
  return `<div class="bars" role="table">${rows.map(r => { const lb = compLabel(r);
    return `<div class="nm${r.learned ? ' l' : ''}" role="cell" title="${esc(lb)}">${esc(lb)}</div>${bar(r)}<div class="v" role="cell">${sgn(r.v)}</div>`; }).join('')}
    <div class="nm sum">${tr('Razem w wodzie')}</div><div class="sum"></div><div class="v sum">${sgn(pred.water)}</div></div>
    <div class="legend"><span><i style="background:var(--pos)"></i>${tr('unosi')}</span><span><i style="background:var(--neg)"></i>${tr('obciąża')}</span><span><i style="background:var(--pos);opacity:.55"></i>${tr('nauczone z nurkowań')}</span></div>`;
}
function scaleHtml(p){
  const a = Math.floor(Math.min(p.lo, p.rec) - 1), b = Math.ceil(Math.max(p.hi, p.rec) + 1), span = Math.max(1, b - a);
  const pos = x => ((x - a) / span * 100).toFixed(1) + '%';
  const step = span > 12 ? 4 : span > 6 ? 2 : 1, ticks = [];
  for (let t = Math.ceil(a / step) * step; t <= b; t += step) ticks.push(t);
  return `<div class="scale" aria-hidden="true"><div class="band" style="left:${pos(Math.max(a, p.lo))};width:calc(${pos(Math.min(b, p.hi))} - ${pos(Math.max(a, p.lo))})"></div><div class="pt" style="left:${pos(p.rec)}"></div>${ticks.map(t => `<span class="tick" style="left:${pos(t)}">${t}</span>`).join('')}</div>`;
}
function distribution(p, items){
  const kg = p.rec, wing = items.find(i => i.cat === 'wing'), dry = items.some(i => i.cat === 'dry');
  if (kg <= 0) return tr('Bez dodatkowego ołowiu.');
  const trim = (wing || dry) && kg >= 6 ? Math.min(2, Math.floor(kg / 6)) : 0;
  const main = kg - trim;
  let s = wing ? tr('Pas lub kieszenie na pasie uprzęży: {kg} kg', {kg: fmt(main)}) : tr('Kieszenie zrzutowe kamizelki / pas: {kg} kg', {kg: fmt(main)});
  if (trim) s += tr('; kieszenie trymujące na butli: {kg} kg (poprawia trym przy {x})', {kg: fmt(trim), x: tr(dry ? 'suchym skafandrze' : 'skrzydle')});
  return s + '.';
}
function thermalVerdict(m){
  return m >= 1 ? `<span class="pill good">${ICON.ok}${tr('Wystarczy')}</span>`
    : m >= 0 ? `<span class="pill warn">${ICON.edge}${tr('Na granicy')}</span>`
    : `<span class="pill bad">${ICON.cold1}${tr('Za zimno')}</span>`;
}
function advisor(pl, curItems){
  const base = curItems.filter(i => !EXPO.includes(i.cat));
  const own = P().wardrobe.filter(w => !w.rental), of = c => own.filter(w => w.cat === c);
  const W = of('wetsuit'), O = of('over'), H = of('hood'), D = of('dry'), U = of('under');
  const combos = [];
  for (const w of W) for (const o of [null, ...O]) for (const h of [null, ...H]){
    if (h && (o && o.p.hood || w.p.hood)) continue;
    combos.push([w, o, h].filter(Boolean));
  }
  for (const o of O) if (!W.length) combos.push([o]);
  for (const d of D) for (const u of [null, ...U]) combos.push([d, u].filter(Boolean));
  const delta = (+P().profile.coldTol || 0) + T.delta, tef = tEf(pl, delta), ctx = planCtx(pl);  // porównanie: tWater + delta vs komfort ⇔ tWater vs komfort − delta
  const res = combos.map(c => {
    const th = thermalOfSet(c, pl.depth), items = base.concat(c);
    return {c, th, m: tef - th.comfort, lead: predictLead(items, dst(), ctx, L).rec};
  });
  const ok = res.filter(r => r.m >= 1).sort((a, b) => b.th.comfort - a.th.comfort || a.lead - b.lead);
  const no = res.filter(r => r.m < 1).sort((a, b) => b.m - a.m);
  return {tef, list: ok.slice(0, 3).concat(ok.length ? [] : no.slice(0, 3)), anyOk: ok.length > 0};
}

function quickAdd(){
  const qa = ui.quick, q = qa.q.trim().toLowerCase();
  const found = CATALOG.filter(c => (!qa.cat || c.cat === qa.cat) && (!q || (c.brand + ' ' + c.model + ' ' + frag(c.model) + ' ' + catOne(c.cat)).toLowerCase().includes(q)));
  const seg = (v, l) => `<button data-act="quick-kind" data-v="${v}" aria-pressed="${qa.kind === v}">${l}</button>`;
  return `<div class="editor" style="margin:0 0 14px">
    <div class="seg" role="group" aria-label="${tr('Skąd sprzęt')}">${seg('bought', tr('Kupiony'))}${seg('rental', tr('Wypożyczony'))}</div>
    <div class="grid2" style="margin-top:10px">
      <div class="f"><label for="qq">${tr('Szukaj w katalogu')}</label><input id="qq" type="search" data-act="qq" placeholder="${tr('np. Pro Therm, Zeos, 12 l')}" value="${esc(qa.q)}"></div>
      <div class="f"><label for="qqc">${tr('Kategoria')}</label><select id="qqc" data-act="qqc"><option value="">${tr('Wszystkie')}</option>${CAT_ORDER.map(c => `<option value="${c}"${qa.cat === c ? ' selected' : ''}>${catLabel(c)}</option>`).join('')}</select></div>
    </div>
    ${q || qa.cat ? `<div class="list" style="margin-top:6px">${found.slice(0, 12).map(c => `<div class="li"><div class="main"><div class="t">${esc(frag(c.brand === 'Ogólne' ? c.model : c.brand + ' ' + c.model))}</div><div class="s">${catOne(c.cat)}${c.p.mass ? ' · ' + c.p.mass + ' g' : ''}${c.cat === 'fins' ? ' · ' + sgn(c.p.b) + ' kg' : ''}</div></div>
      <div class="r"><button class="sm primary" data-act="quick-add" data-id="${esc(c.id)}">${tr('Dodaj i użyj')}</button></div></div>`).join('') || `<p class="small muted">${tr('Brak w katalogu — dodaj pozycję ogólną niżej.')}</p>`}</div>`
      : `<p class="small muted" style="margin:8px 0 0">${tr('Wpisz markę, model albo rodzaj sprzętu.')}</p>`}
    <div class="btnrow"><select id="qq-own" aria-label="${tr('Rodzaj pozycji ogólnej')}" style="width:auto;flex:1">${CAT_ORDER.map(c => `<option value="${c}"${qa.cat === c ? ' selected' : ''}>${catOne(c)}</option>`).join('')}</select><button class="sm" data-act="quick-own">${tr('Dodaj pozycję ogólną')}</button></div>
  </div>`;
}
const OWN_DEFAULTS = {wetsuit:{t:5, cover:'full'}, over:{t:3, cover:'vest', hood:true}, hood:{t:5, cover:'hood', hood:true}, gloves:{t:3, cover:'gloves'}, boots:{t:5, cover:'boots'}, dry:{shell:'trilam', b:0.3}, under:{g:4, tmin:8}, bcd:{b:1.0}, wing:{lift:15, plate:'alu'}, tank:{vol:12, bar:232, mat:'stal', be:-1.4, vd:13.8}, fins:{b:0, mass:1500}, misc:{b:0}};
function quickItem(w){
  const rental = ui.quick && ui.quick.kind === 'rental';
  if (rental){ w.rental = true; w.year = null; w.model += ' ' + tr('(wypożyczony)'); }
  else w.year = new Date().getFullYear();
  P().wardrobe.push(w); P().plan.items = toggleItem(P().plan.items, w.uid);
  ui.editGear = w.uid; ui.quick = null;
  toast(tr(rental ? 'Dodano wypożyczony sprzęt i włączono do zestawu' : 'Dodano do szafy i do zestawu'));
  commit();
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.some(y => y.uid === x.uid));

// Standardowe butle prosto z katalogu — wybór jednym tapnięciem, bez wpisywania do szafy.
const STD_TANKS = CATALOG.filter(c => c.cat === 'tank');
function tankPicker(selected, act){
  const mine = P().wardrobe.some(w => w.cat === 'tank' && selected.includes(w.uid));
  return `<div class="group"><div class="label">${tr('Butla standardowa')} <span class="muted">${tr('bez dodawania do szafy')}</span></div>
    <div class="chips">${STD_TANKS.map(c => {
      const uid = 'cat:' + c.id, on = selected.includes(uid);
      return `<button class="chip" data-act="${act || 'plan-toggle'}" data-uid="${esc(uid)}" aria-pressed="${on}">${esc(frag(c.brand))} ${esc(frag(c.model))}</button>`;
    }).join('')}</div>
    ${mine ? `<p class="small muted" style="margin:6px 0 0">${tr('Wybrana jest Twoja butla z szafy — tapnięcie standardowej ją zastąpi.')}</p>` : ''}</div>`;
}

// ---------- widoki ----------
function leadDetailHtml(pl, items, p){
  const iss = setIssues(items), site = siteOf(pl.siteId);
  return `<section class="card" id="lead-detail"><h2>${tr('Balast')} <small>${tr('zakres 80%: {a}–{b} kg', {a: fmt(Math.max(0, p.lo)), b: fmt(p.hi)})}</small></h2>
    <div class="small muted">${esc(siteName(site))} · ${L.n ? tr('nauka z {n} nurk. w dzienniku', {n: L.n}) : tr('bez nauki, tylko fizyka')} · ${tr('doświadczenie: {n} nurk. ({l})', {n: L.total, l: tr(L.exp.label)})}</div>
    ${scaleHtml(p)}
    ${iss.length ? `<div class="banner" style="margin-top:28px">${tr('Zestaw nie ma {x} — wynik jest niepełny.', {x: iss.join(tr(' ani '))})}</div>` : ''}
    <div class="note">${esc(distribution(p, items))} ${tr('Przy pierwszym nurkowaniu w tej konfiguracji zrób kontrolę na 5 m z rezerwą i pustą kamizelką.')}</div>
  </section>

  <section class="card"><h2>${tr('Skąd ta liczba')} <small>${tr('kg wyporności na 5 m')}</small></h2>${barsHtml(p)}
    <p class="small muted" style="margin:12px 0 0">${tr('Suma w wodzie {w} kg to {d} kg suchego ołowiu (ołów też wypiera wodę), zaokrąglone w górę do 0,5 kg.', {w: sgn(p.water), d: fmt(p.dry)})}</p></section>`;
}
function thermalCardHtml(pl, items){
  const delta = (+P().profile.coldTol || 0) + T.delta, tef = tEf(pl, delta), th = thermalOfSet(items, pl.depth), m = tef - th.comfort;
  const tb = tBreak(pl), adv = advisor(pl, items), curExpo = items.filter(i => EXPO.includes(i.cat));
  return `<section class="card" id="thermal-card"><h2>${tr('Ocieplenie')} <small>${tr('temperatura nurkowania {t} °C', {t: fmt(tb.t)})}</small></h2>
    <div class="therm-head"><div class="small">${tr('Twój zestaw daje Ci komfort od')} <b class="mono">${fmt(th.comfort - delta)} °C</b></div>${thermalVerdict(m)}</div>
    <p class="small muted" style="margin:8px 0 0">${tr('Temperatura nurkowania = dno {b} °C × 75% + powierzchnia {s} °C × 25%', {b: fmt(pl.tBottom), s: fmt(pl.tSurf)})}${tb.long ? tr(' − {x} °C za długie nurkowanie', {x: fmt(tb.long)}) : ''}${tb.rep ? tr(' − {x} °C za kolejne nurkowanie dnia', {x: fmt(tb.rep)}) : ''}.
    ${tr('Komfort zestawu dla przeciętnego nurka: od {c} °C', {c: fmt(th.comfort)})}${Math.abs(delta) >= 0.1 ? tr('; Twoja tolerancja zimna {d} °C', {d: sgn(delta)}) : ''}.</p>
    <div class="stack" style="margin-top:12px;gap:8px">
      <div class="label">${tr(adv.anyOk ? 'Najlżejsze wystarczające zestawy z Twojej szafy (bez wypożyczonych)' : 'Nic w szafie nie wystarcza — najcieplejsze opcje')}</div>
      ${adv.list.map(r => { const on = sameSet(r.c, curExpo); return `<div class="opt${on ? ' best' : ''}">
        <div class="items">${r.c.map(x => esc(nm(x))).join(' + ')}</div>
        ${on ? `<span class="pill info" style="align-self:start">${tr('Wybrany')}</span>` : `<button class="sm" data-act="use-combo" data-uids="${esc(r.c.map(x => x.uid).join(','))}">${tr('Użyj')}</button>`}
        <div class="meta">${tr('komfort od {c} °C · zapas {m} °C · ołów {l} kg', {c: fmt(r.th.comfort - delta), m: sgn(r.m), l: fmt(r.lead)})}</div>
      </div>`; }).join('') || `<p class="muted small">${tr('Dodaj piankę lub suchy skafander do szafy.')}</p>`}
      ${!adv.anyOk && adv.list.length ? `<p class="small muted">${tr('Brakuje cieplejszej warstwy: grubszej pianki, ocieplacza z kapturem albo suchego skafandra.')}</p>` : ''}
    </div>
  </section>`;
}
// po zmianie liczby przyciskiem −/+ odświeżamy tylko to, co od niej zależy:
// przebudowa całego widoku gubiłaby kolejne tapnięcia
function refreshPlanDerived(){
  if (tab !== 'calc' || wizardOn()) return;
  const pl = P().plan, items = resolveItems(pl.items, P());
  $('#summary').innerHTML = summaryHtml();
  const tc = document.getElementById('thermal-box');
  if (tc) tc.innerHTML = thermalCardHtml(pl, items);
  const ld = document.getElementById('lead-box');
  if (ld) ld.innerHTML = ui.explain ? leadDetailHtml(pl, items, predictLead(items, dst(), planCtx(pl), L)) : '';
}
function viewCalc(){
  const pl = P().plan, items = resolveItems(pl.items, P()), ctx = planCtx(pl);
  const p = predictLead(items, dst(), ctx, L);
  return `<div class="stack">
  <section class="card"><h2>${tr('Nurkowanie')}</h2>${planFields(pl, 'p-')}
    <p class="small muted" style="margin:10px 0 0">${tr('Temperatury podpowiada akwen dla wybranego miesiąca; wpisz własne, jeśli znasz aktualne.')}</p></section>

  <div id="thermal-box">${thermalCardHtml(pl, items)}</div>

  <section class="card"><div class="therm-head" style="margin-bottom:10px"><h2 style="margin:0">${tr('Zestaw')}</h2>
    <button class="sm${ui.quick ? ' ghost' : ''}" data-act="quick-open" aria-expanded="${!!ui.quick}">${tr(ui.quick ? 'Zamknij' : '+ Dodaj sprzęt')}</button></div>
    ${ui.quick ? quickAdd() : ''}
    ${ui.editGear && P().wardrobe.some(w => w.uid === ui.editGear) ? `<div class="label" style="margin-top:4px">${tr('Dodane: {x}', {x: esc(nm(P().wardrobe.find(w => w.uid === ui.editGear)))})}</div>${paramEditor(P().wardrobe.find(w => w.uid === ui.editGear))}<div style="height:12px"></div>` : ''}
    ${chipsFor(pl.items, 'plan-toggle')}
    ${tankPicker(pl.items)}</section>

  <div id="lead-box">${ui.explain ? leadDetailHtml(pl, items, p) : ''}</div>

  <button class="primary" data-act="log-from-plan">${tr('Po nurkowaniu: zapisz i oceń')}</button>
  </div>`;
}

function viewLog(){
  if (ui.draft) return viewDraft();
  const dives = P().dives.slice().sort((a, b) => a.date < b.date ? 1 : -1);
  return `<div class="stack">
    <button class="primary" data-act="new-dive">${tr('Dodaj nurkowanie')}</button>
    <div class="btnrow" style="margin:0"><button class="sm" data-act="import-dive">${tr('Wczytaj z komputera')}</button>
      <span class="small muted" style="align-self:center">${tr('plik .json z aplikacji Suunto')}</span></div>
    <input id="dive-file" type="file" accept="application/json,.json" hidden>
    <section class="card"><h2>${tr('Dziennik')} <small>${dives.length} ${tr('nurk.')}</small></h2>
    ${dives.length ? `<div class="list">${dives.map(d => `<div class="li">
      <div class="main"><div class="t">${esc(siteName(siteOf(d.siteId)))}</div>
      <div class="s mono">${esc(d.date)} · ${fmt(+d.depth, +d.depth % 1 ? 1 : 0)} m · ${esc(d.time)} min · ${fmt(+d.tBottom, +d.tBottom % 1 ? 1 : 0)}–${fmt(+d.tSurf, +d.tSurf % 1 ? 1 : 0)} °C</div>
      <div class="s">${resolveItems(d.items, P()).filter(i => EXPO.includes(i.cat)).map(i => esc(nm(i))).join(' + ') || tr('bez ocieplenia')}</div>
      ${d.note ? `<div class="s"><i>${esc(d.note)}</i></div>` : ''}</div>
      <div class="r"><div class="mono">${d.lead != null && d.lead !== '' ? fmt(+d.lead) + ' kg' : '—'}</div>
      <div style="margin-top:4px;display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">
        ${d.leadFb ? `<span class="pill ${d.leadFb === 'ok' ? 'good' : 'warn'}">${d.leadFb === 'ok' ? tr('balast OK') : tr(d.leadFb === 'light' ? 'za lekko {x}' : 'za ciężko {x}', {x: fmt(d.leadAdj)})}</span>` : ''}
        ${d.thermal ? `<span class="pill info">${tr(THERM[d.thermal])}</span>` : ''}</div>
      <button class="sm ghost" style="margin-top:6px" data-act="edit-dive" data-id="${esc(d.id)}">${tr('Edytuj')}</button></div></div>`).join('')}</div>`
      : `<p class="muted">${tr('Brak nurkowań. Po pierwszym zapisie aplikacja zacznie się uczyć.')}</p>`}
    </section></div>`;
}
function viewDraft(){
  const d = ui.draft, isNew = !P().dives.some(x => x.id === d.id);
  const seg = (name, cls, opts, val, icons) => `<div class="seg ${cls}" role="group">${opts.map(([v, l]) => `<button data-act="seg" data-name="${name}" data-v="${v}" aria-pressed="${val === v}">${icons && icons[v] || ''}${tr(l)}</button>`).join('')}</div>`;
  return `<div class="stack">
    <section class="card"><h2>${tr(isNew ? 'Nowe nurkowanie' : 'Edycja nurkowania')}</h2>${planFields(d, 'd-')}
      ${d.gps ? `<p class="small muted" style="margin:10px 0 0">${tr('Komputer podał pozycję {lat} N {lon} E — akwen wybierz sam.', {lat: fmt(d.gps.lat, 4), lon: fmt(d.gps.lon, 4)})}</p>` : ''}
      ${d.tMeasured ? `<p class="small muted" style="margin:6px 0 0">${tr('Temperatury zmierzone przez komputer — nie podmieniam ich podpowiedzią akwenu.')}</p>` : ''}</section>
    <section class="card"><h2>${tr('Balast')}</h2>
      <div class="grid2">${stepField('d-lead', tr('Ołów, który miałeś (kg)'), 'lead', d.lead ?? '', 0.5, 0, 40)}
      <div class="f"><label for="d-adj">${tr('O ile (kg)')}</label><select id="d-adj" data-f="leadAdj"${d.leadFb === 'ok' || !d.leadFb ? ' disabled' : ''}>${[0.5,1,1.5,2,2.5,3,4].map(v => `<option value="${v}"${+d.leadAdj === v ? ' selected' : ''}>${fmt(v)}</option>`).join('')}</select></div></div>
      <div class="label" style="margin:12px 0 5px">${tr('Na 5 m, z rezerwą i pustą kamizelką było')}</div>
      ${seg('leadFb', 'lead', [['light','Za lekko'],['ok','OK'],['heavy','Za ciężko']], d.leadFb)}
    </section>
    <section class="card"><h2>${tr('Komfort cieplny')}</h2>${seg('thermal', 'therm', [['cold','Zimno'],['cool','Chłodno'],['ok','OK'],['warm','Za ciepło']], d.thermal, THERM_ICON)}
      <div class="f" style="margin-top:12px"><label for="d-note">${tr('Notatka')}</label><input id="d-note" type="text" data-f="note" value="${esc(d.note || '')}"></div></section>
    <section class="card"><h2>${tr('Użyty zestaw')}</h2>${chipsFor(d.items, 'draft-toggle')}
      ${tankPicker(d.items, 'draft-toggle')}</section>
    <div class="btnrow"><button class="primary" data-act="save-dive">${tr('Zapisz nurkowanie')}</button><button class="ghost" data-act="cancel-dive">${tr('Anuluj')}</button>
    ${isNew ? '' : `<button class="danger" data-act="del-dive">${tr('Usuń')}</button>`}</div></div>`;
}

function paramEditor(w){
  const p = w.p, n = (k, lab, step = '0.1') => `<div class="f"><label for="g-${k}">${tr(lab)}</label><input id="g-${k}" type="number" step="${step}" inputmode="decimal" data-p="${k}" value="${esc(p[k] ?? '')}"></div>`;
  const sel = (k, lab, opts) => `<div class="f"><label for="g-${k}">${tr(lab)}</label><select id="g-${k}" data-p="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(p[k]) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
  const chk = (k, lab) => `<div class="f"><label for="g-${k}">${tr(lab)}</label><select id="g-${k}" data-p="${k}" data-bool="1"><option value="0"${!p[k] ? ' selected' : ''}>${tr('nie')}</option><option value="1"${p[k] ? ' selected' : ''}>${tr('tak')}</option></select></div>`;
  const cat = CATALOG.find(c => c.id === w.catId), sizes = cat ? cat.sizes : null;
  let h = `<div class="grid2">
    <div class="f wide"><label for="g-name">${tr('Nazwa')}</label><input id="g-name" type="text" data-w="model" value="${esc(w.model)}"></div>
    <div class="f"><label for="g-size">${tr('Rozmiar')}</label>${sizes && sizes.length > 1 ? `<select id="g-size" data-w="size"><option value="">—</option>${sizes.map(s => `<option${s === w.size ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>` : `<input id="g-size" type="text" data-w="size" value="${esc(w.size)}">`}</div>
    <div class="f"><label for="g-year">${tr('Rok zakupu')}</label><input id="g-year" type="number" inputmode="numeric" data-w="year" value="${esc(w.year ?? '')}"></div>
    <div class="f"><label for="g-rental">${tr('Własność')}</label><select id="g-rental" data-w="rental"><option value="0"${!w.rental ? ' selected' : ''}>${tr('Mój')}</option><option value="1"${w.rental ? ' selected' : ''}>${tr('Wypożyczony')}</option></select></div>`;
  if (NEO_CATS.includes(w.cat)) h += n('t', 'Grubość tułów (mm)', '0.5') + n('tl', 'Grubość kończyny (mm)', '0.5') + sel('cover', 'Krój', Object.entries(lbl().cover)) + chk('semi', 'Półsucha') + chk('hood', 'Kaptur');
  if (w.cat === 'dry') h += sel('shell', 'Materiał', [['trilam',tr('Trylaminat')],['membrane',tr('Membrana')],['crushed',tr('Neopren zgnieciony')],['neo',tr('Neopren')]]) + (p.shell === 'neo' ? n('t', 'Grubość (mm)', '0.5') : n('b', 'Wyporność (kg)'));
  if (w.cat === 'under') h += n('g', 'Gaz w skafandrze (kg wyporności)') + n('tmin', 'Komfort od (°C)', '1');
  if (w.cat === 'bcd' || w.cat === 'misc') h += n('b', 'Wyporność w wodzie (kg)');
  if (w.cat === 'fins') h += n('b', 'Wyporność pary w wodzie (kg)') + n('mass', 'Masa pary (g)', '10');
  if (w.cat === 'boots') h += n('mass', 'Masa pary (g)', '10');
  if (w.cat === 'wing') h += n('lift', 'Udźwig (kg)', '1') + sel('plate', 'Płyta', [['steel',tr('Stal')],['alu',tr('Aluminium')],['soft',tr('Miękka / brak')]]);
  if (w.cat === 'tank') h += n('vol', 'Pojemność (l)') + n('bar', 'Ciśnienie robocze (bar)', '1') + n('be', 'Wyporność pusta, morze (kg)') + n('vd', 'Objętość zewnętrzna (l)');
  h += `</div><p class="small muted" style="margin:10px 0 0">${tr('Źródło wartości: {x}', {x: esc(frag(w.src || 'wpis własny'))})}</p>
    <div class="btnrow"><button class="primary sm" data-act="close-gear">${tr('Gotowe')}</button><button class="danger sm" data-act="del-gear" data-uid="${esc(w.uid)}">${tr('Usuń z szafy')}</button></div>`;
  return `<div class="editor">${h}</div>`;
}
function viewGear(){
  const ctx = {rho:1.025, depth:5, reserve:50, year:new Date().getFullYear()};
  const groups = CAT_ORDER.map(c => ({c, items: P().wardrobe.filter(w => w.cat === c)})).filter(g => g.items.length);
  const q = ui.addQ.trim().toLowerCase();
  const found = CATALOG.filter(c => (!ui.addCat || c.cat === ui.addCat) && (!q || (c.brand + ' ' + c.model + ' ' + frag(c.model)).toLowerCase().includes(q)));
  return `<div class="stack">
    <section class="card"><h2>${tr('Moja szafa')} <small>${tr('wyporność na 5 m w morzu')}</small></h2>
    ${groups.map(g => `<div class="group" style="margin-top:12px"><div class="label">${catLabel(g.c)}</div><div class="list">${g.items.map(w => {
      const k = L.idx[w.uid], th = k ? L.theta[k] : 0;
      return `<div class="li"><div class="main"><div class="t">${esc(nm(w))}</div>
        <div class="s">${[w.rental && tr('wypożyczony'), w.size && tr('rozm. {x}', {x: w.size}), w.year && tr('z {x}', {x: w.year}), Math.abs(th) >= 0.05 && tr('nauczona korekta {x} kg', {x: sgn(th)})].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div class="r"><div class="mono">${sgn(itemBuoy(w, P().profile, ctx))} kg</div><button class="sm ghost" data-act="edit-gear" data-uid="${esc(w.uid)}">${tr('Edytuj')}</button></div></div>
        ${ui.editGear === w.uid ? paramEditor(w) : ''}`;
    }).join('')}</div></div>`).join('') || `<p class="muted">${tr('Szafa jest pusta.')}</p>`}
    </section>
    <section class="card"><h2>${tr('Dodaj z katalogu')} <small>${tr('{n} pozycji', {n: CATALOG.length})}</small></h2>
      <div class="grid2"><div class="f"><label for="q">${tr('Szukaj')}</label><input id="q" type="search" placeholder="${tr('np. Zeos, Flexa, 15 l')}" value="${esc(ui.addQ)}" data-act="q"></div>
      <div class="f"><label for="qc">${tr('Kategoria')}</label><select id="qc" data-act="qc"><option value="">${tr('Wszystkie')}</option>${CAT_ORDER.map(c => `<option value="${c}"${ui.addCat === c ? ' selected' : ''}>${catLabel(c)}</option>`).join('')}</select></div></div>
      <div class="list" style="margin-top:8px">${found.slice(0, q || ui.addCat ? 60 : 10).map(c => `<div class="li"><div class="main"><div class="t">${esc(frag(c.brand === 'Ogólne' ? c.model : c.brand + ' ' + c.model))}</div><div class="s">${catOne(c.cat)}${c.p.mass ? ' · ' + c.p.mass + ' g' : ''}${c.cat === 'fins' ? ' · ' + sgn(c.p.b) + ' kg' : ''} · ${esc(frag(c.src))}</div></div>
        <div class="r"><button class="sm" data-act="add-cat" data-id="${esc(c.id)}">${tr('Dodaj')}</button></div></div>`).join('') || `<p class="muted small">${tr('Nic nie pasuje. Dodaj pozycję własną poniżej.')}</p>`}</div>
      ${!q && !ui.addCat && found.length > 10 ? `<p class="small muted" style="margin:8px 0 0">${tr('Pokazuję 10 z {n} — wpisz markę lub wybierz kategorię.', {n: found.length})}</p>` : ''}
      <div class="btnrow"><select id="custom-cat" aria-label="${tr('Kategoria pozycji własnej')}" style="width:auto">${CAT_ORDER.map(c => `<option value="${c}">${catOne(c)}</option>`).join('')}</select><button data-act="add-custom">${tr('Dodaj pozycję własną')}</button></div>
    </section></div>`;
}

function viewSites(){
  const m = new Date().getMonth();
  return `<div class="stack"><section class="card"><h2>${tr('Akweny')} <small>${tr('temperatury orientacyjne, {m}', {m: lbl().months[m]})}</small></h2><div class="list">
    ${S.sites.map(s => `<div class="li"><div class="main"><div class="t">${esc(siteName(s))}</div><div class="s">${esc(waterLabel(s.rho))}</div></div>
      <div class="r"><div class="mono small">${s.tb[m]}–${s.ts[m]} °C</div><button class="sm ghost" data-act="edit-site" data-id="${esc(s.id)}">${tr('Edytuj')}</button></div></div>
      ${ui.editSite === s.id ? `<div class="editor"><div class="grid2">
        <div class="f wide"><label for="s-name">${tr('Nazwa')}</label><input id="s-name" type="text" data-s="name" value="${esc(s.name)}"></div>
        <div class="f wide"><label for="s-rho">${tr('Woda')}</label><select id="s-rho" data-s="rho">${WATER_TYPES.map(w => `<option value="${w.rho}"${w.rho === s.rho ? ' selected' : ''}>${esc(waterLabel(w.rho))}</option>`).join('')}</select></div>
        <div class="f wide"><label for="s-ts">${tr('Powierzchnia, sty→gru (°C)')}</label><input id="s-ts" type="text" data-s="ts" value="${esc(s.ts.join('; '))}"></div>
        <div class="f wide"><label for="s-tb">${tr('Dno, sty→gru (°C)')}</label><input id="s-tb" type="text" data-s="tb" value="${esc(s.tb.join('; '))}"></div></div>
        <div class="btnrow"><button class="primary sm" data-act="close-site">${tr('Gotowe')}</button>${P().dives.some(d => d.siteId === s.id) || P().plan.siteId === s.id ? '' : `<button class="danger sm" data-act="del-site" data-id="${esc(s.id)}">${tr('Usuń')}</button>`}</div></div>` : ''}`).join('')}
  </div><div class="btnrow"><button data-act="add-site">${tr('Dodaj akwen')}</button></div></section></div>`;
}

const nameField = pr => `<div class="f"><label for="pr-name">${tr('Imię')}</label><input id="pr-name" type="text" data-pr="name" value="${esc(pr.name ?? '')}" placeholder="${tr('opcjonalnie')}"></div>`;
const bfField = pr => `<div class="f"><label for="pr-bf">${tr('% tłuszczu (opcjonalnie)')}</label><input id="pr-bf" type="number" inputmode="decimal" data-pr="bf" value="${esc(pr.bf ?? '')}" placeholder="${tr('z wagi BIA')}"></div>`;

function viewProfile(){
  const pr = P().profile;
  const sd0 = Math.sqrt(L.cov[0][0]);
  const learnedItems = L.feats.map((w, i) => ({w, v: L.theta[i + 1], sd: Math.sqrt(L.cov[i + 1][i + 1])})).filter(x => Math.abs(x.v) >= 0.05);
  return `<div class="stack">
  ${diversCard()}
  <section class="card"><h2>${tr('Profil nurka')}</h2>
    ${langTiles()}
    <div class="fieldset">${nameField(pr)}</div>
    ${sexTiles(pr)}
    ${ageTiles(pr)}
    ${slider('height', tr('Wzrost'))}
    ${slider('weight', tr('Waga'))}
    ${buildTiles(pr)}
    <div class="fieldset">${bfField(pr)}</div>
    ${coldTiles(pr)}
    ${expTiles()}
    ${bodyOutBox(true)}</section>

  <section class="card"><h2>${tr('Czego nauczył się model')}</h2>
    <dl class="kv"><dt>${tr('Nurkowania z oceną balastu')}</dt><dd>${L.n}</dd>
    <dt>${tr('Start z doświadczenia ({n} nurk.)', {n: L.total})}</dt><dd>${sgn(L.exp.mu)} ± ${fmt(L.exp.sd)} kg</dd>
    <dt>${tr('Korekta osobista')}</dt><dd>${sgn(L.theta[0])} ± ${fmt(sd0)} kg</dd>
    <dt>${tr('Tolerancja zimna z ocen ({n} inf.)', {n: T.n})}</dt><dd>${sgn(T.delta)} °C</dd>
    ${learnedItems.map(x => `<dt>${esc(nm(x.w))}</dt><dd>${sgn(x.v)} ± ${fmt(x.sd)} kg</dd>`).join('')}</dl>
    <p class="small muted" style="margin:10px 0 0">${tr('Korekty to różnica między fizyką a tym, co naprawdę działało w wodzie. Starsze nurkowania ważą mniej (połowa wagi po 30 nurkowaniach).')}</p>
    <div class="btnrow"><button class="sm" data-act="reset-learn">${tr('Ucz od dziś od nowa')}</button>${P().learnSince ? `<button class="sm ghost" data-act="unreset-learn">${tr('Przywróć całą historię')}</button>` : ''}</div>
    ${P().learnSince ? `<p class="small muted">${tr('Nauka liczy nurkowania od {d}.', {d: esc(P().learnSince)})}</p>` : ''}
  </section>

  <section class="card"><h2>${tr('Kopia zapasowa')} <small>${tr('dane są tylko w tej przeglądarce')}</small></h2>
    ${memOnly ? `<div class="banner">${tr('Przeglądarka nie pozwala zapisywać danych — zmiany znikną po zamknięciu. Zapisz kopię do pliku.')}</div>` : ''}
    <p class="small muted" style="margin:8px 0 0">${tr('Kopia to jeden plik {x} z profilami, szafą, dziennikiem i akwenami. Wczytanie kopii zastępuje wszystkie dane w tej przeglądarce.', {x: '.json'})}</p>
    <div class="btnrow"><button class="sm primary" data-act="export-file">${tr('Zapisz kopię do pliku')}</button><button class="sm" data-act="import-file">${tr('Wczytaj kopię z pliku')}</button></div>
    <input id="bk-file" type="file" accept="application/json,.json" hidden>
    <div class="btnrow" style="margin-top:18px"><button class="danger sm" data-act="wipe">${tr(ui.confirmWipe ? 'Na pewno? Kliknij ponownie' : 'Wyczyść wszystkie dane')}</button><button class="sm ghost" data-act="seed">${tr('Wczytaj przykład')}</button></div>
  </section></div>`;
}

// ---------- kreator profilu (dane domyślne: pierwsze uruchomienie, wyczyszczenie danych, nowy nurek) ----------
const WIZ_STEPS = 4;
const profileOk = pr => pr.age > 0 && pr.age < 120 && pr.height >= 100 && pr.height <= 250 && pr.weight >= 25 && pr.weight <= 300;

function wizHead(n, title, lead){
  return `<div class="wiz-top"><span class="label">${tr('Krok {n} z {m}', {n, m: WIZ_STEPS})}</span>
    <div class="wiz-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${WIZ_STEPS}" aria-valuenow="${n}"><i style="width:${(n / WIZ_STEPS * 100).toFixed(0)}%"></i></div></div>
    <h2>${title}</h2>${lead ? `<p class="small muted" style="margin:6px 0 0">${lead}</p>` : ''}`;
}
const wizNav = (back, next) => `<div class="btnrow"><button class="primary" data-act="wiz-next">${tr(next || 'Dalej')}</button>
  ${back ? `<button class="ghost" data-act="wiz-back">${tr('Wstecz')}</button>` : ''}</div>`;

function viewWizard(){
  const pr = P().profile, step = ui.wiz;
  if (step === 0) return `<div class="stack"><section class="card">
    <h2>${tr('Witaj')}</h2>
    <p style="margin:8px 0 0">${tr('Policzę, ile ołowiu zabrać i jaki zestaw ocieplenia założyć, a po każdym nurkowaniu nauczę się z Twojej oceny. Najpierw kilka pytań o Ciebie — bez nich wynik byłby zgadywaniem.')}</p>
    <p class="small muted" style="margin:8px 0 0">${tr('Dane zostają w tym telefonie: bez konta, bez serwera, bez wysyłania czegokolwiek.')}</p>
    ${langTiles()}
    <p class="small muted" style="margin:10px 0 0">${tr('Bez danych o Tobie nie da się policzyć wyporności ciała, a to podstawa całego wyniku — dlatego kreatora nie można pominąć. Zajmie minutę, wszystko zmienisz później.')}</p>
    <div class="btnrow"><button class="primary" data-act="wiz-next">${tr('Wypełnij profil')}</button><button class="ghost" data-act="seed">${tr('Zobacz przykład')}</button></div>
  </section></div>`;
  if (step === 1) return `<div class="stack"><section class="card">
    ${wizHead(1, tr('Kim jesteś'), tr('Imię przyda się tylko wtedy, gdy z aplikacji korzysta więcej niż jedna osoba.'))}
    <div class="fieldset">${nameField(pr)}</div>
    ${sexTiles(pr)}
    ${ageTiles(pr)}
    <p class="small muted" style="margin:10px 0 0">${tr('Płeć i wiek wchodzą do szacunku tkanki tłuszczowej i pojemności płuc — stąd wyporność ciała.')}</p>
    ${wizNav(true)}</section></div>`;
  if (step === 2) return `<div class="stack"><section class="card">
    ${wizHead(2, tr('Twoje ciało'), tr('To najważniejsze liczby dla balastu: im więcej tkanki tłuszczowej, tym więcej ołowiu.'))}
    ${slider('height', tr('Wzrost'))}
    ${slider('weight', tr('Waga'))}
    ${buildTiles(pr)}
    <div class="fieldset">${bfField(pr)}</div>
    ${bodyOutBox(false)}
    <p class="small muted" style="margin:8px 0 0">${tr('Tłuszcz szacuję z BMI i budowy; własny % z wagi BIA będzie dokładniejszy.')}</p>
    ${wizNav(true)}</section></div>`;
  if (step === 3) return `<div class="stack"><section class="card">
    ${wizHead(3, tr('Doświadczenie i zimno'), tr('Początkujący nurkowie zwykle potrzebują trochę więcej ołowiu — model uwzględni to na starcie i poprawi po Twoich ocenach.'))}
    ${expTiles()}
    ${coldTiles(pr)}
    ${wizNav(true)}</section></div>`;
  return `<div class="stack"><section class="card">
    ${wizHead(4, tr('Twój sprzęt'), tr('Ostatnia decyzja: od czego zacząć szafę. Jedno i drugie zmienisz później w zakładce Szafa.'))}
    <div class="stack" style="margin-top:12px;gap:8px">
      <div class="opt"><div class="items">${tr('Przykładowy zestaw')}</div>
        <button class="sm primary" data-act="wiz-gear" data-v="sample">${tr('Weź przykład')}</button>
        <div class="desc">${tr('Pianka 3 mm, kamizelka, butla 12 l, płetwy i automat — podmienisz na swoje.')}</div></div>
      <div class="opt"><div class="items">${tr('Pusta szafa')}</div>
        <button class="sm" data-act="wiz-gear" data-v="empty">${tr('Zacznę od zera')}</button>
        <div class="desc">${tr('Zostaje sam automat. Sprzęt dodasz z katalogu w zakładce Szafa.')}</div></div>
    </div>
    <div class="btnrow"><button class="ghost" data-act="wiz-back">${tr('Wstecz')}</button></div></section></div>`;
}
function wizGear(kind){
  const p = P();
  if (kind === 'sample'){ const s = seedDiver(); p.wardrobe = s.wardrobe; p.plan.items = s.plan.items.slice(); return finishWizard('calc'); }
  p.wardrobe = [fromCat('misc-reg')]; p.plan.items = ['misc-reg-1'];
  finishWizard('gear', tr('Profil gotowy. Dodaj teraz swój sprzęt z katalogu.'));   // pusta szafa: od razu tam, gdzie jest co zrobić
}
function finishWizard(goTab, msg){
  P().onboarded = true; ui.wiz = 0; tab = goTab || 'calc';
  toast(msg || tr('Gotowe. Wszystko zmienisz w Profilu i Szafie.'));
  commit(); window.scrollTo(0, 0);
}

// ---------- nurkowie ----------
function switchDiver(id){
  if (!S.profiles.some(x => x.id === id)) return;
  S.activeId = id; ui.draft = null; ui.editGear = ui.editSite = ui.quick = ui.siteQ = null;
  ui.confirmWipe = false; ui.delDiver = null; ui.wiz = 0;
  commit(); window.scrollTo(0, 0);
}
function diversCard(){
  return `<section class="card"><h2>${tr('Nurkowie')} <small>${tr('{n} na tym telefonie', {n: S.profiles.length})}</small></h2>
    <div class="list">${S.profiles.map((p, i) => {
      const act = p.id === S.activeId;
      return `<div class="li"><div class="main"><div class="t">${esc(diverLabel(p, i))}${act ? ' · ' + tr('aktywny') : ''}</div>
        <div class="s">${tr('{n} nurk. w dzienniku', {n: p.dives.length})} · ${tr('{n} w szafie', {n: p.wardrobe.length})}${p.onboarded ? '' : ' · ' + tr('profil niedokończony')}</div></div>
        <div class="r">${act ? '' : `<button class="sm" data-act="diver-switch" data-id="${esc(p.id)}">${tr('Przełącz')}</button>`}
        ${S.profiles.length > 1 ? `<button class="sm danger" style="margin-top:6px" data-act="diver-del" data-id="${esc(p.id)}">${tr(ui.delDiver === p.id ? 'Na pewno?' : 'Usuń')}</button>` : ''}</div></div>`;
    }).join('')}</div>
    <div class="btnrow"><button class="sm" data-act="diver-add">${tr('Dodaj nurka')}</button></div>
    <p class="small muted" style="margin:8px 0 0">${tr('Każdy nurek ma własny profil, szafę, dziennik i naukę modelu. Akweny i język są wspólne.')}</p></section>`;
}
function whoHtml(){
  if (wizardOn()) return '';
  if (S.profiles.length < 2) return `<span class="mono">${L.total}</span> ${tr('nurk.')}`;
  return `<select id="who-sel" class="whosel" aria-label="${tr('Nurek')}">${
    S.profiles.map((p, i) => `<option value="${esc(p.id)}"${p.id === S.activeId ? ' selected' : ''}>${esc(diverLabel(p, i))}</option>`).join('')}</select>`;
}

function summaryHtml(){
  const pl = P().plan, items = resolveItems(pl.items, P()), ctx = planCtx(pl), iss = setIssues(items);
  const p = predictLead(items, dst(), ctx, L), delta = (+P().profile.coldTol || 0) + T.delta, tef = tEf(pl, delta), th = thermalOfSet(items, pl.depth);
  const short = it => it.cat === 'tank' ? (it.p.mat === 'alu' ? 'Alu ' : tr('Stal') + ' ') + fmt(it.p.vol, it.p.vol % 1 ? 1 : 0) + ' l' : nm(it).replace(/ \((wypożyczon[ay]|własny|rented|own)\)/, '');
  const order = ['wetsuit','over','hood','dry','under','bcd','wing','tank','fins'];
  const shown = items.filter(i => order.includes(i.cat)).sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
  return `<div class="sb" role="status" aria-live="polite">
    <div class="sb-lead"><div class="sb-head"><span class="label">${tr('Ołów')}</span>
        <button class="sb-q" data-act="explain" aria-expanded="${!!ui.explain}" aria-controls="lead-detail" title="${tr('Wyjaśnij')}" aria-label="${tr('Wyjaśnij')}">${ICON.ask}</button></div>
      <div class="sb-big">${fmt(p.rec)}<small>kg</small></div><div class="range">${fmt(Math.max(0, p.lo))}–${fmt(p.hi)}</div></div>
    <div class="sb-set"><div class="label">${tr('Zestaw')}</div>
      <div class="sb-items">${shown.map(i => esc(short(i))).join(' · ') || tr('Nic nie wybrano')}</div>
      <div class="sb-therm"><span>${tr('woda')} <b class="mono">${fmt(tBreak(pl).t)}°</b> · ${tr('komfort od')} <b class="mono">${fmt(th.comfort - delta)}°</b></span>${thermalVerdict(tef - th.comfort)}</div>
      ${iss.length ? `<div class="sb-warn">${tr('Brak')} ${iss.join(tr(' i '))}</div>` : ''}</div></div>`;
}
function render(){
  const ae = document.activeElement, fid = ae && ae.id && view.contains(ae) ? ae.id : null;
  let sel = null; try { sel = fid && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null; } catch(_){}
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-t]').forEach(e => e.textContent = tr(e.dataset.t));
  $('#lang').textContent = LANG === 'pl' ? 'EN' : 'PL';
  $('#lang').setAttribute('aria-label', LANG === 'pl' ? 'Switch to English' : 'Przełącz na polski');
  const wiz = wizardOn();
  $('#summary').innerHTML = !wiz && tab === 'calc' ? summaryHtml() : '';
  document.querySelector('nav.tabs').hidden = wiz;
  document.querySelectorAll('nav.tabs button').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#who').innerHTML = whoHtml(); $('#who').title = P().profile.name || '';
  const f = wiz ? viewWizard : {calc:viewCalc, log:viewLog, gear:viewGear, sites:viewSites, profile:viewProfile}[tab];
  view.innerHTML = f();
  if (fid){ const el = document.getElementById(fid); if (el){ el.focus({preventScroll:true}); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch(_){} } }
}

// ---------- klawiatura na telefonie ----------
// Gdy klawiatura zasłania ekran, przypięty pasek i dolna nawigacja zjadają resztę miejsca.
// Na czas pisania chowamy jedno i drugie i przewijamy pole na górę, żeby było widać wpis i listę podpowiedzi.
const TYPE_FIELDS = ['text','number','search','email','tel','url','password'];
const isTypingField = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TYPE_FIELDS.includes(el.type)));
function kbCheck(){
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const shrank = vv ? window.innerHeight - vv.height > 140 : false;   // iOS: zmienia się tylko widoczny obszar
  const on = isTypingField(document.activeElement) && (shrank || h < 600);   // Android: kurczy się całe okno
  if (on !== document.body.classList.contains('kb')) document.body.classList.toggle('kb', on);
  return on;
}
function kbFocus(el){
  if (!kbCheck() || !el) return;
  const box = el.closest('.fieldset') || el.closest('.f') || el;   // suwak z podpisem przewijamy w całości
  const y = box.getBoundingClientRect().top + window.scrollY - 10;  // odstęp, żeby podpis nie ucinał się o krawędź
  window.scrollTo({top: Math.max(0, y), behavior: 'smooth'});
}
document.addEventListener('focusin', e => { const t = e.target; setTimeout(() => kbFocus(t), 260); });
document.addEventListener('focusout', () => setTimeout(kbCheck, 60));
if (window.visualViewport){ visualViewport.addEventListener('resize', kbCheck); visualViewport.addEventListener('scroll', kbCheck); }
window.addEventListener('resize', kbCheck);

// ---------- zdarzenia ----------
const view = document.getElementById('view');
function draftFromPlan(){
  const p = predictLead(resolveItems(P().plan.items, P()), dst(), planCtx(P().plan), L);
  return Object.assign(JSON.parse(JSON.stringify(P().plan)), {id: newId('d'), lead: p.rec, leadFb: null, leadAdj: 1, thermal: null, note: '', date: P().plan.date || today()});
}
function setLang(l){ LANG = l; S.lang = l; save(); render(); }
$('#lang').addEventListener('click', () => setLang(LANG === 'pl' ? 'en' : 'pl'));
$('#who').addEventListener('change', e => { if (e.target.id === 'who-sel') switchDiver(e.target.value); });
$('#summary').addEventListener('click', e => {
  if (!e.target.closest('[data-act="explain"]')) return;
  ui.explain = !ui.explain; render();
  if (ui.explain){ const el = document.getElementById('lead-detail'); if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); }
});
document.querySelector('nav.tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  tab = b.dataset.tab; ui.editGear = ui.editSite = ui.quick = ui.siteQ = null; ui.confirmWipe = false; render(); window.scrollTo(0, 0);
});
function pickSite(pre, id){
  const tg = targetOf(pre); tg.siteId = id; fillTemps(tg); ui.siteQ = null;
  const el = document.getElementById(pre + 'site'); if (el) el.blur();
  return tg === P().plan ? commit() : render();
}
view.addEventListener('mousedown', e => { const b = e.target.closest('[data-act="site-pick"]'); if (b){ e.preventDefault(); pickSite(b.dataset.pre, b.dataset.id); } });
// Kalendarz na pointerdown i z preventDefault: dotknięcie ikony po wpisaniu daty powodowało blur → change →
// przebudowę widoku, więc klik lądował w pustce. Zamiast tego sami zapisujemy to, co w polu, i otwieramy wybór daty.
view.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-act="cal"],[data-act="step"]'); if (!b) return;
  e.preventDefault();                                   // bez blur → bez przebudowy widoku w trakcie dotknięcia
  const ae = document.activeElement;
  if (ae && ae.dataset && ae.dataset.f && ae !== document.getElementById(b.dataset.t)) applyPlanField(ae, false);
  if (b.dataset.act === 'cal') return openDatePicker(b.dataset.pre);
  stepValue(b);
});
function stepValue(b){
  const el = document.getElementById(b.dataset.t); if (!el) return;
  const min = el.min === '' ? -Infinity : +el.min, max = el.max === '' ? Infinity : +el.max;
  const base = num(el.value) ?? (num(el.min) ?? 0), step = +b.dataset.d;
  const v = Math.round(Math.min(max, Math.max(min, base + step)) * 10) / 10;
  if (v === num(el.value)) return;
  el.value = v;
  applyPlanField(el, true);
}
function openDatePicker(pre){
  const pk = document.getElementById(pre + 'datepick'); if (!pk) return;
  try { pk.showPicker(); }
  catch(_){ pk.style.pointerEvents = 'auto'; pk.focus(); pk.click(); pk.style.pointerEvents = ''; }
}
view.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
  const a = b.dataset.act;
  if (a === 'lang-pick') return setLang(b.dataset.v);
  if (a.startsWith('pick-')){
    const pr = P().profile, v = b.dataset.v;
    if (a === 'pick-sex') pr.sex = v;
    else if (a === 'pick-age') pr.age = +v;
    else if (a === 'pick-build') pr.build = v;
    else if (a === 'pick-cold') pr.coldTol = +v;
    else if (a === 'pick-exp') pr.divesBefore = Math.max(0, +v - P().dives.length);   // poziom podnosi się sam wraz z dziennikiem
    return commit();
  }
  if (a === 'wiz-next'){
    if (ui.wiz === 2 && !profileOk(P().profile)){ toast(tr('Wpisz wiek, wzrost i wagę — bez nich nie policzę wyporności ciała.')); return; }
    ui.wiz = Math.min(WIZ_STEPS, ui.wiz + 1); render(); return window.scrollTo(0, 0); }
  if (a === 'wiz-back'){ ui.wiz = Math.max(0, ui.wiz - 1); render(); return window.scrollTo(0, 0); }
  if (a === 'wiz-gear') return wizGear(b.dataset.v);
  if (a === 'diver-switch') return switchDiver(b.dataset.id);
  if (a === 'diver-add'){ const d = emptyDiver(); S.profiles.push(d); S.activeId = d.id; fillTemps(d.plan); ui.wiz = 1; ui.delDiver = null; ui.draft = null; commit(); return window.scrollTo(0, 0); }
  if (a === 'diver-del'){
    const id = b.dataset.id;
    if (ui.delDiver !== id){ ui.delDiver = id; return render(); }
    ui.delDiver = null;
    if (S.profiles.length < 2) return;
    S.profiles = S.profiles.filter(x => x.id !== id);
    if (S.activeId === id){ S.activeId = S.profiles[0].id; ui.draft = null; ui.editGear = null; }
    toast(tr('Nurek usunięty')); return commit(); }
  if (a === 'site-pick') return pickSite(b.dataset.pre, b.dataset.id);
  if (a === 'plan-toggle'){ P().plan.items = toggleItem(P().plan.items, b.dataset.uid); return commit(); }
  if (a === 'draft-toggle'){ ui.draft.items = toggleItem(ui.draft.items, b.dataset.uid); return render(); }
  if (a === 'use-combo'){ const base = P().plan.items.filter(u => { const w = itemOf(u, P()); return w && !EXPO.includes(w.cat); }); P().plan.items = base.concat(b.dataset.uids.split(',')); toast(tr('Zestaw podmieniony')); return commit(); }
  if (a === 'log-from-plan'){ ui.draft = draftFromPlan(); tab = 'log'; render(); return window.scrollTo(0, 0); }
  if (a === 'new-dive'){ ui.draft = draftFromPlan(); return render(); }
  if (a === 'edit-dive'){ ui.draft = JSON.parse(JSON.stringify(P().dives.find(d => d.id === b.dataset.id))); render(); return window.scrollTo(0, 0); }
  if (a === 'seg'){ ui.draft[b.dataset.name] = ui.draft[b.dataset.name] === b.dataset.v ? null : b.dataset.v; return render(); }
  if (a === 'cancel-dive'){ ui.draft = null; return render(); }
  if (a === 'del-dive'){ P().dives = P().dives.filter(d => d.id !== ui.draft.id); ui.draft = null; toast(tr('Nurkowanie usunięte')); return commit(); }
  if (a === 'save-dive'){
    const d = ui.draft;
    if (!validDate(d.date)){ toast(tr('Data w formacie rrrr-mm-dd')); return; }
    if (d.leadFb && (d.lead == null || d.lead === '')){ toast(tr('Wpisz, ile ołowiu miałeś')); return; }
    const before = L.theta[0];
    P().dives = P().dives.filter(x => x.id !== d.id).concat([d]); ui.draft = null; save(); recompute(); render();
    return toast(d.leadFb ? tr('Zapisano. Korekta osobista: {a} → {b} kg', {a: sgn(before), b: sgn(L.theta[0])}) : tr('Zapisano'));
  }
  if (a === 'edit-gear'){ ui.editGear = ui.editGear === b.dataset.uid ? null : b.dataset.uid; return render(); }
  if (a === 'close-gear'){ ui.editGear = null; return commit(); }
  if (a === 'quick-open'){ ui.quick = ui.quick ? null : {q:'', cat:'', kind:'bought'}; ui.editGear = null; return render(); }
  if (a === 'quick-kind'){ ui.quick.kind = b.dataset.v; return render(); }
  if (a === 'quick-add'){ return quickItem(fromCat(b.dataset.id, {uid: newId(b.dataset.id)})); }
  if (a === 'quick-own'){ const cat = $('#qq-own').value; return quickItem({uid: newId('own'), catId: null, cat, brand: 'Własne', model: catOne(cat), size: '', year: null, p: JSON.parse(JSON.stringify(OWN_DEFAULTS[cat])), src: 'wpis własny'}); }
  if (a === 'del-gear'){ const u = b.dataset.uid; P().wardrobe = P().wardrobe.filter(w => w.uid !== u); P().plan.items = P().plan.items.filter(x => x !== u); ui.editGear = null; toast(tr('Usunięto z szafy')); return commit(); }
  if (a === 'add-cat'){ const w = fromCat(b.dataset.id, {uid: newId(b.dataset.id), year: new Date().getFullYear()}); P().wardrobe.push(w); ui.editGear = w.uid; toast(tr('Dodano — ustaw rozmiar')); return commit(); }
  if (a === 'add-custom'){
    const cat = $('#custom-cat').value;
    const w = {uid: newId('own'), catId: null, cat, brand: 'Własne', model: catOne(cat) + ' ' + tr('(własny)'), size: '', year: new Date().getFullYear(), p: JSON.parse(JSON.stringify(OWN_DEFAULTS[cat])), src: 'wpis własny'};
    P().wardrobe.push(w); ui.editGear = w.uid; return commit();
  }
  if (a === 'edit-site'){ ui.editSite = ui.editSite === b.dataset.id ? null : b.dataset.id; return render(); }
  if (a === 'close-site'){ ui.editSite = null; return commit(); }
  if (a === 'add-site'){ const s = {id: newId('site'), name: tr('Nowy akwen'), rho: 1.000, ts: [4,4,5,8,13,18,21,21,17,12,7,4], tb: [4,4,4,5,6,7,8,8,8,7,6,4]}; S.sites.push(s); ui.editSite = s.id; return commit(); }
  if (a === 'del-site'){ S.sites = S.sites.filter(s => s.id !== b.dataset.id); ui.editSite = null; return commit(); }
  if (a === 'reset-learn'){ P().learnSince = today(); toast(tr('Nauka zaczyna się od dziś')); return commit(); }
  if (a === 'unreset-learn'){ delete P().learnSince; return commit(); }
  if (a === 'import-dive'){ const f = $('#dive-file'); f.value = ''; f.click(); return; }
  if (a === 'export-file') return exportFile();
  if (a === 'import-file'){ const f = $('#bk-file'); f.value = ''; f.click(); return; }
  if (a === 'wipe'){ if (!ui.confirmWipe){ ui.confirmWipe = true; return render(); }
    ui.confirmWipe = false; const d = emptyDiver();
    S = {v:1, lang: LANG, sites: seedSites(), profiles:[d], activeId: d.id};
    fillTemps(d.plan); tab = 'calc'; ui.wiz = 0; ui.delDiver = null; ui.draft = null;
    toast(tr('Wyczyszczono. Zacznij od profilu i szafy.')); return commit(); }
  if (a === 'seed'){ S = seedState(); S.lang = LANG; P().onboarded = true; tab = 'calc'; ui.wiz = 0; ui.draft = null; toast(tr('Wczytano przykład')); return commit(); }
});
// Nurkowanie z pliku komputera: wypełniamy szkic tym, co wie komputer.
// Ołów i ocena ciepła zostają puste — tego żaden komputer nie zapisuje, a to z nich uczy się model.
const IMPORT_ERR = {notJson: 'To nie jest plik .json', notSuunto: 'Nie rozpoznaję tego pliku — oczekuję eksportu z aplikacji Suunto', notDive: 'Ten plik nie opisuje nurkowania'};
function importDive(text){
  const r = parseSuuntoJson(text);
  if (!r.ok) return toast(tr(IMPORT_ERR[r.why] || 'Nie rozpoznaję tego pliku'));
  const d = r.dive, draft = draftFromPlan();
  draft.date = d.date; draft.depth = d.depth; draft.time = d.time;
  if (d.tSurf != null){ draft.tSurf = d.tSurf; draft.tMeasured = true; }
  if (d.tBottom != null){ draft.tBottom = d.tBottom; draft.tMeasured = true; }
  if (d.gps) draft.gps = d.gps;
  if (d.note) draft.note = d.note;
  draft.nDay = P().dives.filter(x => x.date === d.date).length + 1;
  const dup = P().dives.some(x => x.date === d.date && Math.abs((+x.depth || 0) - d.depth) < 0.6 && Math.abs((+x.time || 0) - d.time) < 3);
  ui.draft = draft; tab = 'log'; ui.delDiver = null; render(); window.scrollTo(0, 0);
  toast(dup ? tr('Wczytano, ale podobne nurkowanie już jest w dzienniku')
    : tr('Wczytano: {d} m, {t} min, {a}–{b} °C. Dopisz ołów i ocenę.', {d: fmt(d.depth), t: d.time, a: fmt(d.tBottom ?? 0), b: fmt(d.tSurf ?? 0)}));
}

// kopia jako plik do pobrania — w PWA działa zwykły <a download>
function exportFile(){
  const name = 'balast-ocieplenie-' + today() + '.json';
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(S)], {type:'application/json'}));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(tr('Zapisano plik {x}', {x: name}));
  } catch(_){ toast(tr('Przeglądarka nie pozwoliła zapisać pliku')); }
}
// zapisuje pole planu/nurkowania; redraw=false gdy wołamy to sami przed inną akcją
function applyPlanField(t, redraw){
  const tg = targetOf(t.id.startsWith('d-') ? 'd-' : 'p-'), k = t.dataset.f, v = t.value;
  if (k === 'date'){
    if (!validDate(v)){ if (redraw){ toast(tr('Data w formacie rrrr-mm-dd')); render(); } return; }
    tg.date = v; fillTemps(tg);                       // zmiana daty podmienia temperatury w polach → pełny render
    if (!redraw) return;
    return tg === P().plan ? commit() : render();
  }
  tg[k] = k === 'note' ? v : num(v);
  // Liczby zmieniają tylko wyniki pochodne, więc odświeżamy je punktowo. Przebudowa całego widoku
  // gubiła pierwsze tapnięcie w dowolny przycisk po wpisaniu wartości (blur → change → nowy DOM).
  if (tg === P().plan){ save(); recompute(); refreshPlanDerived(); }
}
function importText(txt){
  let o = null;
  try { o = migrate(JSON.parse(txt)); } catch(_){}
  if (!o) return toast(tr('To nie jest kopia z tej aplikacji — wybierz plik zapisany przez tę aplikację'));
  S = o; LANG = S.lang === 'en' ? 'en' : 'pl';
  tab = 'calc'; ui.wiz = 0; ui.draft = null; ui.editGear = null; ui.delDiver = null;
  toast(tr('Wczytano kopię')); commit();
}
view.addEventListener('focusin', e => {
  const t = e.target;
  if (t.dataset.act === 'siteq' && !(ui.siteQ && ui.siteQ.pre === t.dataset.pre)){ ui.siteQ = {pre: t.dataset.pre, q: ''}; ui.hl = 0; render(); }
});
view.addEventListener('focusout', e => {
  const t = e.target;
  if (t.dataset.act === 'siteq') setTimeout(() => {
    const ae = document.activeElement;
    if (ui.siteQ && !(ae && ae.dataset && ae.dataset.act === 'siteq')){ ui.siteQ = null; render(); }
  }, 120);
});
view.addEventListener('keydown', e => {
  const t = e.target;
  if (t.dataset.act !== 'siteq' || !ui.siteQ) return;
  const list = siteMatches(ui.siteQ.q);
  if (e.key === 'ArrowDown'){ e.preventDefault(); ui.hl = Math.min(list.length - 1, ui.hl + 1); render(); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); ui.hl = Math.max(0, ui.hl - 1); render(); }
  else if (e.key === 'Enter'){ e.preventDefault(); if (list[ui.hl]) pickSite(ui.siteQ.pre, list[ui.hl].id); }
  else if (e.key === 'Escape'){
    // render() podmienia pole i przywraca na nie fokus, więc blur trzeba wywołać na nowym elemencie,
    // inaczej focusin natychmiast otwiera listę z powrotem
    const id = t.id; ui.siteQ = null; render();
    const el = document.getElementById(id); if (el) el.blur();
  }
});
view.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.act === 'slide') return setBodyValue(t.dataset.k, +t.value, 'slide');
  if (t.dataset.act === 'typed'){
    const k = t.dataset.k, v = num(t.value);
    if (v == null || isNaN(v)) return;                 // w trakcie wpisywania pole bywa puste
    return setBodyValue(k, v, 'typed');
  }
  if (t.dataset.act === 'siteq'){ ui.siteQ = {pre: t.dataset.pre, q: t.value}; ui.hl = 0; return render(); }
  if (t.dataset.date){
    const d = t.value.replace(/\D/g, '').slice(0, 8);
    const f = d.length > 6 ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6) : d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
    if (f !== t.value){ t.value = f; try { t.setSelectionRange(f.length, f.length); } catch(_){} }
    return;
  }
  if (t.dataset.act === 'qq'){ ui.quick.q = t.value; return render(); }
  if (t.dataset.act === 'q'){ ui.addQ = t.value; return render(); }
});
view.addEventListener('change', e => {
  const t = e.target, v = t.value;
  if (t.dataset.act === 'slide'){ save(); recompute(); return; }
  if (t.dataset.act === 'typed'){                       // po wyjściu z pola: zakres suwaka jest wiążący
    const k = t.dataset.k, [min, max] = SLIDE_RANGE[k];
    const val = Math.min(max, Math.max(min, num(v) ?? P().profile[k]));
    t.value = val; setBodyValue(k, val, 'typed'); save(); recompute();
    return;
  }
  if (t.id === 'dive-file'){ const f = t.files[0]; t.value = ''; if (f) f.text().then(importDive, () => toast(tr('Nie udało się odczytać pliku'))); return; }
  if (t.id === 'bk-file'){ const f = t.files[0]; t.value = ''; if (f) f.text().then(importText, () => toast(tr('Nie udało się odczytać pliku'))); return; }
  if (t.dataset.act === 'qc'){ ui.addCat = v; return render(); }
  if (t.dataset.act === 'qqc'){ ui.quick.cat = v; return render(); }
  if (t.dataset.act === 'siteq') return;
  if (t.dataset.pick){
    if (!v) return;
    const tg = targetOf(t.dataset.pick); tg.date = v; fillTemps(tg);
    return tg === P().plan ? commit() : render();
  }
  if (t.dataset.f) return applyPlanField(t, true);
  if (t.dataset.pr){
    const k = t.dataset.pr; P().profile[k] = ['name','sex','build'].includes(k) ? v : (k === 'bf' ? (v === '' ? '' : num(v)) : num(v));
    save(); recompute(); refreshBody();
    return;
  }
  if (t.dataset.w || t.dataset.p){
    const w = P().wardrobe.find(x => x.uid === ui.editGear); if (!w) return;
    if (t.dataset.w) w[t.dataset.w] = t.dataset.w === 'year' ? num(v) : t.dataset.w === 'rental' ? v === '1' : v;
    else { const k = t.dataset.p; w.p[k] = t.dataset.bool ? v === '1' : ['cover','shell','plate','mat'].includes(k) ? v : num(v); if (k === 'plate') delete w.p.b; }
    if (w.catId && !w.src.includes('zmienione')) w.src += '; zmienione przez Ciebie';
    return commit();
  }
  if (t.dataset.s){
    const s = S.sites.find(x => x.id === ui.editSite); if (!s) return;
    const k = t.dataset.s;
    if (k === 'name') s.name = v;
    else if (k === 'rho') s.rho = +v;
    else { const arr = v.split(/[;\s]+/).map(num).filter(x => x != null && !isNaN(x)); if (arr.length === 12) s[k] = arr; else { toast(tr('Podaj 12 wartości, sty→gru')); return render(); } }
    return commit();
  }
});

load(); recompute(); render();
