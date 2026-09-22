// ===== Aplikacja =====
const KEY = 'balast-ocieplenie.v1';
let S, L, T, memOnly = false, tab = 'calc', ui = {draft:null, editGear:null, editSite:null, addQ:'', addCat:'', confirmWipe:false, quick:null, siteQ:null, hl:0};
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

function load(){
  try { const raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : seedState(); }
  catch(e){ S = seedState(); memOnly = true; }
  if (!S || S.v !== 1) S = seedState();
  if (S.profile.divesBefore == null) S.profile.divesBefore = Math.max(0, (+S.profile.dives || 0) - S.dives.length);
  S.wardrobe.forEach(w => { if (w.rental == null && /wypożycz/i.test(w.model)) w.rental = true; });
  S.wardrobe.forEach(w => { if (w.catId && /^misc-fins/.test(w.catId)) w.cat = 'fins'; });
  LANG = S.lang === 'en' ? 'en' : 'pl';
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); memOnly = false; } catch(e){ memOnly = true; } }
function learnState(){ return Object.assign({}, S, {dives: S.dives.filter(d => !S.learnSince || d.date >= S.learnSince)}); }
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
function fillTemps(pl){ const s = siteOf(pl.siteId), m = monthOf(pl.date); pl.tSurf = s.ts[m]; pl.tBottom = s.tb[m]; }
const EXPO = ['wetsuit','over','hood','dry','under'];
const SINGLE = {wetsuit:['wetsuit'], dry:['dry'], under:['under'], bcd:['bcd','wing'], wing:['bcd','wing'], tank:['tank'], fins:['fins']};
const targetOf = pre => pre === 'd-' && ui.draft ? ui.draft : S.plan;

