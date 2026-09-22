// ===== Dane startowe wersji publicznej: przykładowy nurek, bez nurkowań =====
function fromCat(id, extra){
  const c = CATALOG.find(x => x.id === id);
  return Object.assign({uid: id + '-1', catId: id, cat: c.cat, brand: c.brand, model: c.model, size: '', year: null, p: JSON.parse(JSON.stringify(c.p)), src: c.src}, extra || {});
}
function seedState(){
  const y = new Date().getFullYear();
  const d = new Date(); d.setDate(d.getDate() + 14);
  const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const s = {
    v: 1,
    profile: {name:'', sex:'M', age:40, height:178, weight:80, build:'average', bf:'', coldTol:0, divesBefore:20},
    wardrobe: [
      fromCat('mares-reef-3', {year:y}), fromCat('gen-vest-hood-5', {year:y}), fromCat('mares-flexa-boots-5', {year:y}),
      fromCat('mares-prestige', {year:y}), fromCat('al-s80'), fromCat('st-12-232'),
      fromCat('fin-mares-aq-plus', {year:y}), fromCat('misc-reg')
    ],
    sites: SITE_PRESETS.map(x => Object.assign({preset:true}, JSON.parse(JSON.stringify(x)))),
    dives: [],
    plan: {siteId:'redsea', date, depth:18, time:50, tSurf:26, tBottom:25, nDay:1, reserve:50,
      items:['mares-reef-3-1','mares-prestige-1','al-s80-1','fin-mares-aq-plus-1','misc-reg-1']}
  };
  const m = +date.slice(5, 7) - 1; s.plan.tSurf = SITE_PRESETS[0].ts[m]; s.plan.tBottom = SITE_PRESETS[0].tb[m];
  return s;
}
