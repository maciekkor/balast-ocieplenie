// Build: składa src/ w jeden plik dist/index.html + service worker + pliki statyczne.
// Uruchom: node build.mjs   (bez zależności)
//
// Wersje centrów nurkowych: każdy katalog brands/<id>/ z plikiem brand.json dostaje własną
// aplikację w dist/<id>/, czyli pod adresem …/balast-ocieplenie/<id>/ — z własnym logo, kolorami,
// ikoną, manifestem, service workerem i aktualnościami. Katalogi zaczynające się od „_” (szablon)
// są pomijane. Opis w brands/README.md i docs/SPEC.md („Wersje centrów nurkowych”).
// Zmienne dla testów: BRANDS_DIR (skąd brać centra), OUT_DIR (dokąd pisać).
import {readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.env.OUT_DIR || path.join(ROOT, 'dist'));
const BRANDS = path.resolve(process.env.BRANDS_DIR || path.join(ROOT, 'brands'));
const r = f => readFileSync(path.join(ROOT, f), 'utf8');

const shell = r('src/shell.html');
const [head, rest] = shell.split('</style>');
const SRC = ['data.js', 'model.js', 'import.js', 'seed.js', 'i18n.js', 'brand.js', 'app.js'].map(f => r('src/' + f)).join('\n');

// Funkcje brandingu i lista akwenów do walidacji — te same pliki, które jadą do przeglądarki.
const ctx = vm.createContext({});
vm.runInContext(r('src/data.js') + '\n' + r('src/brand.js') + '\n;globalThis.__b = {brandErrors, brandTokensCss, brandManifest, brandText, SITE_PRESETS};', ctx);
const {brandErrors, brandTokensCss, brandManifest, brandText, SITE_PRESETS} = ctx.__b;

// Nagłówek z prawami autorskimi jedzie w każdym zbudowanym pliku: zbudowaną stronę
// dostaje każda przeglądarka, więc warunki muszą jechać razem z nią.
const YEAR = new Date().getFullYear();
const BANNER = `Balast i Ocieplenie — kalkulator balastu i ocieplenia dla nurków.
  Copyright (c) ${YEAR} Maciej Korzeniowski. Wszelkie prawa zastrzeżone / All rights reserved.
  Kopiowanie, tworzenie utworów zależnych i wykorzystanie katalogu sprzętu wymagają pisemnej zgody autora.
  Copying, derivative works and reuse of the equipment catalogue require the author's written permission.
  Warunki / terms: https://github.com/maciekkor/balast-ocieplenie/blob/main/LICENSE`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function page(brand){
  // BRAND idzie przed resztą skryptu, bo seed.js czyta z niego domowy akwen.
  // JSON w <script> nie może zawierać „</”, inaczej zamknąłby znacznik.
  const js = `const BRAND = ${JSON.stringify(brand).replace(/<\//g, '<\\/')};\n` + SRC;
  const body = rest.replace(/<script>[\s\S]*<\/script>\s*$/, '<script>\n' + js + '\n</script>');
  const title = brand ? `${brandText(brand.name, 'pl')} · Balast i Ocieplenie` : 'Balast i Ocieplenie';
  const desc = brand ? `Kalkulator balastu i ocieplenia od ${brandText(brand.name, 'pl')}. Dane zostają w telefonie.`
                     : 'Kalkulator balastu i ocieplenia dla nurków. Dane zostają w telefonie.';
  const tokens = brand ? `\n/* kolory centrum: ${brand.id} */\n${brandTokensCss(brand)}\n` : '';
  return `<!doctype html>
<html lang="pl">
<!--
  ${BANNER}
-->
<head>
<meta charset="utf-8">
<meta name="copyright" content="© ${YEAR} Maciej Korzeniowski">
<meta name="author" content="Maciej Korzeniowski">
<meta name="robots" content="noai, noimageai">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${esc(desc)}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="${brand ? esc(brand.icon192) : 'icons/icon-192.png'}">
<link rel="apple-touch-icon" href="${brand ? esc(brand.appleIcon) : 'icons/apple-touch-icon.png'}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="${brand ? esc(brand.appName) : 'Balast'}">
<style>body{margin:0} img{max-width:100%} [hidden]{display:none!important}</style>
${head.trim().replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)}${tokens}</style>
</head>
<body>
${body.trim()}
<script>
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
</script>
</body>
</html>
`;
}