function toggleItem(list, uid){
  const it = S.wardrobe.find(w => w.uid === uid); if (!it) return list;
  if (list.includes(uid)) return list.filter(u => u !== uid);
  let out = list.slice();
  const drop = cats => { out = out.filter(u => { const w = S.wardrobe.find(x => x.uid === u); return w && !cats.includes(w.cat); }); };
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

// ---------- komponenty ----------
function chipsFor(selected, act){
  const groups = CAT_ORDER.map(c => ({c, items: S.wardrobe.filter(w => w.cat === c)})).filter(g => g.items.length);
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
function planFields(pl, pre){
  return `<div class="grid2">
    ${siteCombo(pl, pre)}
    <div class="f wide"><label for="${pre}date">${tr('Data')}</label><div class="datebox">
      <input id="${pre}date" type="text" inputmode="numeric" maxlength="10" placeholder="${tr('rrrr-mm-dd')}" data-f="date" data-date="1" value="${esc(pl.date)}">
      <button type="button" class="calbtn" data-act="cal" data-pre="${pre}" aria-label="${tr('Kalendarz')}"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></button>
      <input type="date" class="datepick" id="${pre}datepick" data-pick="${pre}" tabindex="-1" aria-hidden="true" value="${esc(validDate(pl.date) ? pl.date : '')}"></div></div>
    <div class="f"><label for="${pre}depth">${tr('Głębokość maks. (m)')}</label><input id="${pre}depth" type="number" inputmode="decimal" data-f="depth" value="${esc(pl.depth)}"></div>
    <div class="f"><label for="${pre}time">${tr('Czas (min)')}</label><input id="${pre}time" type="number" inputmode="numeric" data-f="time" value="${esc(pl.time)}"></div>
    <div class="f"><label for="${pre}nday">${tr('Nurkowanie dnia nr')}</label><input id="${pre}nday" type="number" inputmode="numeric" data-f="nDay" value="${esc(pl.nDay)}"></div>
    <div class="f"><label for="${pre}ts">${tr('Temp. powierzchnia (°C)')}</label><input id="${pre}ts" type="number" inputmode="decimal" data-f="tSurf" value="${esc(pl.tSurf)}"></div>
    <div class="f"><label for="${pre}tb">${tr('Temp. na dnie (°C)')}</label><input id="${pre}tb" type="number" inputmode="decimal" data-f="tBottom" value="${esc(pl.tBottom)}"></div>
    <div class="f"><label for="${pre}res">${tr('Rezerwa w butli (bar)')}</label><input id="${pre}res" type="number" inputmode="numeric" data-f="reserve" value="${esc(pl.reserve)}"></div>
  </div>`;
}
function compLabel(r){
  if (r.key === 'tissue') return tr('Ciało (tkanki)');
  if (r.key === 'lungs') return tr('Płuca, pół oddechu');
  if (r.key === 'exp') return tr('Doświadczenie ({n} nurk.)', {n: L.total});
  if (r.key === 'theta0') return tr('Korekta osobista (nauka)');
  const uid = r.key.startsWith('th-') ? r.key.slice(3) : r.key, w = S.wardrobe.find(x => x.uid === uid);
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
  return m >= 1 ? `<span class="pill good">${tr('Wystarczy')}</span>` : m >= 0 ? `<span class="pill warn">${tr('Na granicy')}</span>` : `<span class="pill bad">${tr('Za zimno')}</span>`;
}
function advisor(pl, curItems){
  const base = curItems.filter(i => !EXPO.includes(i.cat));
  const own = S.wardrobe.filter(w => !w.rental), of = c => own.filter(w => w.cat === c);
  const W = of('wetsuit'), O = of('over'), H = of('hood'), D = of('dry'), U = of('under');
  const combos = [];
  for (const w of W) for (const o of [null, ...O]) for (const h of [null, ...H]){
    if (h && (o && o.p.hood || w.p.hood)) continue;
    combos.push([w, o, h].filter(Boolean));
  }
  for (const o of O) if (!W.length) combos.push([o]);
  for (const d of D) for (const u of [null, ...U]) combos.push([d, u].filter(Boolean));
  const delta = (+S.profile.coldTol || 0) + T.delta, tef = tEf(pl, delta), ctx = planCtx(pl);  // porównanie: tWater + delta vs komfort ⇔ tWater vs komfort − delta
  const res = combos.map(c => {
    const th = thermalOfSet(c, pl.depth), items = base.concat(c);
    return {c, th, m: tef - th.comfort, lead: predictLead(items, S, ctx, L).rec};
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
  S.wardrobe.push(w); S.plan.items = toggleItem(S.plan.items, w.uid);
  ui.editGear = w.uid; ui.quick = null;
  toast(tr(rental ? 'Dodano wypożyczony sprzęt i włączono do zestawu' : 'Dodano do szafy i do zestawu'));
  commit();
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.some(y => y.uid === x.uid));

// ---------- widoki ----------
function viewCalc(){
  const pl = S.plan, items = resolveItems(pl.items, S), ctx = planCtx(pl), iss = setIssues(items);
  const p = predictLead(items, S, ctx, L);
  const delta = (+S.profile.coldTol || 0) + T.delta, tef = tEf(pl, delta), th = thermalOfSet(items, pl.depth), m = tef - th.comfort;
  const tb = tBreak(pl);
  const adv = advisor(pl, items), site = siteOf(pl.siteId), curExpo = items.filter(i => EXPO.includes(i.cat));
  return `<div class="stack">
  <section class="card"><h2>${tr('Balast')} <small>${tr('zakres 80%: {a}–{b} kg', {a: fmt(Math.max(0, p.lo)), b: fmt(p.hi)})}</small></h2>
    <div class="small muted">${esc(siteName(site))} · ${L.n ? tr('nauka z {n} nurk. w dzienniku', {n: L.n}) : tr('bez nauki, tylko fizyka')} · ${tr('doświadczenie: {n} nurk. ({l})', {n: L.total, l: tr(L.exp.label)})}</div>
    ${scaleHtml(p)}
    ${iss.length ? `<div class="banner" style="margin-top:28px">${tr('Zestaw nie ma {x} — wynik jest niepełny.', {x: iss.join(tr(' ani '))})}</div>` : ''}
    <div class="note">${esc(distribution(p, items))} ${tr('Przy pierwszym nurkowaniu w tej konfiguracji zrób kontrolę na 5 m z rezerwą i pustą kamizelką.')}</div>
  </section>

  <section class="card"><h2>${tr('Ocieplenie')} <small>${tr('temperatura nurkowania {t} °C', {t: fmt(tb.t)})}</small></h2>
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
  </section>

  <section class="card"><h2>${tr('Nurkowanie')}</h2>${planFields(pl, 'p-')}
    <p class="small muted" style="margin:10px 0 0">${tr('Temperatury podpowiada akwen dla wybranego miesiąca; wpisz własne, jeśli znasz aktualne.')}</p></section>

  <section class="card"><div class="therm-head" style="margin-bottom:10px"><h2 style="margin:0">${tr('Zestaw')}</h2>
    <button class="sm${ui.quick ? ' ghost' : ''}" data-act="quick-open" aria-expanded="${!!ui.quick}">${tr(ui.quick ? 'Zamknij' : '+ Dodaj sprzęt')}</button></div>
    ${ui.quick ? quickAdd() : ''}
    ${ui.editGear && S.wardrobe.some(w => w.uid === ui.editGear) ? `<div class="label" style="margin-top:4px">${tr('Dodane: {x}', {x: esc(nm(S.wardrobe.find(w => w.uid === ui.editGear)))})}</div>${paramEditor(S.wardrobe.find(w => w.uid === ui.editGear))}<div style="height:12px"></div>` : ''}
    ${chipsFor(pl.items, 'plan-toggle')}</section>

  <section class="card"><h2>${tr('Skąd ta liczba')} <small>${tr('kg wyporności na 5 m')}</small></h2>${barsHtml(p)}
    <p class="small muted" style="margin:12px 0 0">${tr('Suma w wodzie {w} kg to {d} kg suchego ołowiu (ołów też wypiera wodę), zaokrąglone w górę do 0,5 kg.', {w: sgn(p.water), d: fmt(p.dry)})}</p></section>

  <button class="primary" data-act="log-from-plan">${tr('Po nurkowaniu: zapisz i oceń')}</button>
  </div>`;
}

function viewLog(){
  if (ui.draft) return viewDraft();
  const dives = S.dives.slice().sort((a, b) => a.date < b.date ? 1 : -1);
  return `<div class="stack">
    <button class="primary" data-act="new-dive">${tr('Dodaj nurkowanie')}</button>
    <section class="card"><h2>${tr('Dziennik')} <small>${dives.length} ${tr('nurk.')}</small></h2>
    ${dives.length ? `<div class="list">${dives.map(d => `<div class="li">
      <div class="main"><div class="t">${esc(siteName(siteOf(d.siteId)))}</div>
      <div class="s mono">${esc(d.date)} · ${esc(d.depth)} m · ${esc(d.time)} min · ${esc(d.tBottom)}–${esc(d.tSurf)} °C</div>
      <div class="s">${resolveItems(d.items, S).filter(i => EXPO.includes(i.cat)).map(i => esc(nm(i))).join(' + ') || tr('bez ocieplenia')}</div>
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
  const d = ui.draft, isNew = !S.dives.some(x => x.id === d.id);
  const seg = (name, cls, opts, val) => `<div class="seg ${cls}" role="group">${opts.map(([v, l]) => `<button data-act="seg" data-name="${name}" data-v="${v}" aria-pressed="${val === v}">${tr(l)}</button>`).join('')}</div>`;
  return `<div class="stack">
    <section class="card"><h2>${tr(isNew ? 'Nowe nurkowanie' : 'Edycja nurkowania')}</h2>${planFields(d, 'd-')}</section>
    <section class="card"><h2>${tr('Użyty zestaw')}</h2>${chipsFor(d.items, 'draft-toggle')}</section>
    <section class="card"><h2>${tr('Balast')}</h2>
      <div class="grid2"><div class="f"><label for="d-lead">${tr('Ołów, który miałeś (kg)')}</label><input id="d-lead" type="number" step="0.5" inputmode="decimal" data-f="lead" value="${esc(d.lead ?? '')}"></div>
      <div class="f"><label for="d-adj">${tr('O ile (kg)')}</label><select id="d-adj" data-f="leadAdj"${d.leadFb === 'ok' || !d.leadFb ? ' disabled' : ''}>${[0.5,1,1.5,2,2.5,3,4].map(v => `<option value="${v}"${+d.leadAdj === v ? ' selected' : ''}>${fmt(v)}</option>`).join('')}</select></div></div>
      <div class="label" style="margin:12px 0 5px">${tr('Na 5 m, z rezerwą i pustą kamizelką było')}</div>
      ${seg('leadFb', 'lead', [['light','Za lekko'],['ok','OK'],['heavy','Za ciężko']], d.leadFb)}
    </section>
    <section class="card"><h2>${tr('Komfort cieplny')}</h2>${seg('thermal', 'therm', [['cold','Zimno'],['cool','Chłodno'],['ok','OK'],['warm','Za ciepło']], d.thermal)}
      <div class="f" style="margin-top:12px"><label for="d-note">${tr('Notatka')}</label><input id="d-note" type="text" data-f="note" value="${esc(d.note || '')}"></div></section>
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
  const groups = CAT_ORDER.map(c => ({c, items: S.wardrobe.filter(w => w.cat === c)})).filter(g => g.items.length);
  const q = ui.addQ.trim().toLowerCase();
  const found = CATALOG.filter(c => (!ui.addCat || c.cat === ui.addCat) && (!q || (c.brand + ' ' + c.model + ' ' + frag(c.model)).toLowerCase().includes(q)));
  return `<div class="stack">
    <section class="card"><h2>${tr('Moja szafa')} <small>${tr('wyporność na 5 m w morzu')}</small></h2>
    ${groups.map(g => `<div class="group" style="margin-top:12px"><div class="label">${catLabel(g.c)}</div><div class="list">${g.items.map(w => {
      const k = L.idx[w.uid], th = k ? L.theta[k] : 0;
      return `<div class="li"><div class="main"><div class="t">${esc(nm(w))}</div>
        <div class="s">${[w.rental && tr('wypożyczony'), w.size && tr('rozm. {x}', {x: w.size}), w.year && tr('z {x}', {x: w.year}), Math.abs(th) >= 0.05 && tr('nauczona korekta {x} kg', {x: sgn(th)})].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div class="r"><div class="mono">${sgn(itemBuoy(w, S.profile, ctx))} kg</div><button class="sm ghost" data-act="edit-gear" data-uid="${esc(w.uid)}">${tr('Edytuj')}</button></div></div>
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
        <div class="btnrow"><button class="primary sm" data-act="close-site">${tr('Gotowe')}</button>${S.dives.some(d => d.siteId === s.id) || S.plan.siteId === s.id ? '' : `<button class="danger sm" data-act="del-site" data-id="${esc(s.id)}">${tr('Usuń')}</button>`}</div></div>` : ''}`).join('')}
  </div><div class="btnrow"><button data-act="add-site">${tr('Dodaj akwen')}</button></div></section></div>`;
}

function viewProfile(){
  const pr = S.profile, b = bodyBuoy(pr, 1.025);
  const sd0 = Math.sqrt(L.cov[0][0]);
  const fld = (k, lab, type = 'number', extra = '') => `<div class="f"><label for="pr-${k}">${tr(lab)}</label><input id="pr-${k}" type="${type}" data-pr="${k}" value="${esc(pr[k] ?? '')}" ${extra}></div>`;
  const learnedItems = L.feats.map((w, i) => ({w, v: L.theta[i + 1], sd: Math.sqrt(L.cov[i + 1][i + 1])})).filter(x => Math.abs(x.v) >= 0.05);
  return `<div class="stack">
  <section class="card"><h2>${tr('Profil nurka')}</h2><div class="grid2">
    <div class="f wide"><label for="pr-lang">${tr('Język')}</label><select id="pr-lang" data-act="lang-sel"><option value="pl"${LANG === 'pl' ? ' selected' : ''}>Polski</option><option value="en"${LANG === 'en' ? ' selected' : ''}>English</option></select></div>
    ${fld('name', 'Imię', 'text')}
    <div class="f"><label for="pr-sex">${tr('Płeć')}</label><select id="pr-sex" data-pr="sex"><option value="M"${pr.sex === 'M' ? ' selected' : ''}>${tr('Mężczyzna')}</option><option value="K"${pr.sex === 'K' ? ' selected' : ''}>${tr('Kobieta')}</option></select></div>
    ${fld('age', 'Wiek (lata)')}${fld('height', 'Wzrost (cm)')}${fld('weight', 'Waga (kg)', 'number', 'step="0.5"')}
    <div class="f"><label for="pr-build">${tr('Budowa')}</label><select id="pr-build" data-pr="build">${Object.entries(lbl().build).map(([v, l]) => `<option value="${v}"${pr.build === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    ${fld('bf', '% tłuszczu (opcjonalnie)', 'number', `placeholder="${tr('z wagi BIA')}"`)}
    ${fld('coldTol', 'Tolerancja zimna (°C)', 'number', 'step="0.5" min="-3" max="3"')}
    ${fld('divesBefore', 'Nurkowania poza dziennikiem', 'number', 'min="0" inputmode="numeric"')}
    <div class="f"><span class="label">${tr('Doświadczenie łącznie')}</span><div class="mono" style="padding:9px 0">${L.total} ${tr('nurk.')} · ${esc(tr(L.exp.label))}</div></div>
  </div>
  <dl class="kv" style="margin-top:14px"><dt>${tr(pr.bf ? 'Tłuszcz (podany)' : 'Tłuszcz (szacunek z BMI i budowy)')}</dt><dd>${fmt(b.bf * 100)} %</dd>
    <dt>${tr('Gęstość ciała')}</dt><dd>${fmt(b.dens, 3)} kg/l</dd><dt>${tr('Powierzchnia ciała')}</dt><dd>${fmt(bsa(pr), 2)} m²</dd>
    <dt>${tr('Wyporność ciała w morzu, pół oddechu')}</dt><dd>${sgn(b.tissue + b.lungs)} kg</dd></dl></section>

  <section class="card"><h2>${tr('Czego nauczył się model')}</h2>
    <dl class="kv"><dt>${tr('Nurkowania z oceną balastu')}</dt><dd>${L.n}</dd>
    <dt>${tr('Start z doświadczenia ({n} nurk.)', {n: L.total})}</dt><dd>${sgn(L.exp.mu)} ± ${fmt(L.exp.sd)} kg</dd>
    <dt>${tr('Korekta osobista')}</dt><dd>${sgn(L.theta[0])} ± ${fmt(sd0)} kg</dd>
    <dt>${tr('Tolerancja zimna z ocen ({n} inf.)', {n: T.n})}</dt><dd>${sgn(T.delta)} °C</dd>
    ${learnedItems.map(x => `<dt>${esc(nm(x.w))}</dt><dd>${sgn(x.v)} ± ${fmt(x.sd)} kg</dd>`).join('')}</dl>
    <p class="small muted" style="margin:10px 0 0">${tr('Korekty to różnica między fizyką a tym, co naprawdę działało w wodzie. Starsze nurkowania ważą mniej (połowa wagi po 30 nurkowaniach).')}</p>
    <div class="btnrow"><button class="sm" data-act="reset-learn">${tr('Ucz od dziś od nowa')}</button>${S.learnSince ? `<button class="sm ghost" data-act="unreset-learn">${tr('Przywróć całą historię')}</button>` : ''}</div>
    ${S.learnSince ? `<p class="small muted">${tr('Nauka liczy nurkowania od {d}.', {d: esc(S.learnSince)})}</p>` : ''}
  </section>

  <section class="card"><h2>${tr('Kopia zapasowa')} <small>${tr('dane są tylko w tej przeglądarce')}</small></h2>
    ${memOnly ? `<div class="banner">${tr('Przeglądarka nie pozwala zapisywać danych — zmiany znikną po zamknięciu. Skopiuj kopię poniżej.')}</div>` : ''}
    <div class="f" style="margin-top:8px"><label for="bk-out">${tr('Eksport (skopiuj i zachowaj)')}</label><textarea id="bk-out" readonly>${esc(JSON.stringify(S))}</textarea></div>
    <div class="btnrow"><button class="sm" data-act="copy">${tr('Kopiuj do schowka')}</button></div>
    <div class="f" style="margin-top:14px"><label for="bk-in">${tr('Import (wklej kopię)')}</label><textarea id="bk-in" placeholder="{&quot;v&quot;:1,…}"></textarea></div>
    <div class="btnrow"><button class="sm" data-act="import">${tr('Wczytaj wklejoną kopię')}</button><label class="small muted" for="bk-file" style="align-self:center">${tr('albo plik:')}</label><input id="bk-file" type="file" accept=".json,application/json" style="width:auto;flex:1"></div>
    <div class="btnrow" style="margin-top:18px"><button class="danger sm" data-act="wipe">${tr(ui.confirmWipe ? 'Na pewno? Kliknij ponownie' : 'Wyczyść wszystkie dane')}</button><button class="sm ghost" data-act="seed">${tr('Wczytaj przykład')}</button></div>
  </section></div>`;
}

function summaryHtml(){
  const pl = S.plan, items = resolveItems(pl.items, S), ctx = planCtx(pl), iss = setIssues(items);
  const p = predictLead(items, S, ctx, L), delta = (+S.profile.coldTol || 0) + T.delta, tef = tEf(pl, delta), th = thermalOfSet(items, pl.depth);
  const short = it => it.cat === 'tank' ? (it.p.mat === 'alu' ? 'Alu ' : tr('Stal') + ' ') + fmt(it.p.vol, it.p.vol % 1 ? 1 : 0) + ' l' : nm(it).replace(/ \((wypożyczon[ay]|własny|rented|own)\)/, '');
  const order = ['wetsuit','over','hood','dry','under','bcd','wing','tank','fins'];
  const shown = items.filter(i => order.includes(i.cat)).sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
  return `<div class="sb" role="status" aria-live="polite">
    <div class="sb-lead"><div class="label">${tr('Ołów')}</div><div class="sb-big">${fmt(p.rec)}<small>kg</small></div><div class="range">${fmt(Math.max(0, p.lo))}–${fmt(p.hi)}</div></div>
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
  $('#summary').innerHTML = tab === 'calc' ? summaryHtml() : '';
  document.querySelectorAll('nav.tabs button').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#who').innerHTML = `<span class="mono">${L.total}</span> ${tr('nurk.')}`; $('#who').title = S.profile.name || '';
  const f = {calc:viewCalc, log:viewLog, gear:viewGear, sites:viewSites, profile:viewProfile}[tab];
  view.innerHTML = f();
  if (fid){ const el = document.getElementById(fid); if (el){ el.focus({preventScroll:true}); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch(_){} } }
}

// ---------- zdarzenia ----------
const view = document.getElementById('view');
function draftFromPlan(){
  const p = predictLead(resolveItems(S.plan.items, S), S, planCtx(S.plan), L);
  return Object.assign(JSON.parse(JSON.stringify(S.plan)), {id: newId('d'), lead: p.rec, leadFb: null, leadAdj: 1, thermal: null, note: '', date: S.plan.date || today()});
}
function setLang(l){ LANG = l; S.lang = l; save(); render(); }
$('#lang').addEventListener('click', () => setLang(LANG === 'pl' ? 'en' : 'pl'));
document.querySelector('nav.tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  tab = b.dataset.tab; ui.editGear = ui.editSite = ui.quick = ui.siteQ = null; ui.confirmWipe = false; render(); window.scrollTo(0, 0);
});
function pickSite(pre, id){
  const tg = targetOf(pre); tg.siteId = id; fillTemps(tg); ui.siteQ = null;
  const el = document.getElementById(pre + 'site'); if (el) el.blur();
  return tg === S.plan ? commit() : render();
}
view.addEventListener('mousedown', e => { const b = e.target.closest('[data-act="site-pick"]'); if (b){ e.preventDefault(); pickSite(b.dataset.pre, b.dataset.id); } });
view.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
  const a = b.dataset.act;
  if (a === 'site-pick') return pickSite(b.dataset.pre, b.dataset.id);
  if (a === 'cal'){ const pk = document.getElementById(b.dataset.pre + 'datepick'); try { pk.showPicker(); } catch(_){ pk.focus(); pk.click(); } return; }
  if (a === 'plan-toggle'){ S.plan.items = toggleItem(S.plan.items, b.dataset.uid); return commit(); }
  if (a === 'draft-toggle'){ ui.draft.items = toggleItem(ui.draft.items, b.dataset.uid); return render(); }
  if (a === 'use-combo'){ const base = S.plan.items.filter(u => { const w = S.wardrobe.find(x => x.uid === u); return w && !EXPO.includes(w.cat); }); S.plan.items = base.concat(b.dataset.uids.split(',')); toast(tr('Zestaw podmieniony')); return commit(); }
  if (a === 'log-from-plan'){ ui.draft = draftFromPlan(); tab = 'log'; render(); return window.scrollTo(0, 0); }
  if (a === 'new-dive'){ ui.draft = draftFromPlan(); return render(); }
  if (a === 'edit-dive'){ ui.draft = JSON.parse(JSON.stringify(S.dives.find(d => d.id === b.dataset.id))); render(); return window.scrollTo(0, 0); }
  if (a === 'seg'){ ui.draft[b.dataset.name] = ui.draft[b.dataset.name] === b.dataset.v ? null : b.dataset.v; return render(); }
  if (a === 'cancel-dive'){ ui.draft = null; return render(); }
  if (a === 'del-dive'){ S.dives = S.dives.filter(d => d.id !== ui.draft.id); ui.draft = null; toast(tr('Nurkowanie usunięte')); return commit(); }
  if (a === 'save-dive'){
    const d = ui.draft;
    if (!validDate(d.date)){ toast(tr('Data w formacie rrrr-mm-dd')); return; }
    if (d.leadFb && (d.lead == null || d.lead === '')){ toast(tr('Wpisz, ile ołowiu miałeś')); return; }
    const before = L.theta[0];
    S.dives = S.dives.filter(x => x.id !== d.id).concat([d]); ui.draft = null; save(); recompute(); render();
    return toast(d.leadFb ? tr('Zapisano. Korekta osobista: {a} → {b} kg', {a: sgn(before), b: sgn(L.theta[0])}) : tr('Zapisano'));
  }
  if (a === 'edit-gear'){ ui.editGear = ui.editGear === b.dataset.uid ? null : b.dataset.uid; return render(); }
  if (a === 'close-gear'){ ui.editGear = null; return commit(); }
  if (a === 'quick-open'){ ui.quick = ui.quick ? null : {q:'', cat:'', kind:'bought'}; ui.editGear = null; return render(); }
  if (a === 'quick-kind'){ ui.quick.kind = b.dataset.v; return render(); }
  if (a === 'quick-add'){ return quickItem(fromCat(b.dataset.id, {uid: newId(b.dataset.id)})); }
  if (a === 'quick-own'){ const cat = $('#qq-own').value; return quickItem({uid: newId('own'), catId: null, cat, brand: 'Własne', model: catOne(cat), size: '', year: null, p: JSON.parse(JSON.stringify(OWN_DEFAULTS[cat])), src: 'wpis własny'}); }
  if (a === 'del-gear'){ const u = b.dataset.uid; S.wardrobe = S.wardrobe.filter(w => w.uid !== u); S.plan.items = S.plan.items.filter(x => x !== u); ui.editGear = null; toast(tr('Usunięto z szafy')); return commit(); }
  if (a === 'add-cat'){ const w = fromCat(b.dataset.id, {uid: newId(b.dataset.id), year: new Date().getFullYear()}); S.wardrobe.push(w); ui.editGear = w.uid; toast(tr('Dodano — ustaw rozmiar')); return commit(); }
  if (a === 'add-custom'){
    const cat = $('#custom-cat').value;
    const w = {uid: newId('own'), catId: null, cat, brand: 'Własne', model: catOne(cat) + ' ' + tr('(własny)'), size: '', year: new Date().getFullYear(), p: JSON.parse(JSON.stringify(OWN_DEFAULTS[cat])), src: 'wpis własny'};
    S.wardrobe.push(w); ui.editGear = w.uid; return commit();
  }
  if (a === 'edit-site'){ ui.editSite = ui.editSite === b.dataset.id ? null : b.dataset.id; return render(); }
  if (a === 'close-site'){ ui.editSite = null; return commit(); }
  if (a === 'add-site'){ const s = {id: newId('site'), name: tr('Nowy akwen'), rho: 1.000, ts: [4,4,5,8,13,18,21,21,17,12,7,4], tb: [4,4,4,5,6,7,8,8,8,7,6,4]}; S.sites.push(s); ui.editSite = s.id; return commit(); }
  if (a === 'del-site'){ S.sites = S.sites.filter(s => s.id !== b.dataset.id); ui.editSite = null; return commit(); }
  if (a === 'reset-learn'){ S.learnSince = today(); toast(tr('Nauka zaczyna się od dziś')); return commit(); }
  if (a === 'unreset-learn'){ delete S.learnSince; return commit(); }
  if (a === 'copy'){ const t = $('#bk-out'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast(tr('Skopiowano')), () => { try { document.execCommand('copy'); toast(tr('Skopiowano')); } catch(_){ toast(tr('Zaznaczono — skopiuj ręcznie')); } }); return; }
  if (a === 'import'){ return importText($('#bk-in').value); }
  if (a === 'wipe'){ if (!ui.confirmWipe){ ui.confirmWipe = true; return render(); }
    ui.confirmWipe = false; S = {v:1, lang: LANG, profile:{name:'', sex:'M', age:40, height:178, weight:80, build:'average', bf:'', coldTol:0, divesBefore:0}, wardrobe:[fromCat('misc-reg')], sites: SITE_PRESETS.map(s => Object.assign({preset:true}, JSON.parse(JSON.stringify(s)))), dives:[], plan:{siteId:'redsea', date: today(), depth:18, time:50, tSurf:26, tBottom:25, nDay:1, reserve:50, items:['misc-reg-1']}};
    fillTemps(S.plan); tab = 'profile'; toast(tr('Wyczyszczono. Zacznij od profilu i szafy.')); return commit(); }
  if (a === 'seed'){ S = seedState(); S.lang = LANG; toast(tr('Wczytano przykład')); return commit(); }
});
function importText(txt){
  try { const o = JSON.parse(txt); if (o.v !== 1 || !o.profile || !o.wardrobe) throw 0; S = o; LANG = S.lang === 'en' ? 'en' : 'pl'; toast(tr('Wczytano kopię')); commit(); }
  catch(_){ toast(tr('To nie jest kopia z tej aplikacji — sprawdź, czy wkleiłeś całość')); }
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
  else if (e.key === 'Escape'){ ui.siteQ = null; render(); t.blur(); }
});
view.addEventListener('input', e => {
  const t = e.target;
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
  if (t.id === 'bk-file' && t.files[0]){ t.files[0].text().then(importText); return; }
  if (t.dataset.act === 'lang-sel') return setLang(v);
  if (t.dataset.act === 'qc'){ ui.addCat = v; return render(); }
  if (t.dataset.act === 'qqc'){ ui.quick.cat = v; return render(); }
  if (t.dataset.act === 'siteq') return;
  if (t.dataset.pick){
    if (!v) return;
    const tg = targetOf(t.dataset.pick); tg.date = v; fillTemps(tg);
    return tg === S.plan ? commit() : render();
  }
  if (t.dataset.f){
    const tg = targetOf(t.id.startsWith('d-') ? 'd-' : 'p-'), k = t.dataset.f;
    if (k === 'date'){
      if (!validDate(v)){ toast(tr('Data w formacie rrrr-mm-dd')); return render(); }
      tg.date = v; fillTemps(tg);
    } else tg[k] = k === 'note' ? v : num(v);
    return tg === S.plan ? commit() : render();
  }
  if (t.dataset.pr){ const k = t.dataset.pr; S.profile[k] = ['name','sex','build'].includes(k) ? v : (k === 'bf' ? (v === '' ? '' : num(v)) : num(v)); return commit(); }
  if (t.dataset.w || t.dataset.p){
    const w = S.wardrobe.find(x => x.uid === ui.editGear); if (!w) return;
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
