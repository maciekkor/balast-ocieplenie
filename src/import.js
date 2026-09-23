// Balast i Ocieplenie — wczytywanie nurkowania z komputera i dopasowanie akwenu.
// Copyright (c) 2026 Maciej Korzeniowski. Wszelkie prawa zastrzeżone / All rights reserved.
// Kopiowanie i utwory zależne wymagają pisemnej zgody autora — zobacz LICENSE.
// ===== Import nurkowania z komputera =====
// Na razie jeden format: JSON z aplikacji Suunto (Ocean, Nautic, Nautic S — jeden plik = jedno nurkowanie).
// Czysta funkcja, bez DOM: dostaje tekst pliku, oddaje dane do formularza albo opis błędu.
const DIVE_ACTIVITY = 51;            // ActivityType nurkowania w eksporcie Suunto
const K0 = 273.15;
const kelvinToC = k => k == null ? null : Math.round((k - K0) * 10) / 10;
const radToDeg = r => r * 180 / Math.PI;

function suuntoDate(iso){
  // DateTime niesie lokalne przesunięcie („…+02:00”), więc data dnia to wprost pierwsze 10 znaków
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null;
}

// Zwraca {ok:true, dive:{…}} albo {ok:false, why:'…'}
function parseSuuntoJson(text){
  let o;
  try { o = JSON.parse(text); } catch(_){ return {ok: false, why: 'notJson'}; }
  const log = o && o.DeviceLog;
  const h = log && log.Header;
  if (!h || typeof h !== 'object') return {ok: false, why: 'notSuunto'};
  if (h.ActivityType != null && +h.ActivityType !== DIVE_ACTIVITY) return {ok: false, why: 'notDive'};

  const date = suuntoDate(h.DateTime);
  const samples = Array.isArray(log.Samples) ? log.Samples : [];
  const depths = samples.map(x => x && x.Depth).filter(x => typeof x === 'number');
  const temps = samples.map(x => x && x.Temperature).filter(x => typeof x === 'number');

  const depth = (h.Depth && typeof h.Depth.Max === 'number') ? h.Depth.Max : (depths.length ? Math.max(...depths) : null);
  const secs = typeof h.DiveTime === 'number' ? h.DiveTime : (typeof h.DiveTimeMax === 'number' ? h.DiveTimeMax : null);
  if (date == null || depth == null || secs == null) return {ok: false, why: 'notDive'};

  // Nazwy w Header.Temperature bywają zamienione (Max bywa chłodniejsze od Min), więc
  // nie ufamy im i bierzemy skrajne wartości: najcieplej = powierzchnia, najzimniej = dno.
  const pool = temps.length ? temps : [h.Temperature && h.Temperature.Max, h.Temperature && h.Temperature.Min].filter(x => typeof x === 'number');
  const tSurf = pool.length ? kelvinToC(Math.max(...pool)) : null;
  const tBottom = pool.length ? kelvinToC(Math.min(...pool)) : null;

  // Współrzędne w pliku są w radianach
  const fix = samples.find(x => x && typeof x.Latitude === 'number' && typeof x.Longitude === 'number');
  const gps = fix ? {lat: Math.round(radToDeg(fix.Latitude) * 1e4) / 1e4, lon: Math.round(radToDeg(fix.Longitude) * 1e4) / 1e4} : null;

  return {ok: true, dive: {
    date,
    depth: Math.round(depth * 10) / 10,
    time: Math.max(1, Math.round(secs / 60)),
    tSurf, tBottom,
    gps,
    device: (h.Device && h.Device.Info && h.Device.Info.HW) || null,
    note: typeof h.Notes === 'string' ? h.Notes.trim() : ''
  }};
}

// Dopasowanie akwenu do pozycji z komputera. Presety mają przybliżony środek rejonu (lat/lon)
// i promień r w km, w którym dopasowanie ma sens: „Chorwacja (Adriatyk)” to 350 km, kamieniołom 8 km.
// Akweny dopisane ręcznie nie mają współrzędnych, więc ich nie dotyczy.
function distanceKm(a, b, c, d){
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(c - a), dLon = rad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// Porównujemy odległość mierzoną promieniem akwenu (km / r), a nie w kilometrach:
// inaczej wielkie rejony („Bałtyk”, promień 400 km) wygrywałyby z kamieniołomem,
// nad którym nurek właśnie stoi — tak Honoratka wychodziła jako Bałtyk.
function matchSite(gps, sites){
  if (!gps || !Array.isArray(sites)) return null;
  let best = null;
  for (const s of sites){
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;
    const r = s.r || 25;
    const km = distanceKm(gps.lat, gps.lon, s.lat, s.lon);
    if (km <= r && (!best || km / r < best.score)) best = {id: s.id, km: Math.round(km), score: km / r};
  }
  return best && {id: best.id, km: best.km};
}

if (typeof module !== 'undefined') module.exports = {parseSuuntoJson, kelvinToC, matchSite, distanceKm};