function worker({cache, prefix, legacy, app, skip}){
  return '/*\n  ' + BANNER + '\n*/\n' + r('src/sw.template.js')
    .replace("'__CACHE__'", JSON.stringify(cache)).replace("'__PREFIX__'", JSON.stringify(prefix))
    .replace('__LEGACY__', String(legacy)).replace('__APP__', JSON.stringify(app)).replace('__SKIP__', JSON.stringify(skip));
}

// ---- centra: wczytanie i walidacja, zanim cokolwiek trafi do dist/ ----
const brands = [];
if (existsSync(BRANDS)) for (const name of readdirSync(BRANDS).sort()){
  const dir = path.join(BRANDS, name), file = path.join(dir, 'brand.json');
  if (name.startsWith('_') || !statSync(dir).isDirectory() || !existsSync(file)) continue;
  let b;
  try { b = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(`${name}/brand.json: ${e.message}`); }
  const errs = brandErrors(b, p => !p.includes('..') && existsSync(path.join(dir, p)), SITE_PRESETS);
  if (b && b.id !== name) errs.push(`id „${b && b.id}” musi być równe nazwie katalogu „${name}”`);
  if (errs.length) fail(`${name}/brand.json:\n  - ` + errs.join('\n  - '));
  brands.push({b, dir});
}
function fail(msg){ console.error('Błąd konfiguracji centrum: ' + msg); process.exit(1); }

rmSync(OUT, {recursive: true, force: true});
mkdirSync(OUT, {recursive: true});
cpSync(path.join(ROOT, 'public'), OUT, {recursive: true});

// ---- wersja główna ----
const mainHtml = page(null);
const mainVer = createHash('sha1').update(mainHtml).digest('hex').slice(0, 8);
writeFileSync(path.join(OUT, 'index.html'), mainHtml);
writeFileSync(path.join(OUT, 'sw.js'), worker({
  cache: 'balast-main-' + mainVer, prefix: 'balast-main-', legacy: true,
  app: ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'],
  skip: brands.map(x => './' + x.b.id + '/')
}));
console.log(`dist/ gotowe — wersja ${mainVer}, index.html ${(mainHtml.length / 1024).toFixed(0)} KB`);

// ---- wersje centrów ----
for (const {b, dir} of brands){
  const out = path.join(OUT, b.id);
  mkdirSync(out, {recursive: true});
  // pliki centrum lądują w <id>/brand/, więc ścieżki z brand.json dostają ten przedrostek
  cpSync(dir, path.join(out, 'brand'), {recursive: true, filter: s => path.basename(s) !== 'brand.json'});
  const at = p => 'brand/' + p;
  const B = Object.assign({}, b, {
    logo: at(b.logo), icon192: at(b.icon192), icon512: at(b.icon512), appleIcon: at(b.appleIcon),
    news: (b.news || []).map(n => Object.assign({}, n, {img: at(n.img)}))
  });
  const html = page(B);
  const ver = createHash('sha1').update(html).digest('hex').slice(0, 8);
  writeFileSync(path.join(out, 'index.html'), html);
  writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify(brandManifest(B), null, 2) + '\n');
  writeFileSync(path.join(out, 'sw.js'), worker({
    cache: `balast-${b.id}-${ver}`, prefix: `balast-${b.id}-`, legacy: false,
    app: ['./', './index.html', './manifest.webmanifest', ...new Set([B.logo, B.icon192, B.icon512, B.appleIcon, ...B.news.map(n => n.img)].map(p => './' + p))],
    skip: []
  }));
  console.log(`dist/${b.id}/ gotowe — ${brandText(b.name, 'pl')}, wersja ${ver}, aktualności: ${B.news.length}`);
}
