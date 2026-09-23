// Balast i Ocieplenie — stan, widoki i zdarzenia aplikacji.
// Copyright (c) 2026 Maciej Korzeniowski. Wszelkie prawa zastrzeżone / All rights reserved.
// Kopiowanie i utwory zależne wymagają pisemnej zgody autora — zobacz LICENSE.
// ===== Aplikacja =====
const KEY = 'balast-ocieplenie.v1';
let S, L, T, memOnly = false, tab = 'calc', ui = {draft:null, editGear:null, editSite:null, addQ:'', addCat:'', confirmWipe:false, quick:null, siteQ:null, hl:0, wiz:0, delDiver:null, explain:false, planInfo:false, thermInfo:false, gateSteps:false, wizCat:0};
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
  try { S = migrate(raw ? JSON.parse(raw) : freshState()) || freshState(); }
  catch(e){ S = freshState(); }
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
// Bez butli i bez kamizelki/skrzydła nie ma czego liczyć — to one dźwigają największą część
// wyporności zestawu. Zamiast pokazywać liczbę, która zaraz się zmieni o kilka kilogramów,
// mówimy wprost, czego brakuje. Dwie formy, bo raz mówimy „Brak butli", a raz „Dodaj butlę".
const SET_NEED = [
  {has: i => i.cat === 'bcd' || i.cat === 'wing', gen: 'kamizelki lub skrzydła', acc: 'kamizelkę albo skrzydło'},
  {has: i => i.cat === 'tank', gen: 'butli', acc: 'butlę'}
];
const setIssues = items => SET_NEED.filter(n => !items.some(n.has));
const issGen = iss => iss.map(n => tr(n.gen)).join(tr(' i '));
const issAcc = iss => iss.map(n => tr(n.acc)).join(tr(' i '));

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
  ask: SVG('<circle cx="12" cy="12" r="9"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.4 3.3c-.5.2-.7.6-.7 1.1v.6"/><path d="M12 17.4v.2"/>'),
  geo: SVG('<circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6"/>'),
  own: SVG('<path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M6 10v9.5h12V10"/>'),
  rent: SVG('<circle cx="10" cy="19.4" r="1.5"/><circle cx="17" cy="19.4" r="1.5"/><path d="M2.6 4h2.6l2.4 11h10l2.2-8.2H6.2"/>'),
  share: SVG('<path d="M12 3.2v11"/><path d="M8.4 6.8 12 3.2l3.6 3.6"/><path d="M7 10.5H5.2v9.3h13.6v-9.3H17"/>')
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
const SLIDE_RANGE = {height:[130, 210, 2.5, 'cm'], weight:[35, 180, 2.5, 'kg']};
function slider(k, lab){
  const [min, max, step, unit] = SLIDE_RANGE[k], val = P().profile[k];
  return `<div class="fieldset"><label class="label" for="num-${k}">${lab}</label><div class="slider">
    <input type="range" id="pr-${k}" min="${min}" max="${max}" step="${step}" value="${esc(val)}" data-act="slide" data-k="${k}" aria-label="${lab}">
    <span class="val"><input id="num-${k}" type="number" inputmode="decimal" step="any" min="${min}" max="${max}" value="${esc(val)}" data-act="typed" data-k="${k}"><small>${unit}</small></span>
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
    g.items.map(w => `<button class="chip" data-act="${act}" data-uid="${esc(w.uid)}" aria-pressed="${selected.includes(w.uid)}" title="${tr(w.rental ? 'wypożyczony' : 'mój')}">${
      w.rental ? ICON.rent : ICON.own}<span class="sr">${tr(w.rental ? 'wypożyczony' : 'mój')}: </span>${esc(bareName(w))}${w.size ? ' · ' + esc(w.size) : ''}</button>`).join('')
  }</div></div>`).join('') + (P().wardrobe.some(w => w.rental) ? `<p class="small muted chip-key" style="margin:10px 0 0">${ICON.own}${tr('mój')} · ${ICON.rent}${tr('wypożyczony')}</p>` : '');
}
// nazwa bez dopisku o własności — tę niesie już ikona na chipie
const bareName = w => nm(w).replace(/ \((wypożyczon[ay]|własny|rented|own)\)/, '');
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
// Plan pokazuje tylko to, co naprawdę zmienia wynik: akwen, datę, głębokość i temperaturę dna.
// Czas, numer nurkowania dnia, rezerwa i temperatura powierzchni zostają w danych z rozsądnymi
// założeniami, a poprawić je można przy zapisie w dzienniku (full = true).
function planFields(pl, pre, full){
  // W planie data służy tylko do podania temperatur z akwenu, więc wystarczy miesiąc — jedno tapnięcie
  // zamiast wpisywania rrrr-mm-dd i walki z kalendarzem. Dziennik dostaje pełną datę, bo tam liczy się dzień.
  return `<div class="grid2">
    ${siteCombo(pl, pre)}${full ? '' : '</div>' + fieldset(tr('Miesiąc'), tiles('set-month', lbl().months.map((lab, i) => ({v: i, label: lab})), o => +o.v === monthOf(pl.date), 'compact')) + '<div class="grid2">'}
    ${full ? `<div class="f wide"><label for="${pre}date">${tr('Data')}</label><div class="datebox">
      <input id="${pre}date" type="text" inputmode="numeric" maxlength="10" placeholder="${tr('rrrr-mm-dd')}" data-f="date" data-date="1" value="${esc(pl.date)}">
      <button type="button" class="calbtn" data-act="cal" data-pre="${pre}" aria-label="${tr('Kalendarz')}"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></button>
      <input type="date" class="datepick" id="${pre}datepick" data-pick="${pre}" tabindex="-1" aria-hidden="true" value="${esc(validDate(pl.date) ? pl.date : '')}"></div></div>` : ''}
    ${stepField(pre + 'depth', tr('Głębokość maks. (m)'), 'depth', pl.depth, 1, 0, 120)}
    ${stepField(pre + 'tb', tr('Temp. na dnie (°C)'), 'tBottom', pl.tBottom, 1, -2, 40)}
  </div>
  ${full ? `<details class="more"><summary>${tr('Szczegóły (opcjonalnie)')}</summary><div class="grid2">
    ${stepField(pre + 'time', tr('Czas (min)'), 'time', pl.time, 5, 1, 400)}
    ${stepField(pre + 'nday', tr('Nurkowanie dnia nr'), 'nDay', pl.nDay, 1, 1, 9)}
    ${stepField(pre + 'ts', tr('Temp. powierzchnia (°C)'), 'tSurf', pl.tSurf, 1, -2, 40)}
    ${stepField(pre + 'res', tr('Rezerwa w butli (bar)'), 'reserve', pl.reserve, 10, 0, 300)}
  </div></details>` : ''}`;
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

// Najbliższy akwen z pozycji telefonu. Pozycja nigdzie nie jest zapisywana ani wysyłana —
// porównujemy ją tylko z listą akwenów, która i tak siedzi w pamięci telefonu.
// S.geo: brak = jeszcze nie pytaliśmy, 'on' = wolno pytać telefon, 'off' = nurek wybiera sam.
function locateSite(silent){
  if (!navigator.geolocation) return silent || toast(tr('Ten telefon nie udostępnia lokalizacji'));
  navigator.geolocation.getCurrentPosition(pos => {
    const m = matchSite({lat: pos.coords.latitude, lon: pos.coords.longitude}, S.sites);
    if (!m) return silent || toast(tr('Żaden akwen z listy nie leży blisko Ciebie'));
    if (P().plan.siteId === m.id) return silent || toast(tr('Akwen już pasuje do Twojej pozycji'));
    P().plan.siteId = m.id; fillTemps(P().plan);
    toast(tr('Akwen z lokalizacji: {x} ({km} km)', {x: siteName(siteOf(m.id)), km: m.km}));
    commit();
  }, err => {
    if (err && err.code === 1){ S.geo = 'off'; save(); render(); }   // odmowa w telefonie = nie pytamy więcej
    if (!silent) toast(tr('Nie udało się ustalić lokalizacji'));
  }, {timeout: 8000, maximumAge: 300000});
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
const OWN_DEFAULTS = {wetsuit:{t:5, cover:'full'}, over:{t:3, cover:'vest', hood:true}, hood:{t:5, cover:'hood', hood:true}, gloves:{t:3, cover:'gloves'}, boots:{t:5, cover:'boots'}, dry:{shell:'trilam', b:0.3}, under:{g:4, tmin:8}, bcd:{b:1.0}, wing:{plate:'alu'}, tank:{vol:12, mat:'stal', be:-1.4, vd:13.8}, stage:{vol:11.1, mat:'alu', be:1.5, vd:15.7}, fins:{b:0, mass:1500}, misc:{b:0}};
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
const STD_STAGES = CATALOG.filter(c => c.cat === 'stage');
function tankRow(list, label, hint, selected, act){
  return `<div class="group"><div class="label">${label} <span class="muted">${hint}</span></div>
    <div class="chips">${list.map(c => {
      const uid = 'cat:' + c.id, on = selected.includes(uid);
      return `<button class="chip" data-act="${act || 'plan-toggle'}" data-uid="${esc(uid)}" aria-pressed="${on}">${esc(frag(c.brand))} ${esc(frag(c.model))}</button>`;
    }).join('')}</div>`;
}
function tankPicker(selected, act){
  const mine = P().wardrobe.some(w => w.cat === 'tank' && selected.includes(w.uid));
  // Butla podstawowa jest jedna — wybór nowej zastępuje poprzednią. Stage odwrotnie: dokłada się
  // do zestawu i można mieć kilka, więc siedzi w osobnym rzędzie, żeby nikt nie szukał, czemu nic nie zniknęło.
  return tankRow(STD_TANKS, tr('Butla standardowa'), tr('bez dodawania do szafy'), selected, act) +
    `${mine ? `<p class="small muted" style="margin:6px 0 0">${tr('Wybrana jest Twoja butla z szafy — tapnięcie standardowej ją zastąpi.')}</p>` : ''}</div>` +
    tankRow(STD_STAGES, tr('Butla stage'), tr('bez dodawania do szafy, dokładana do podstawowej'), selected, act) + '</div>';
}

// ---------- widoki ----------
function leadDetailHtml(pl, items, p){
  const iss = setIssues(items), site = siteOf(pl.siteId);
  if (iss.length) return `<section class="card" id="lead-detail"><h2>${tr('Balast')}</h2>
    <p style="margin:10px 0 0">${tr('Najpierw dodaj {x} do zestawu. To one ważą najwięcej w bilansie wyporności, więc liczba bez nich byłaby zgadywaniem.', {x: issAcc(iss)})}</p></section>`;
  return `<section class="card" id="lead-detail"><h2>${tr('Balast')} <small>${tr('zakres 80%: {a}–{b} kg', {a: fmt(Math.max(0, p.lo)), b: fmt(p.hi)})}</small></h2>
    <div class="small muted">${esc(siteName(site))} · ${L.n ? tr('nauka z {n} nurk. w dzienniku', {n: L.n}) : tr('bez nauki, tylko fizyka')} · ${tr('doświadczenie: {n} nurk. ({l})', {n: L.total, l: tr(L.exp.label)})}</div>
    ${scaleHtml(p)}
    <div class="note">${esc(distribution(p, items))} ${tr('Przy pierwszym nurkowaniu w tej konfiguracji zrób kontrolę na 5 m z rezerwą i pustą kamizelką.')}</div>
  </section>

  <section class="card"><h2>${tr('Skąd ta liczba')} <small>${tr('kg wyporności na 5 m')}</small></h2>${barsHtml(p)}
    <p class="small muted" style="margin:12px 0 0">${tr('Suma w wodzie {w} kg to {d} kg suchego ołowiu (ołów też wypiera wodę), zaokrąglone w górę do 0,5 kg.', {w: sgn(p.water), d: fmt(p.dry)})}</p></section>`;
}
function thermalCardHtml(pl, items){
  const delta = (+P().profile.coldTol || 0) + T.delta, tef = tEf(pl, delta), th = thermalOfSet(items, pl.depth), m = tef - th.comfort;
  const tb = tBreak(pl), adv = advisor(pl, items), curExpo = items.filter(i => EXPO.includes(i.cat));
  return `<section class="card" id="thermal-card"><div class="card-head"><h2>${tr('Ocieplenie')} <small>${tr('temperatura nurkowania {t} °C', {t: fmt(tb.t)})}</small></h2>
      <button class="sb-q" data-act="therm-info" aria-expanded="${!!ui.thermInfo}" title="${tr('Skąd ta temperatura')}" aria-label="${tr('Skąd ta temperatura')}">${ICON.ask}</button></div>
    <div class="therm-head"><div class="small">${tr('Twój zestaw daje Ci komfort od')} <b class="mono">${fmt(th.comfort - delta)} °C</b></div>${thermalVerdict(m)}</div>
    ${ui.thermInfo ? `<p class="small muted" style="margin:8px 0 0">${tr('Temperatura nurkowania = dno {b} °C × 75% + powierzchnia {s} °C × 25%', {b: fmt(pl.tBottom), s: fmt(pl.tSurf)})}${tb.long ? tr(' − {x} °C za długie nurkowanie', {x: fmt(tb.long)}) : ''}${tb.rep ? tr(' − {x} °C za kolejne nurkowanie dnia', {x: fmt(tb.rep)}) : ''}.
    ${tr('Komfort zestawu dla przeciętnego nurka: od {c} °C', {c: fmt(th.comfort)})}${Math.abs(delta) >= 0.1 ? tr('; Twoja tolerancja zimna {d} °C', {d: sgn(delta)}) : ''}.</p>` : ''}
    <div class="stack" style="margin-top:12px;gap:8px">
      <div class="label">${tr(adv.anyOk ? 'Najlżejsze wystarczające zestawy z Twojej szafy (bez wypożyczonych)' : 'Nic w szafie nie wystarcza — najcieplejsze opcje')}</div>
      ${adv.list.map(r => { const on = sameSet(r.c, curExpo); return `<div class="opt${on ? ' best' : ''}">
        <div class="items">${r.c.map(x => esc(nm(x))).join(' + ')}</div>
        ${on ? `<span class="pill info" style="align-self:start">${tr('Wybrany')}</span>` : `<button class="sm" data-act="use-combo" data-uids="${esc(r.c.map(x => x.uid).join(','))}">${tr('Użyj')}</button>`}
        <div class="meta">${setIssues(items).length
          ? tr('komfort od {c} °C · zapas {m} °C', {c: fmt(r.th.comfort - delta), m: sgn(r.m)})
          : tr('komfort od {c} °C · zapas {m} °C · ołów {l} kg', {c: fmt(r.th.comfort - delta), m: sgn(r.m), l: fmt(r.lead)})}</div>
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
  <section class="card" id="plan-card"><div class="card-head"><h2>${tr('Planowane nurkowanie')}</h2>
      <button class="sb-q" data-act="plan-info" aria-expanded="${!!ui.planInfo}" title="${tr('Założenia')}" aria-label="${tr('Założenia')}">${ICON.ask}</button></div>
    ${planFields(pl, 'p-')}
    ${S.geo == null ? `<div class="opt" style="margin-top:10px;grid-template-columns:1fr"><div class="items">${tr('Ustawiać akwen po Twojej lokalizacji?')}</div>
      <div class="desc">${tr('Telefon zapyta o zgodę. Pozycja zostaje w telefonie — służy tylko do wskazania najbliższego akwenu z listy.')}</div>
      <div class="btnrow" style="margin-top:6px"><button class="sm primary" data-act="geo-on">${ICON.geo}${tr('Tak, najbliższy akwen')}</button>
        <button class="sm ghost" data-act="geo-off">${tr('Wybiorę sam')}</button></div></div>`
      : S.geo === 'on' ? `<div class="btnrow" style="margin-top:8px"><button class="sm ghost" data-act="geo-now">${ICON.geo}${tr('Najbliższy akwen')}</button></div>` : ''}
    ${ui.planInfo ? `<p class="small muted" style="margin:10px 0 0">${tr('Temperaturę dna podpowiada akwen dla wybranego miesiąca; wpisz własną, jeśli znasz aktualną.')}
      ${tr('Komfort liczę ostrożnie — jak dla {n}. nurkowania w ciągu dnia i {t} min pod wodą, przy rezerwie {r} bar. Czas, kolejność i temperaturę powierzchni poprawisz przy zapisie w dzienniku.', {n: pl.nDay, t: pl.time, r: pl.reserve})}</p>` : ''}</section>

  <button class="primary" data-act="log-from-plan">${tr('Po nurkowaniu: zapisz i oceń')}</button>

  <div id="thermal-box">${thermalCardHtml(pl, items)}</div>

  <section class="card" id="set-card"><div class="therm-head" style="margin-bottom:10px"><h2 style="margin:0">${tr('Zestaw')}</h2>
    <button class="sm${ui.quick ? ' ghost' : ''}" data-act="quick-open" aria-expanded="${!!ui.quick}">${tr(ui.quick ? 'Zamknij' : '+ Dodaj sprzęt')}</button></div>
    ${ui.quick ? quickAdd() : ''}
    ${ui.editGear && P().wardrobe.some(w => w.uid === ui.editGear) ? `<div class="label" style="margin-top:4px">${tr('Dodane: {x}', {x: esc(nm(P().wardrobe.find(w => w.uid === ui.editGear)))})}</div>${paramEditor(P().wardrobe.find(w => w.uid === ui.editGear))}<div style="height:12px"></div>` : ''}
    ${chipsFor(pl.items, 'plan-toggle')}
    ${tankPicker(pl.items)}</section>

  <div id="lead-box">${ui.explain ? leadDetailHtml(pl, items, p) : ''}</div>

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
    ${dives.some(d => !d.leadFb || d.lead == null || d.lead === '') ? `<p class="small muted" style="margin:0 0 10px">${tr('Nurkowania bez ołowiu i oceny balastu nie uczą modelu — otwórz je przyciskiem Edytuj i uzupełnij.')}</p>` : ''}
    ${dives.length ? `<div class="list">${dives.map(d => `<div class="li">
      <div class="main"><div class="t">${esc(siteName(siteOf(d.siteId)))}</div>
      <div class="s mono">${esc(d.date)} · ${fmt(+d.depth, +d.depth % 1 ? 1 : 0)} m · ${esc(d.time)} min · ${fmt(+d.tBottom, +d.tBottom % 1 ? 1 : 0)}–${fmt(+d.tSurf, +d.tSurf % 1 ? 1 : 0)} °C</div>
      <div class="s">${resolveItems(d.items, P()).filter(i => EXPO.includes(i.cat)).map(i => esc(nm(i))).join(' + ') || tr('bez ocieplenia')}</div>
      ${d.note ? `<div class="s"><i>${esc(d.note)}</i></div>` : ''}</div>
      <div class="r"><div class="mono">${d.lead != null && d.lead !== '' ? fmt(+d.lead) + ' kg' : '—'}</div>
      <div style="margin-top:4px;display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">
        ${d.leadFb ? `<span class="pill ${d.leadFb === 'ok' ? 'good' : 'warn'}">${d.leadFb === 'ok' ? tr('balast OK') : tr(d.leadFb === 'light' ? 'za lekko {x}' : 'za ciężko {x}', {x: fmt(d.leadAdj)})}</span>`
          : `<span class="pill">${tr('bez oceny balastu')}</span>`}
        ${d.thermal ? `<span class="pill info">${tr(THERM[d.thermal])}</span>` : ''}</div>
      <button class="sm ghost" style="margin-top:6px" data-act="edit-dive" data-id="${esc(d.id)}">${tr('Edytuj')}</button></div></div>`).join('')}</div>`
      : `<p class="muted">${tr('Brak nurkowań. Po pierwszym zapisie aplikacja zacznie się uczyć.')}</p>`}
    </section></div>`;
}
function viewDraft(){
  const d = ui.draft, isNew = !P().dives.some(x => x.id === d.id);
  const seg = (name, cls, opts, val, icons) => `<div class="seg ${cls}" role="group">${opts.map(([v, l]) => `<button data-act="seg" data-name="${name}" data-v="${v}" aria-pressed="${val === v}">${icons && icons[v] || ''}${tr(l)}</button>`).join('')}</div>`;
  return `<div class="stack">
    ${d.imported ? `<div class="banner">${tr('Wczytane z komputera. Komputer nie zapisuje ołowiu ani ciepła — wybierz sprzęt, wpisz ołów z oceną i zaznacz komfort, wtedy to nurkowanie nauczy model.')}</div>` : ''}
    <section class="card"><h2>${tr(isNew ? 'Nowe nurkowanie' : 'Edycja nurkowania')}</h2>${planFields(d, 'd-', true)}
      ${d.gps ? `<p class="small muted" style="margin:10px 0 0">${d.siteFromGps
        ? tr('Akwen rozpoznany z pozycji {lat} N {lon} E ({km} km od środka rejonu) — zmień, jeśli nie ten.', {lat: fmt(d.gps.lat, 4), lon: fmt(d.gps.lon, 4), km: d.siteFromGps})
        : tr('Komputer podał pozycję {lat} N {lon} E — akwen wybierz sam.', {lat: fmt(d.gps.lat, 4), lon: fmt(d.gps.lon, 4)})}</p>` : ''}
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
  const cat = CATALOG.find(c => c.id === w.catId);
  // rozmiar zapisany wcześniej zostawiamy na liście, nawet gdy katalog zmienił oznaczenia
  const sizes = cat ? (w.size && !cat.sizes.includes(w.size) ? cat.sizes.concat([w.size]) : cat.sizes) : null;
  // własność i rozmiar to przyciski: jedno tapnięcie zamiast rozwijania listy
  const own = fieldset(tr('Własność'), `<div class="seg" role="group" aria-label="${tr('Własność')}">
      <button type="button" data-act="gear-own" data-v="0" aria-pressed="${!w.rental}">${tr('Mój')}</button>
      <button type="button" data-act="gear-own" data-v="1" aria-pressed="${!!w.rental}">${tr('Wypożyczony')}</button></div>`);
  // jednorozmiarowe pozycje (skrzydła, butle, drobne) nie mają czego wybierać — pole tylko myli
  const size = sizes && sizes.length > 1
    ? fieldset(tr('Rozmiar'), tiles('gear-size', sizes.map(x => ({v: x, label: x})), o => o.v === w.size, 'compact'))
    : cat ? ''
    : `<div class="fieldset"><label class="label" for="g-size">${tr('Rozmiar')}</label><input id="g-size" type="text" data-w="size" value="${esc(w.size)}"></div>`;
  // rok zakupu ma sens tylko dla własnego sprzętu — wypożyczony i tak jest z półki wypożyczalni
  const year = w.rental ? '' : `<div class="fieldset"><label class="label" for="g-year">${tr('Rok zakupu')}</label><input id="g-year" type="number" inputmode="numeric" data-w="year" value="${esc(w.year ?? '')}"></div>`;
  const foot = `<p class="small muted" style="margin:10px 0 0">${tr('Źródło wartości: {x}', {x: esc(frag(w.src || 'wpis własny'))})}</p>
    <div class="btnrow"><button class="primary sm" data-act="close-gear">${tr('Gotowe')}</button><button class="danger sm" data-act="del-gear" data-uid="${esc(w.uid)}">${tr('Usuń z szafy')}</button></div>`;
  // pozycja z katalogu ma parametry od producenta — zmieniać wolno tylko to, co zależy od egzemplarza
  if (cat) return `<div class="editor">${own}${size}${year}
    <p class="small muted" style="margin:10px 0 0">${tr('Grubość, krój i wyporność biorę z katalogu. Jeśli Twój sprzęt różni się od katalogowego, dodaj go jako pozycję własną.')}</p>${foot}</div>`;

  let h = `${own}${size}${year}<div class="grid2">
    <div class="f wide"><label for="g-name">${tr('Nazwa')}</label><input id="g-name" type="text" data-w="model" value="${esc(w.model)}"></div>`;
  if (NEO_CATS.includes(w.cat)) h += n('t', 'Grubość tułów (mm)', '0.5') + n('tl', 'Grubość kończyny (mm)', '0.5') + sel('cover', 'Krój', Object.entries(lbl().cover)) + chk('semi', 'Półsucha') + chk('hood', 'Kaptur');
  if (w.cat === 'dry') h += sel('shell', 'Materiał', [['trilam',tr('Trylaminat')],['membrane',tr('Membrana')],['crushed',tr('Neopren zgnieciony')],['neo',tr('Neopren')]]) + (p.shell === 'neo' ? n('t', 'Grubość (mm)', '0.5') : n('b', 'Wyporność (kg)'));
  if (w.cat === 'under') h += n('g', 'Gaz w skafandrze (kg wyporności)') + n('tmin', 'Komfort od (°C)', '1');
  if (w.cat === 'bcd' || w.cat === 'misc') h += n('b', 'Wyporność w wodzie (kg)');
  if (w.cat === 'fins') h += n('b', 'Wyporność pary w wodzie (kg)') + n('mass', 'Masa pary (g)', '10');
  if (w.cat === 'boots') h += n('mass', 'Masa pary (g)', '10');
  if (w.cat === 'wing') h += sel('plate', 'Płyta', [['alu',tr('Aluminium')],['steel',tr('Stal')],['soft',tr('Miękka / brak')]]);
  if (w.cat === 'tank' || w.cat === 'stage') h += n('vol', 'Pojemność (l)') + n('be', 'Wyporność pusta, morze (kg)') + n('vd', 'Objętość zewnętrzna (l)');
  return `<div class="editor">${h}</div>${foot}</div>`;
}

// Wyszukiwarka katalogu. W Szafie przegląda cały katalog z listą kategorii,
// w kreatorze dostaje gotowy zestaw kategorii i pokazuje tylko je — bez rozwijania listy.
function catalogPicker(cats){
  const q = ui.addQ.trim().toLowerCase();
  const inCat = c => cats ? cats.includes(c.cat) : (!ui.addCat || c.cat === ui.addCat);
  const found = CATALOG.filter(c => inCat(c) && (!q || (c.brand + ' ' + c.model + ' ' + frag(c.model) + ' ' + catOne(c.cat)).toLowerCase().includes(q)));
  return `<div class="${cats ? 'f' : 'grid2'}" style="margin-top:12px">${cats ? '' : '<div class="f">'}<label for="q">${tr('Szukaj')}</label><input id="q" type="search" placeholder="${tr('np. Zeos, Flexa, 15 l')}" value="${esc(ui.addQ)}" data-act="q">${cats ? '' : `</div>
      <div class="f"><label for="qc">${tr('Kategoria')}</label><select id="qc" data-act="qc"><option value="">${tr('Wszystkie')}</option>${CAT_ORDER.map(c => `<option value="${c}"${ui.addCat === c ? ' selected' : ''}>${catLabel(c)}</option>`).join('')}</select></div>`}</div>
      <div class="list" style="margin-top:8px">${found.slice(0, cats ? 99 : q || ui.addCat ? 60 : 10).map(c => `<div class="li"><div class="main"><div class="t">${esc(frag(c.brand === 'Ogólne' ? c.model : c.brand + ' ' + c.model))}</div><div class="s">${catOne(c.cat)}${c.p.mass ? ' · ' + c.p.mass + ' g' : ''}${c.cat === 'fins' ? ' · ' + sgn(c.p.b) + ' kg' : ''} · ${esc(frag(c.src))}</div></div>
        <div class="r"><button class="sm" data-act="add-cat" data-id="${esc(c.id)}">${tr('Dodaj')}</button></div></div>`).join('') || `<p class="muted small">${tr('Nic nie pasuje. Dodaj pozycję własną poniżej.')}</p>`}</div>
      ${!cats && !q && !ui.addCat && found.length > 10 ? `<p class="small muted" style="margin:8px 0 0">${tr('Pokazuję 10 z {n} — wpisz markę lub wybierz kategorię.', {n: found.length})}</p>` : ''}
      <div class="btnrow">${cats
        ? cats.map(c => `<button class="alt sm" data-act="add-custom" data-cat="${c}">${tr('Nie ma mojej — dodam własną')}${cats.length > 1 ? ': ' + catOne(c) : ''}</button>`).join('')
        : `<select id="custom-cat" aria-label="${tr('Kategoria pozycji własnej')}" style="width:auto">${CAT_ORDER.map(c => `<option value="${c}">${catOne(c)}</option>`).join('')}</select><button class="alt" data-act="add-custom">${tr('Dodaj pozycję własną')}</button>`}</div>`;
}
function viewGear(){
  const ctx = {rho:1.025, depth:5, reserve:50, year:new Date().getFullYear()};
  const groups = CAT_ORDER.map(c => ({c, items: P().wardrobe.filter(w => w.cat === c)})).filter(g => g.items.length);
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
      ${catalogPicker()}
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

  ${(IOS || ANDROID) && !standalone() ? `<section class="card"><h2>${tr('Na ekranie telefonu')}</h2>
    <p class="small muted" style="margin:8px 0 0">${tr('Aplikacja chodzi teraz w przeglądarce. Dodana do ekranu początkowego otwiera się jednym tapnięciem i działa bez internetu.')}</p>
    <div class="btnrow"><button class="sm" data-act="gate-show">${tr('Pokaż, jak dodać')}</button></div></section>` : ''}

  <section class="card"><h2>${tr('Kopia zapasowa')} <small>${tr('dane są tylko w tej przeglądarce')}</small></h2>
    ${memOnly ? `<div class="banner">${tr('Przeglądarka nie pozwala zapisywać danych — zmiany znikną po zamknięciu. Zapisz kopię do pliku.')}</div>` : ''}
    <p class="small muted" style="margin:8px 0 0">${tr('Kopia to jeden plik {x} z profilami, szafą, dziennikiem i akwenami. Wczytanie kopii zastępuje wszystkie dane w tej przeglądarce.', {x: '.json'})}</p>
    <div class="btnrow"><button class="sm primary" data-act="export-file">${tr('Zapisz kopię do pliku')}</button><button class="sm" data-act="import-file">${tr('Wczytaj kopię z pliku')}</button></div>
    <input id="bk-file" type="file" accept="application/json,.json" hidden>
    <div class="btnrow" style="margin-top:18px"><button class="danger sm" data-act="wipe">${tr(ui.confirmWipe ? 'Na pewno? Kliknij ponownie' : 'Wyczyść wszystkie dane')}</button><button class="sm ghost" data-act="seed">${tr('Wczytaj przykład')}</button></div>
  </section>
  <section class="card"><h2>${tr('Samouczek')}</h2>
    <p class="small muted" style="margin:8px 0 0">${tr('Krótkie oprowadzanie po ekranie Oblicz i pozostałych zakładkach — pokazane na żywo, na Twoich danych.')}</p>
    <div class="btnrow"><button class="sm" data-act="tour-start">${tr('Pokaż jeszcze raz')}</button></div></section>

  <p class="credit">${tr('Balast i Ocieplenie')} · © ${new Date().getFullYear()} Maciej Korzeniowski</p></div>`;
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
    <div class="btnrow"><button class="primary" data-act="wiz-next">${tr('Wypełnij profil')}</button></div>
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
  const i = Math.min(ui.wizCat, WIZ_CATS.length - 1), c = WIZ_CATS[i], last = i === WIZ_CATS.length - 1;
  const have = P().wardrobe.filter(w => c.cats.includes(w.cat));
  const groups = CAT_ORDER.map(k => ({k, items: P().wardrobe.filter(w => w.cat === k)})).filter(g => g.items.length);
  return `<div class="stack">
    <section class="card">
      ${wizHead(4, tr('Twój sprzęt'), tr('Przejdziemy przez kategorie po kolei. Dodaj to, w czym nurkujesz — resztę uzupełnisz później w Szafie.'))}
      <div class="wiz-top" style="margin-top:16px"><span class="label">${tr('Sprzęt {n} z {m}', {n: i + 1, m: WIZ_CATS.length})}</span>
        <div class="wiz-bar"><i style="width:${((i + 1) / WIZ_CATS.length * 100).toFixed(0)}%"></i></div></div>
      <h3 style="font-size:20px">${tr(c.label)}${c.need ? ` <small class="req">${tr('wymagane')}</small>` : ''}</h3>
      <p class="small muted" style="margin:6px 0 0">${tr(c.hint)}</p>
      ${have.length ? `<div class="chips" style="margin-top:10px">${have.map(w => `<span class="chip" aria-pressed="true">${esc(nm(w))}${w.size ? ' · ' + esc(w.size) : ''}</span>`).join('')}</div>` : ''}
      <div class="btnrow"><button class="primary" data-act="wiz-cat-next">${tr(last ? 'Gotowe' : have.length || c.need ? 'Dalej' : 'Pomiń')}</button>
        <button class="ghost" data-act="wiz-cat-back">${tr('Wstecz')}</button></div>
      ${c.need && !have.length ? `<p class="small muted" style="margin:8px 0 0">${tr('Bez tego nie policzę ołowiu — wybierz jedną pozycję.')}</p>` : ''}
      ${catalogPicker(c.cats)}
    </section>
    ${groups.length ? `<section class="card"><h2>${tr('Moja szafa')} <small>${tr('{n} pozycji', {n: P().wardrobe.length})}</small></h2>
      ${groups.map(g => `<div class="group" style="margin-top:12px"><div class="label">${catLabel(g.k)}</div><div class="list">${g.items.map(w => `<div class="li"><div class="main"><div class="t">${esc(nm(w))}</div>
        <div class="s">${[w.rental && tr('wypożyczony'), w.size && tr('rozm. {x}', {x: w.size})].filter(Boolean).map(esc).join(' · ') || tr('rozmiar i własność ustawisz w edytorze')}</div></div>
        <div class="r"><button class="sm ghost" data-act="edit-gear" data-uid="${esc(w.uid)}">${tr('Edytuj')}</button></div></div>
        ${ui.editGear === w.uid ? paramEditor(w) : ''}`).join('')}</div></div>`).join('')}
    </section>` : ''}
  </div>`;
}
// Sprzęt zbieramy kategoriami, w kolejności, w jakiej nurek się ubiera. Obowiązkowe są tylko te,
// bez których nie ma czego liczyć: coś, w czym nurkujesz, i to, co trzyma powietrze na plecach.
// Butla obowiązkowa nie jest — na ekranie Oblicz wybiera się ją jednym tapnięciem ze standardowych.
const WIZ_CATS = [
  {cats:['wetsuit','dry'], label:'Skafander', need:true, hint:'Pianka albo suchy — to on najmocniej zmienia ołów.'},
  {cats:['over','under'], label:'Ocieplacze', hint:'Kamizelka pod piankę albo ocieplacz pod suchy skafander. Nie masz — pomiń.'},
  {cats:['hood','gloves','boots'], label:'Kaptur, rękawice, buty', hint:'Drobiazgi, które dokładają trochę wyporności i sporo komfortu.'},
  {cats:['bcd','wing'], label:'Kamizelka albo skrzydło', need:true, hint:'Jacket, skrzydło z płytą — wybierz to, na czym nurkujesz.'},
  {cats:['fins'], label:'Płetwy', hint:'Gumowe ciągną w dół mocniej niż plastikowe.'},
  {cats:['tank','stage'], label:'Butla', hint:'Możesz pominąć: na ekranie Oblicz wybierzesz butlę jednym tapnięciem spośród standardowych. Stage dokłada się do podstawowej, nie zamiast niej.'},
  {cats:['misc'], label:'Reszta', hint:'Latarka, aparat. Automat masz już w szafie.'}
];
const wizMissing = () => WIZ_CATS.filter(c => c.need && !P().wardrobe.some(w => c.cats.includes(w.cat)));

function wizDone(){
  const miss = wizMissing();
  if (miss.length) return toast(tr('Dodaj jeszcze: {x}', {x: miss.map(c => tr(c.label)).join(', ')}));
  // zestaw na start: to, co nurek właśnie zadeklarował — toggleItem pilnuje, żeby nie weszły dwie pianki
  P().plan.items = P().wardrobe.reduce((list, w) => toggleItem(list, w.uid), []);
  ui.editGear = null; ui.addQ = '';
  finishWizard('calc');
}
function finishWizard(goTab, msg){
  P().onboarded = true; ui.wiz = 0; tab = goTab || 'calc';
  toast(msg || tr('Gotowe. Wszystko zmienisz w Profilu i Szafie.'));
  commit(); window.scrollTo(0, 0);
  if (!S.tourDone && !gateOn()) setTimeout(tourStart, 400);   // po kreatorze pokazujemy aplikację na żywo
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
  const vlab = p => { const n = p.n || 1, v = p.vol / n; return (n > 1 ? n + ' × ' : '') + fmt(v, v % 1 ? 1 : 0) + ' l'; };
  const short = it => it.cat === 'tank' || it.cat === 'stage'
    ? (it.cat === 'stage' ? 'Stage ' : '') + (it.p.mat === 'alu' ? 'Alu ' : tr('Stal') + ' ') + vlab(it.p)
    : nm(it).replace(/ \((wypożyczon[ay]|własny|rented|own)\)/, '');
  const order = ['wetsuit','over','hood','dry','under','bcd','wing','tank','stage','fins'];
  const shown = items.filter(i => order.includes(i.cat)).sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
  return `<div class="sb" role="status" aria-live="polite">
    <div class="sb-lead"><div class="sb-head"><span class="label">${tr('Ołów')}</span>
        ${iss.length ? '' : `<button class="sb-q" data-act="explain" aria-expanded="${!!ui.explain}" aria-controls="lead-detail" title="${tr('Wyjaśnij')}" aria-label="${tr('Wyjaśnij')}">${ICON.ask}</button>`}</div>
      ${iss.length ? `<div class="sb-big none">—</div><div class="range">${tr('brak danych')}</div>`
        : `<div class="sb-big">${fmt(p.rec)}<small>kg</small></div><div class="range">${fmt(Math.max(0, p.lo))}–${fmt(p.hi)}</div>`}</div>
    <div class="sb-set"><div class="label">${tr('Zestaw')}</div>
      <div class="sb-items">${shown.map(i => esc(short(i))).join(' · ') || tr('Nic nie wybrano')}</div>
      <div class="sb-therm"><span>${tr('woda')} <b class="mono">${fmt(tBreak(pl).t)}°</b> · ${tr('komfort od')} <b class="mono">${fmt(th.comfort - delta)}°</b></span>${thermalVerdict(tef - th.comfort)}</div>
      ${iss.length ? `<div class="sb-warn">${tr('Dodaj {x} — bez tego nie policzę ołowiu.', {x: issAcc(iss)})}</div>` : ''}</div></div>`;
}
function render(){
  const ae = document.activeElement, fid = ae && ae.id && view.contains(ae) ? ae.id : null;
  let sel = null; try { sel = fid && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null; } catch(_){}
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-t]').forEach(e => e.textContent = tr(e.dataset.t));
  $('#lang').textContent = LANG === 'pl' ? 'EN' : 'PL';
  $('#lang').setAttribute('aria-label', LANG === 'pl' ? 'Switch to English' : 'Przełącz na polski');
  const gate = gateOn(), wiz = !gate && wizardOn();
  $('#summary').innerHTML = !gate && !wiz && tab === 'calc' ? summaryHtml() : '';
  document.querySelector('nav.tabs').hidden = gate || wiz;
  document.querySelectorAll('nav.tabs button').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#who').innerHTML = whoHtml(); $('#who').title = P().profile.name || '';
  const f = gate ? viewGate : wiz ? viewWizard : {calc:viewCalc, log:viewLog, gear:viewGear, sites:viewSites, profile:viewProfile}[tab];
  view.innerHTML = f();
  if (fid){ const el = document.getElementById(fid); if (el){ el.focus({preventScroll:true}); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch(_){} } }
}

// ---------- samouczek ----------
// Pokazujemy prawdziwe elementy na żywym ekranie: podświetlenie wycina kształt celu
// z przyciemnionego tła, a dymek staje nad nim albo pod nim. Żadnych zrzutów ekranu —
// nurek od razu widzi to, czego potem użyje. Raz po kreatorze (S.tourDone), potem z Profilu.
const TOUR = [
  {tab:'calc', sel:'#summary .sb', title:'Tu jest wynik', text:'Pasek trzyma się góry ekranu i zawsze pokazuje ołów dla bieżącego zestawu. Znak zapytania obok liczby rozwija rozbicie: co ciągnie w dół, co unosi.'},
  {tab:'calc', sel:'#plan-card', title:'Gdzie i kiedy', text:'Akwen i miesiąc wystarczą — temperaturę dna podpowie akwen, a Ty poprawisz ją, jeśli znasz aktualną. Głębokość i temperaturę zmieniasz przyciskami, bez klawiatury.'},
  {tab:'calc', sel:'#thermal-card', title:'Czy nie zmarzniesz', text:'Aplikacja porównuje komfort Twojego zestawu z temperaturą nurkowania i mówi wprost: wystarczy, na granicy czy za zimno. Niżej proponuje najlżejsze zestawy z szafy, które dadzą radę.'},
  {tab:'calc', sel:'#set-card', title:'Co masz na sobie', text:'Tapnij, żeby włączyć albo wyłączyć element z zestawu — ołów przeliczy się od razu. Butlę możesz wziąć ze standardowych, bez wstawiania jej do szafy.'},
  {tab:'calc', sel:'[data-act="log-from-plan"]', title:'Najważniejszy przycisk', text:'Po wyjściu z wody zapisz nurkowanie i oceń dwie rzeczy: czy ołowiu było za dużo, za mało czy w sam raz, i czy w tym zestawie było Ci ciepło. Oceny wiążą się z konkretnym sprzętem, więc model uczy się, ile ołowiu potrzebujesz Ty i która pianka wystarcza Tobie — bez nich zostaje przy fizyce dla przeciętnego nurka.'},
  {tab:'log', sel:'[data-act="import-dive"]', title:'Nurkowanie z komputera', text:'Plik z aplikacji Suunto wczyta datę, głębokość, czas i temperatury — nie trzeba niczego przepisywać. Zostaje zaznaczyć sprzęt, wpisać ołów i ocenić komfort, bo tego żaden komputer nie zapisuje, a to właśnie z tego uczy się model.'},
  {sel:'nav.tabs', title:'Reszta aplikacji', text:'Dziennik to historia z ocenami, Szafa — Twój sprzęt, Akweny — temperatury i gęstość wody, Profil — dane ciała, kopia zapasowa i ten samouczek, gdybyś chciał go powtórzyć.'}
];
let tourStep = -1;
const tourOn = () => tourStep >= 0;

function tourStart(){
  tourStep = 0; ui.editGear = ui.quick = null;
  if (tab !== 'calc'){ tab = 'calc'; render(); }
  tourShow();
}
function tourShow(){
  const st = TOUR[tourStep];
  if (!st) return tourEnd();
  if (st.tab && tab !== st.tab){ tab = st.tab; render(); }
  const el = st.sel && document.querySelector(st.sel);
  if (!el) return tourStep < TOUR.length - 1 ? (tourStep++, tourShow()) : tourEnd();
  const fixed = getComputedStyle(el).position === 'fixed' || el.closest('.pin, nav.tabs');
  if (!fixed) el.scrollIntoView({block: 'center'});
  requestAnimationFrame(() => tourPaint(st, el));
}
// Rysujemy po układzie strony, więc pozycje bierzemy z getBoundingClientRect() przy każdym kroku
// i przy każdej zmianie rozmiaru albo przewinięciu — inaczej dymek zostaje tam, gdzie celu już nie ma.
function tourPaint(st, el){
  const box = document.getElementById('tour');
  const r = el.getBoundingClientRect(), pad = 6;
  const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
  const w = Math.min(window.innerWidth - 8, r.width + pad * 2), h = r.height + pad * 2;
  const last = tourStep === TOUR.length - 1;
  box.hidden = false;
  box.innerHTML = `<div class="tour-hole" style="top:${top}px;left:${left}px;width:${w}px;height:${h}px"></div>
    <div class="tour-box" role="dialog" aria-modal="true" aria-label="${tr('Samouczek')}">
      <h3>${tr(st.title)}</h3><p>${tr(st.text)}</p>
      <div class="btnrow"><button class="primary sm" data-act="tour-next">${tr(last ? 'Zaczynamy' : 'Dalej')}</button>
        ${last ? '' : `<button class="ghost sm" data-act="tour-end">${tr('Pomiń')}</button>`}
        <span class="tour-step">${tourStep + 1}/${TOUR.length}</span></div>
    </div>`;
  const tip = box.querySelector('.tour-box'), th = tip.offsetHeight, tw = tip.offsetWidth;
  const nav = document.querySelector('nav.tabs');
  const navH = nav && !nav.hidden ? nav.offsetHeight : 0;
  // Cel wyższy niż pół ekranu i tak nie zmieści dymka obok siebie — wtedy dymek siada nad
  // nawigacją, żeby nie zasłaniał tego, o czym właśnie opowiada.
  const tall = h > window.innerHeight * 0.5;
  const below = top + h + 10 + th < window.innerHeight - navH;
  tip.style.top = (tall ? Math.max(8, window.innerHeight - navH - th - 12)
    : below ? top + h + 10 : Math.max(8, top - th - 10)) + 'px';
  tip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px';
}
function tourEnd(){
  tourStep = -1;
  const box = document.getElementById('tour');
  box.hidden = true; box.innerHTML = '';
  if (!S.tourDone){ S.tourDone = true; save(); }
}
// Dymek żyje poza #view, więc nie łapie go główny nasłuch kliknięć — ma własny.
$('#tour').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'tour-next'){ tourStep++; return tourShow(); }
  if (b.dataset.act === 'tour-end') return tourEnd();
});
addEventListener('resize', () => { if (tourOn()) tourShow(); });
addEventListener('keydown', e => { if (tourOn() && e.key === 'Escape') tourEnd(); });

// ---------- zaproszenie do instalacji ----------
// Na telefonie w przeglądarce pokazujemy, jak dodać aplikację do ekranu początkowego:
// zainstalowana działa offline na łodzi i nie gubi się w kartach. Bramka jest miękka —
// „Użyję w przeglądarce" wyłącza ją na stałe (S.installSkip).
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ANDROID = /Android/.test(navigator.userAgent);
// przeglądarki wbudowane w aplikacje nie mają „dodaj do ekranu" — tam trzeba najpierw wyjść do Safari/Chrome
const INAPP = /FBAN|FBAV|Instagram|Messenger|LinkedIn|Twitter|Snapchat|Pinterest|TikTok|MicroMessenger/.test(navigator.userAgent);
const standalone = () => ['standalone','fullscreen','minimal-ui'].some(m => matchMedia('(display-mode: ' + m + ')').matches) || navigator.standalone === true;
let installPrompt = null, installedApp = false, installedNow = false;
// Czy aplikacja stoi już na ekranie telefonu? Na Androidzie mówi to wprost przeglądarka
// (getInstalledRelatedApps, Chrome 84+); na iOS żadne API tego nie zdradza, więc zostaje poszlaka:
// instrukcję instalacji ktoś tu już widział, a w tej przeglądarce nie ma żadnych danych.
let gateSeenBefore = false;
function checkInstalled(){
  if (!navigator.getInstalledRelatedApps) return;
  navigator.getInstalledRelatedApps().then(list => {
    if (list && list.length){ installedApp = true; render(); }
  }, () => {});
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (gateOn()) render(); });
window.addEventListener('appinstalled', () => { installPrompt = null; installedNow = true; render(); });
const gateOn = () => (IOS || ANDROID) && !standalone() && !S.installSkip;
// czy nurek ma już coś do stracenia — na iOS aplikacja z ekranu ma osobną pamięć niż Safari
const hasData = () => P().onboarded || P().dives.length || P().wardrobe.length > 1 || S.profiles.length > 1;

const homeIcon = () => `<figure class="home-icon"><img src="icons/icon-192.png" alt="" width="64" height="64"><figcaption>Balast</figcaption></figure>
  <p class="small muted" style="text-align:center;margin:6px 0 0">${tr('Tej ikony szukaj na ekranie telefonu.')}</p>`;

function viewGate(){
  // kroki to nasz własny HTML (z ikoną Udostępnij), więc nie przechodzą przez esc()
  const steps = INAPP
    ? [tr('Tapnij menu tej przeglądarki i wybierz {x}', {x: IOS ? tr('„Otwórz w Safari”') : tr('„Otwórz w Chrome”')}),
       tr('Tam otwórz ten sam adres i dodaj skrót do ekranu')]
    : IOS
      ? [ICON.share + tr('Tapnij Udostępnij na dolnym pasku Safari'),
         tr('Przewiń listę i wybierz „Do ekranu początkowego”'),
         tr('Potwierdź „Dodaj” — ikona stanie na ekranie telefonu')]
      : [tr('Otwórz menu przeglądarki (⋮)'),
         tr('Wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”'),
         tr('Potwierdź — ikona stanie na ekranie telefonu')];
  if (installedNow) return `<div class="stack">
    <section class="card">
      <h2>${tr('Gotowe — ikona jest na ekranie')}</h2>
      <p style="margin:10px 0 0">${tr('Zamknij tę kartę i otwieraj aplikację z ekranu telefonu: startuje jednym tapnięciem, działa bez internetu i nie ginie wśród kart przeglądarki.')}</p>
      ${homeIcon()}
      <div class="btnrow" style="margin-top:16px"><button class="ghost sm" data-act="gate-skip">${tr('Zostanę w przeglądarce')}</button></div>
    </section>
  </div>`;
  // ktoś, kto ma już ikonę na ekranie, a wszedł z przeglądarki, przede wszystkim powinien wrócić do aplikacji
  if ((installedApp || (gateSeenBefore && !hasData())) && !ui.gateSteps) return `<div class="stack">
    <section class="card">
      <h2>${tr('Otwórz z ekranu telefonu')}</h2>
      <p style="margin:10px 0 0">${tr(installedApp ? 'Ta aplikacja jest już zainstalowana na tym telefonie.' : 'Wygląda na to, że masz ją już na ekranie telefonu: instrukcja instalacji pojawiała się tu wcześniej, a w tej przeglądarce nie ma żadnych danych.')}</p>
      <p style="margin:10px 0 0">${tr(IOS
        ? 'Na iPhonie wersja z ekranu początkowego i ta w Safari mają osobne dane: nurkowania, szafa i profil wpisane w aplikacji nie są tu widoczne, a to, co wpiszesz tutaj, nie trafi do aplikacji. Zamknij tę kartę i otwórz ikonę z ekranu.'
        : 'Aplikacja z ekranu otwiera się jednym tapnięciem i działa bez internetu — na łodzi to bywa jedyna różnica między policzeniem balastu a nie. Dane masz te same, więc niczego nie stracisz.')}</p>
      ${homeIcon()}
      <div class="btnrow" style="margin-top:16px"><button class="sm" data-act="gate-steps">${tr('Nie mam jej — pokaż, jak dodać')}</button>
        <button class="ghost sm" data-act="gate-skip">${tr('Użyję w przeglądarce')}</button></div>
    </section>
  </div>`;
  return `<div class="stack">
    <section class="card">
      <h2>${tr('Dodaj do ekranu telefonu')}</h2>
      <p style="margin:10px 0 0">${tr('Balast liczy się na łodzi i nad wodą, gdzie zasięgu zwykle nie ma. Dodana do ekranu aplikacja otwiera się jednym tapnięciem, działa bez internetu i nie ginie wśród kart przeglądarki.')}</p>
      ${installPrompt ? `<div class="btnrow" style="margin-top:14px"><button class="primary" data-act="install">${tr('Zainstaluj')}</button></div>` : ''}
      <ol class="steps">${steps.map(x => `<li>${x}</li>`).join('')}</ol>
      ${IOS && hasData() ? `<div class="opt" style="grid-template-columns:1fr;margin-top:14px">
        <div class="items">${tr('Najpierw zrób kopię zapasową')}</div>
        <div class="desc">${tr('Na iPhonie aplikacja z ekranu początkowego ma osobną pamięć niż Safari, więc dane wpisane tutaj nie przejdą same. Zapisz plik i wczytaj go w Profilu zaraz po instalacji.')}</div>
        <div class="btnrow" style="margin-top:6px"><button class="sm" data-act="export-file">${tr('Zapisz kopię zapasową')}</button></div></div>` : ''}
      ${INAPP ? '' : homeIcon() + `<p class="small muted" style="margin:8px 0 0">${tr('Gdy ikona stanie na ekranie, zamknij tę kartę i otwieraj aplikację stamtąd — dopiero wtedy działa bez internetu.')}</p>`}
      <div class="btnrow" style="margin-top:16px"><button class="ghost sm" data-act="gate-skip">${tr('Użyję w przeglądarce')}</button></div>
    </section>
  </div>`;
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
  return Object.assign(JSON.parse(JSON.stringify(P().plan)), {id: newId('d'), lead: setIssues(resolveItems(P().plan.items, P())).length ? '' : p.rec, leadFb: null, leadAdj: 1, thermal: null, note: '', date: today()});                    // plan trzyma już tylko miesiąc; dzień poprawisz w formularzu
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
  const b = e.target.closest('[data-act="cal"],[data-act="step"],[data-act="plan-info"],[data-act="therm-info"]'); if (!b) return;
  e.preventDefault();                                   // bez blur → bez przebudowy widoku w trakcie dotknięcia
  const ae = document.activeElement;
  if (ae && ae.dataset && ae.dataset.f && ae !== document.getElementById(b.dataset.t)) applyPlanField(ae, false);
  if (b.dataset.act === 'cal') return openDatePicker(b.dataset.pre);
  if (b.dataset.act === 'plan-info'){ ui.planInfo = !ui.planInfo; return render(); }
  if (b.dataset.act === 'therm-info'){ ui.thermInfo = !ui.thermInfo; return render(); }
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
    if (ui.wiz === 3){ ui.wizCat = 0; ui.addQ = ''; }           // sprzęt zaczynamy od pierwszej kategorii
    ui.wiz = Math.min(WIZ_STEPS, ui.wiz + 1); render(); return window.scrollTo(0, 0); }
  if (a === 'wiz-cat-next'){
    const c = WIZ_CATS[Math.min(ui.wizCat, WIZ_CATS.length - 1)];
    if (c.need && !P().wardrobe.some(w => c.cats.includes(w.cat))) return toast(tr('Wybierz jedną pozycję — bez tego nie policzę ołowiu.'));
    if (ui.wizCat >= WIZ_CATS.length - 1) return wizDone();
    ui.wizCat++; ui.addQ = ''; ui.editGear = null; render(); return window.scrollTo(0, 0);
  }
  if (a === 'wiz-cat-back'){
    if (ui.wizCat <= 0){ ui.wiz = 3; render(); return window.scrollTo(0, 0); }
    ui.wizCat--; ui.addQ = ''; ui.editGear = null; render(); return window.scrollTo(0, 0);
  }
  if (a === 'wiz-back'){ ui.wiz = Math.max(0, ui.wiz - 1); render(); return window.scrollTo(0, 0); }
  if (a === 'wiz-done') return wizDone();
  if (a === 'set-month'){
    const pl = P().plan, y = +String(pl.date).slice(0, 4) || new Date().getFullYear();
    pl.date = y + '-' + String(+b.dataset.v + 1).padStart(2, '0') + '-01';
    fillTemps(pl);
    return commit();
  }
  if (a === 'tour-start') return tourStart();
  if (a === 'gate-skip'){ S.installSkip = true; return commit(); }
  if (a === 'gate-steps'){ ui.gateSteps = true; return render(); }
  if (a === 'gate-show'){ delete S.installSkip; ui.gateSteps = false; window.scrollTo(0, 0); return commit(); }
  if (a === 'install'){
    if (!installPrompt) return;
    const pr = installPrompt; installPrompt = null;
    pr.prompt(); pr.userChoice.then(r => { if (r.outcome !== 'accepted'){ installPrompt = pr; render(); } });
    return;
  }
  if (a === 'geo-on'){ S.geo = 'on'; save(); render(); return locateSite(false); }
  if (a === 'geo-off'){ S.geo = 'off'; save(); return render(); }
  if (a === 'geo-now') return locateSite(false);
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
  if (a === 'gear-own' || a === 'gear-size'){
    const w = P().wardrobe.find(x => x.uid === ui.editGear); if (!w) return;
    const v = b.dataset.v;
    if (a === 'gear-size') w.size = w.size === v ? '' : v;
    else {
      const rental = v === '1';
      if (rental === !!w.rental) return;
      w.rental = rental;
      w.year = rental ? null : new Date().getFullYear();   // rok zakupu dotyczy tylko własnego sprzętu
    }
    return commit();
  }
  if (a === 'quick-open'){ ui.quick = ui.quick ? null : {q:'', cat:'', kind:'bought'}; ui.editGear = null; return render(); }
  if (a === 'quick-kind'){ ui.quick.kind = b.dataset.v; return render(); }
  if (a === 'quick-add'){ return quickItem(fromCat(b.dataset.id, {uid: newId(b.dataset.id)})); }
  if (a === 'quick-own'){ const cat = $('#qq-own').value; return quickItem({uid: newId('own'), catId: null, cat, brand: 'Własne', model: catOne(cat), size: '', year: null, p: JSON.parse(JSON.stringify(OWN_DEFAULTS[cat])), src: 'wpis własny'}); }
  if (a === 'del-gear'){ const u = b.dataset.uid; P().wardrobe = P().wardrobe.filter(w => w.uid !== u); P().plan.items = P().plan.items.filter(x => x !== u); ui.editGear = null; toast(tr('Usunięto z szafy')); return commit(); }
  if (a === 'add-cat'){
    const w = fromCat(b.dataset.id, {uid: newId(b.dataset.id), year: new Date().getFullYear()});
    P().wardrobe.push(w);
    ui.editGear = wizardOn() ? null : w.uid;          // w kreatorze nie przerywamy przechodzenia kategorii
    toast(tr(wizardOn() ? 'Dodano do szafy' : 'Dodano — ustaw rozmiar'));
    return commit();
  }
  if (a === 'add-custom'){
    const cat = b.dataset.cat || $('#custom-cat').value;
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
    ui.confirmWipe = false;
    S = Object.assign(freshState(), {lang: LANG});
    const d = P();
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
  draft.imported = true;
  draft.date = d.date; draft.depth = d.depth; draft.time = d.time;
  if (d.tSurf != null){ draft.tSurf = d.tSurf; draft.tMeasured = true; }
  if (d.tBottom != null){ draft.tBottom = d.tBottom; draft.tMeasured = true; }
  let site = null;
  if (d.gps){
    draft.gps = d.gps;
    site = matchSite(d.gps, S.sites);
    if (site){ draft.siteId = site.id; draft.siteFromGps = site.km; fillTemps(draft); }   // temperatury chronione znacznikiem tMeasured
  }
  if (d.note) draft.note = d.note;
  draft.nDay = P().dives.filter(x => x.date === d.date).length + 1;
  const dup = P().dives.some(x => x.date === d.date && Math.abs((+x.depth || 0) - d.depth) < 0.6 && Math.abs((+x.time || 0) - d.time) < 3);
  ui.draft = draft; tab = 'log'; ui.delDiver = null; render(); window.scrollTo(0, 0);
  toast(dup ? tr('Wczytano, ale podobne nurkowanie już jest w dzienniku')
    : site ? tr('Wczytano: {s}, {d} m, {t} min, {a}–{b} °C. Dopisz ołów i ocenę.', {s: siteName(siteOf(site.id)), d: fmt(d.depth), t: d.time, a: fmt(d.tBottom ?? 0), b: fmt(d.tSurf ?? 0)})
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
if (gateOn()){
  gateSeenBefore = !!S.gateSeen;          // poszlaka działa dopiero przy kolejnym wejściu
  if (!S.gateSeen){ S.gateSeen = true; save(); }
  else render();
  checkInstalled();
}
if (S.geo === 'on' && !gateOn()) locateSite(true);
