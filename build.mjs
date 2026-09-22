// Build: składa src/ w jeden plik dist/index.html + service worker + pliki statyczne.
// Uruchom: node build.mjs   (bez zależności)
import {readFileSync, writeFileSync, mkdirSync, cpSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';

const r = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const shell = r('./src/shell.html');
const [head, rest] = shell.split('</style>');
const js = ['data.js', 'model.js', 'import.js', 'seed.js', 'i18n.js', 'app.js'].map(f => r('./src/' + f)).join('\n');
const body = rest.replace(/<script>[\s\S]*<\/script>\s*$/, '<script>\n' + js + '\n</script>');

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Kalkulator balastu i ocieplenia dla nurków. Dane zostają w telefonie.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Balast">
<style>body{margin:0} img{max-width:100%} [hidden]{display:none!important}</style>
${head.trim()}</style>
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
const ver = createHash('sha1').update(html).digest('hex').slice(0, 8);
rmSync(new URL('./dist', import.meta.url), {recursive: true, force: true});
mkdirSync(new URL('./dist', import.meta.url));
cpSync(new URL('./public', import.meta.url), new URL('./dist', import.meta.url), {recursive: true});
writeFileSync(new URL('./dist/index.html', import.meta.url), html);
writeFileSync(new URL('./dist/sw.js', import.meta.url), r('./src/sw.template.js').replace('__VER__', ver));
console.log(`dist/ gotowe — wersja ${ver}, index.html ${(html.length / 1024).toFixed(0)} KB`);
