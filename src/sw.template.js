// Service worker: działanie offline. Wersja zmienia się przy każdym buildzie, więc telefony pobiorą nową aplikację.
// Aplikacja główna i wersje centrów leżą pod jednym adresem (…/balast-ocieplenie/, …/balast-ocieplenie/<id>/),
// więc dzielą pamięć podręczną przeglądarki. Każdy worker sprząta tylko swoje cache (PREFIX), a główny
// nie obsługuje podkatalogów centrów (SKIP) — inaczej wdrożenie jednej wersji wyłączałoby offline drugiej.
const CACHE = '__CACHE__';
const PREFIX = '__PREFIX__';
const LEGACY = __LEGACY__;           // główna wersja sprząta też cache sprzed podziału („balast-<hash>”)
const APP = __APP__;
const SKIP = __SKIP__.map(p => new URL(p, self.registration.scope).pathname);
const own = k => k.startsWith(PREFIX) || (LEGACY && /^balast-[0-9a-f]{8}$/.test(k));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && own(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (SKIP.some(p => url.pathname.startsWith(p))) return;     // podkatalog innej wersji — obsłuży go jej worker
  // aplikacja: najpierw sieć (świeża wersja), bez sieci z własnej pamięci
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.open(CACHE).then(c => c.match(req, {ignoreSearch: true}).then(r => r || c.match('./index.html')))));
    return;
  }
  // czcionki Google: z pamięci, w tle odśwież
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
