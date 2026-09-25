// Balast i Ocieplenie — wersje zbrandowane dla centrów nurkowych.
// Copyright (c) 2026 Maciej Korzeniowski. Wszelkie prawa zastrzeżone / All rights reserved.
// Kopiowanie i utwory zależne wymagają pisemnej zgody autora — zobacz LICENSE.
// ===== Branding =====
// Ta sama aplikacja pod osobnym adresem (…/balast-ocieplenie/<id>/), w barwach centrum.
// Konfiguracja leży w brands/<id>/brand.json; build.mjs sprawdza ją tymi funkcjami i wstawia
// jako BRAND na początek skryptu. Wersja główna dostaje BRAND = null.
// Funkcje są czyste (bez DOM), bo korzysta z nich i build, i aplikacja.

const BRAND_ID = /^[a-z0-9][a-z0-9-]{1,30}$/;
const BRAND_RESERVED = ['icons', 'brand', 'shots'];     // katalogi, które już leżą w dist/
const HEX = /^#[0-9a-fA-F]{6}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NEWS_MAX = 2;                                     // „1–2 grafiki” — więcej zamienia ekran w tablicę ogłoszeń
const COLOR_KEYS = ['accent', 'accentInk', 'teal', 'tealSoft'];

// Tekst z konfiguracji: zwykły napis albo {pl, en}. Brak wersji w danym języku — bierzemy drugą.
function brandText(v, lang){
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.pl || v.en || '';
}

// Lista błędów konfiguracji; pusta = w porządku. `has(path)` mówi, czy plik z brands/<id>/ istnieje.
// Build zatrzymuje się na pierwszym niepustym wyniku — zepsuta wersja centrum nie może wyjechać po cichu.
function brandErrors(b, has, sites){
  const e = [];
  if (!b || typeof b !== 'object') return ['brand.json nie jest obiektem'];
  if (!BRAND_ID.test(b.id || '')) e.push('id: małe litery, cyfry i myślnik, 2–31 znaków (to jest też część adresu)');
  else if (BRAND_RESERVED.includes(b.id)) e.push(`id „${b.id}” jest zajęte przez katalog aplikacji`);
  if (!brandText(b.name, 'pl')) e.push('name: nazwa centrum jest wymagana');
  if (!b.appName || String(b.appName).length > 12) e.push('appName: nazwa pod ikoną w telefonie, najwyżej 12 znaków');
  for (const f of ['logo', 'icon192', 'icon512', 'appleIcon'])
    if (!b[f]) e.push(`${f}: brak pliku`); else if (has && !has(b[f])) e.push(`${f}: nie ma pliku ${b[f]}`);
  for (const theme of ['light', 'dark']){
    const c = b.colors && b.colors[theme];
    if (!c) { e.push(`colors.${theme}: brak`); continue; }
    for (const k of COLOR_KEYS) if (!HEX.test(c[k] || '')) e.push(`colors.${theme}.${k}: kolor w formacie #RRGGBB`);
  }
  if (b.site != null && sites && !sites.some(s => s.id === b.site)) e.push(`site: nie ma akwenu „${b.site}”`);
  const news = b.news || [];
  if (!Array.isArray(news)) e.push('news: lista');
  else news.forEach((n, i) => {
    if (!n || !n.img) e.push(`news[${i}].img: grafika jest wymagana`);
    else if (has && !has(n.img)) e.push(`news[${i}].img: nie ma pliku ${n.img}`);
    for (const d of ['from', 'until']) if (n && n[d] != null && !ISO.test(n[d])) e.push(`news[${i}].${d}: data rrrr-mm-dd`);
    if (n && n.url != null && !/^https:\/\//.test(n.url)) e.push(`news[${i}].url: tylko adres https://`);
  });
  if (b.contact && b.contact.url != null && !/^https:\/\//.test(b.contact.url)) e.push('contact.url: tylko adres https://');
  return e;
}

// Aktualności do pokazania dziś: w terminie, nieukryte przez nurka, najwyżej NEWS_MAX.
// `seen` to identyfikatory ukryte przyciskiem „Ukryj” (S.newsSeen); id to n.id albo ścieżka grafiki,
// więc nowa grafika od centrum pokazuje się sama, nawet jeśli poprzednią ktoś ukrył.
const newsId = n => String(n.id || n.img);
function activeNews(news, today, seen){
  const hide = new Set(seen || []);
  return (news || []).filter(n => n && n.img && (!n.from || n.from <= today) && (!n.until || n.until >= today) && !hide.has(newsId(n))).slice(0, NEWS_MAX);
}

// Kolory centrum nadpisują te same tokeny co motyw — we wszystkich trzech blokach :root z shell.html,
// inaczej jeden z motywów zostałby w barwach głównej aplikacji.
function brandTokensCss(b){
  const t = c => `--accent:${c.accent};--accent-ink:${c.accentInk};--teal:${c.teal};--teal-soft:${c.tealSoft};--pos:${c.teal}`;
  return `:root{${t(b.colors.light)}}\n` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${t(b.colors.dark)}}}\n` +
    `:root[data-theme="dark"]{${t(b.colors.dark)}}`;
}

// Manifest osobnej aplikacji. Względne id/scope/start_url liczą się od adresu manifestu,
// więc każda wersja instaluje się jako osobna ikona, a nie jako „Balast” w innych kolorach.
function brandManifest(b){
  const name = brandText(b.name, 'pl');
  return {
    name: `${name} · Balast i Ocieplenie`,
    short_name: b.appName,
    description: `Kalkulator balastu i ocieplenia od ${name}. Dane zostają w telefonie.`,
    lang: 'pl', start_url: './', scope: './', id: './',
    display: 'standalone', orientation: 'portrait',
    background_color: b.colors.dark.teal, theme_color: b.colors.light.accent,
    icons: [
      {src: b.icon192, sizes: '192x192', type: 'image/png'},
      {src: b.icon512, sizes: '512x512', type: 'image/png'},
      {src: b.icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable'}
    ],
    related_applications: [{platform: 'webapp', url: 'manifest.webmanifest'}],
    prefer_related_applications: false
  };
}

if (typeof module !== 'undefined') module.exports = {brandText, brandErrors, activeNews, newsId, brandTokensCss, brandManifest, NEWS_MAX};
