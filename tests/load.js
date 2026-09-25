// Ładuje kod aplikacji (bez DOM) do izolowanego kontekstu, tak jak przeglądarka: wspólne globalne.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export function loadApp(files = ['data.js', 'model.js', 'import.js', 'seed.js', 'i18n.js', 'brand.js']){
  const ctx = vm.createContext({console});
  const src = files.map(f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
  // const/let z top-level nie trafiają do globalnych — eksportujemy je jawnie
  const names = ['CATALOG','CATS','CAT_ORDER','SITE_PRESETS','WATER_TYPES','seedState','freshState','seedDiver','emptyDiver','seedSites','migrate','diverState','parseSuuntoJson','kelvinToC','matchSite','nearestSite','siteDistKm','siteHit','distanceKm','fromCat','bsa','bodyBuoy','bodyFat','itemBuoy','physics',
    'learnLead','predictLead','thermalOfSet','tEf','tBreak','learnThermal','toDry','roundUpHalf','compress','resolveItems','EN','LBL','FRAG_EN','tr','frag','brandText','brandErrors','activeNews','newsId','brandTokensCss','brandManifest','NEWS_MAX'];
  vm.runInContext(src + '\n;globalThis.__x = {' + names.filter(n => new RegExp('(const|let|function) ' + n + '\\b').test(src)).join(',') + '};', ctx);
  return ctx.__x;
}
