# Balast i Ocieplenie — specyfikacja

Stan na 2026-09-22 (wersja 1.0). Dokument opisuje to, co **jest zaimplementowane**, oraz backlog. Jest źródłem prawdy dla dalszego rozwoju; przy każdej zmianie zachowania aktualizuj odpowiednią sekcję.

## 1. Cel i zasady

Aplikacja mówi nurkowi, **ile ołowiu** zabrać i **jaki zestaw ocieplenia** założyć na konkretne nurkowanie, a po każdym nurkowaniu **uczy się** z jego oceny.

Zasady nienegocjowalne:

1. **Dane tylko lokalnie.** Brak kont, serwera, analityki i zapytań sieciowych poza pobraniem samej aplikacji i czcionek Google. Stan w `localStorage` przeglądarki (klucz `balast-ocieplenie.v1`).
2. **Działa offline** jako PWA (instalacja na ekranie głównym, service worker).
3. **Wynik to punkt startowy**, nie zastępuje kontroli pływalności. Komunikat o kontroli na 5 m przy nowej konfiguracji musi zostać.
4. **Jeden plik HTML po buildzie**, bez frameworków i bez zależności npm w runtime.
5. **Dwa języki:** polski (domyślny) i angielski. Każdy nowy tekst UI musi mieć tłumaczenie (pilnuje tego test).
6. **Format daty:** zawsze `rrrr-mm-dd` (ISO), niezależnie od ustawień telefonu.
7. **Liczby:** przecinek dziesiętny w PL, kropka w EN; ołów zaokrąglany w górę do 0,5 kg.

## 2. Architektura

| Plik | Rola |
| --- | --- |
| `src/shell.html` | `<title>`, CSS (tokeny kolorów, jasny i ciemny motyw), szkielet: nagłówek, przypięty pasek podsumowania `#summary`, `#view`, dolna nawigacja |
| `src/data.js` | `CATALOG` (sprzęt), `SZ` (rozmiarówki), `CATS`, `CAT_ORDER`, `SITE_PRESETS` (akweny), `WATER_TYPES` |
| `src/model.js` | Fizyka balastu, model ocieplenia, uczenie, `diverState()`. Czyste funkcje bez DOM |
| `src/import.js` | `parseSuuntoJson()` — wczytanie nurkowania z pliku aplikacji Suunto. Czysta funkcja, bez DOM |
| `src/seed.js` | `fromCat()`, `seedDiver()` (przykładowy nurek), `emptyDiver()` (nurek bez danych), `seedSites()`, `seedState()`, `migrate()` — dane startowe i migracja zapisanego stanu |
| `src/i18n.js` | `EN` (słownik PL→EN kluczowany polskim tekstem), `LBL` (etykiety kategorii, miesięcy, budowy, krojów, wody), `SITE_EN`, `FRAG_EN` (tłumaczenie fragmentów nazw katalogowych), `tr()`, `frag()` |
| `src/app.js` | Stan, zapis, widoki (render przez template stringi), obsługa zdarzeń (delegacja na `#view`) |
| `src/sw.template.js` | Service worker; `__VER__` podmieniany hashem przy buildzie |
| `public/` | `manifest.webmanifest`, ikony, `.nojekyll` — kopiowane do `dist/` |
| `build.mjs` | Skleja `src/` w `dist/index.html`, generuje `dist/sw.js` |
| `tests/` | Testy `node:test` modelu, katalogu i i18n |

Kolejność skryptów w buildzie: `data.js → model.js → import.js → seed.js → i18n.js → app.js` (wspólny zakres globalny, jak w przeglądarce).

Service worker: pliki aplikacji **najpierw sieć, potem pamięć** (świeża wersja po wdrożeniu), czcionki Google **najpierw pamięć, w tle odświeżenie**.

## 3. Model danych (`S`, zapisywany w całości jako JSON)

```js
S = {
  v: 1,                         // wersja schematu
  lang: 'pl' | 'en',            // wspólny dla wszystkich nurków
  activeId: 'p-xxxxxx',         // id nurka, którego dane są na ekranie
  geo?: 'on' | 'off',           // zgoda na pytanie telefonu o pozycję (brak = jeszcze nie pytaliśmy)
  installSkip?: true,           // „Użyję w przeglądarce" — bramka instalacyjna już nie wraca
  tourDone?: true,              // samouczek już przeszedł — po kreatorze nie startuje drugi raz
  gateSeen?: true,              // instrukcja instalacji już się w tej przeglądarce pokazywała
  sites: [ { id, name, rho /*kg/l*/, ts: [12 × °C powierzchnia], tb: [12 × °C dno], preset?: bool,
             lat?, lon?, r? /*przybliżony środek rejonu i promień w km — do rozpoznania akwenu z GPS*/ } ],
  profiles: [ {                 // każdy nurek osobno (B3)
    id, onboarded /*false = kreator dopyta o profil*/,
    learnSince?: 'rrrr-mm-dd',  // nauka tylko z nurkowań od tej daty
    profile: { name, sex: 'M'|'K', age, height /*cm*/, weight /*kg*/,
               build: 'slim'|'athletic'|'muscular'|'average'|'fuller'|'obese',
               bf /*% tłuszczu lub ''*/, coldTol /*°C, + = odporny*/, divesBefore /*nurkowania poza dziennikiem*/ },
    wardrobe: [ { uid, catId /*id z CATALOG lub null*/, cat, brand, model, size, year|null,
                  rental?: bool, p: {/*parametry wg kategorii, kopia z katalogu, edytowalna*/}, src /*źródło wartości*/ } ],
    dives: [ { id, date, siteId, depth, time, tSurf, tBottom, nDay, reserve, items: [uid],
               lead /*kg*/|null, leadFb: 'light'|'ok'|'heavy'|null, leadAdj /*kg*/, thermal: 'cold'|'cool'|'ok'|'warm'|null, note,
               tMeasured?: bool /*temperatury z komputera — podpowiedź akwenu ich nie nadpisuje*/, gps?: {lat, lon},
               imported?: bool /*wczytane z pliku komputera*/ } ],
    plan: { siteId, date, depth, time, tSurf, tBottom, nDay, reserve, items: [uid] }
  } ]
}
```

**Akweny i język są wspólne, reszta należy do nurka.** W `app.js` aktywnego nurka zwraca `P()`, a `dst()` (czyli `diverState(S)` z `model.js`) składa dla modelu obiekt `{profile, wardrobe, dives, plan, sites}` — model nie wie o wielu profilach.

Migracje wykonuje `migrate()` w `seed.js`, wołane przy starcie (`load()`) **i przy imporcie kopii**, więc kopia zapasowa sprzed wielu profili wczytuje się poprawnie: stan jednego nurka (`S.profile`, `S.wardrobe`, `S.dives`, `S.plan`, `S.learnSince` w korzeniu) trafia do `S.profiles[0]` z `onboarded: true`. Tam też starsze migracje: `profile.dives → divesBefore`, oznaczenie `rental` po nazwie, płetwy z `misc` do `fins`. `migrate()` zwraca `null`, gdy to nie są dane tej aplikacji. **Każda zmiana schematu wymaga migracji w `migrate()`**; przy zmianie niekompatybilnej podbij `v` i napisz konwersję.

### Parametry `p` wg kategorii

| Kategoria (`cat`) | Pola `p` |
| --- | --- |
| `wetsuit`, `over`, `hood`, `gloves`, `boots` | `t` grubość tułowia mm, `tl?` kończyny mm, `cover` (`full`, `longjohn`, `shorty`, `overhood`, `vest`, `hood`, `gloves`, `boots`), `semi?`, `hood?`, `mass?` g (buty) |
| `dry` | `shell` (`trilam`, `membrane`, `crushed`, `neo`), `b` kg (dla nie-neoprenowych), `t` mm (dla `neo`) |
| `under` | `g` kg wyporności gazu dla BSA 1,9 m², `tmin` °C dolna granica komfortu |
| `bcd` | `b` kg wyporności w wodzie |
| `wing` | `plate` (`steel`, `alu`, `soft`; domyślnie `alu`), `b?` nadpisanie |
| `tank`, `stage` | `vol` l (sumaryczna), `n?` liczba butli w zestawie (etykieta), `mat` (`stal`, `alu`), `be` kg wyporność pusta w morzu 1,025 z zaworem, `vd` l objętość zewnętrzna |
| `fins` | `b` kg wyporność pary, `mass?` g pary |
| `misc` | `b` kg |

**Pozycja spoza szafy.** `plan.items` (i `dives[].items`) mogą zawierać uid w formie `cat:<id z CATALOG>` — sprzęt brany prosto z katalogu, bez kopiowania do szafy; używa tego szybki wybór butli na ekranie Oblicz i w formularzu nurkowania. `itemOf()`/`resolveItems()` w `model.js` rozwiązują takie uid przez `catalogItem()`. Model liczy je jak każdą inną pozycję, ale **nie są cechą w nauce** — korekty per sztuka wymagają historii nurkowań w tej konkretnej sztuce, a te ma tylko sprzęt z szafy.

**Każde pole `p` ma odbiorcę** — przegląd z września 2026 usunął te, których nikt nie czytał: `lift` skrzydeł (model liczy wyporność zestawu z płyty i pęcherza kamizelki, nie z udźwigu), `bar` butli (ciśnienie robocze nie wchodzi do wzoru — liczy się `vol` i rezerwa) oraz `mat` płetw (materiał siedzi już w `b`). `mass` płetw zostaje: nie wchodzi do wzoru, ale jest podstawą szacunku `b` i widać ją na liście.

Wybór w zestawie: jedna pozycja z `wetsuit`, `dry`, `under`, `tank`, `fins` oraz jedna z pary `bcd`/`wing`. Suchy skafander wyklucza pianki i ocieplacze mokre i odwrotnie. **`stage` jest wyjątkiem: nie ma go w `SINGLE`**, więc butli dekompresyjnych można wybrać kilka i **dokładają się do podstawowej, nie zamiast niej** — dlatego mają osobną kategorię, osobny rząd w wyborze butli i nie zaspokajają wymogu butli w `setIssues()`. Fizycznie liczą się tym samym wzorem co `tank` (`itemBuoy`), z tym samym założeniem o rezerwie.

**Twinsety** siedzą w kategorii `tank`, bo zastępują butlę podstawową. `p.n = 2` służy tylko do etykiety („Stal 2 × 12 l" zamiast mylącego „Stal 24 l"); `vol` jest sumaryczna, a `be` uwzględnia manifold i obejmy — pusty twinset ciągnie w dół mocniej niż dwie pojedyncze butle, co pilnuje test w `tests/model.test.js`.

## 4. Katalog sprzętu

171 pozycji w 13 kategoriach. Marki: Mares, Cressi, Scubapro, Fourth Element, Bare, Aqualung, Tusa, Scubatech, Santi, Avatar, XDEEP, Tecline, Apeks, Hollis oraz pozycje ogólne.

Pole `src` opisuje wiarygodność: `producent (…)`, `szacunek`, `szacunek z masy i materiału`, `grubość: producent; masa: szacunek`, `szacunek z wybranej płyty` (skrzydła). Producenci pianek, ocieplaczy i płetw nie publikują wyporności — dlatego katalog trzyma parametry fizyczne, a wyporność liczy model dla konkretnego nurka.

### Rozmiarówka (weryfikacja, wrzesień 2026)

Rozmiary są tylko informacją dla użytkownika — model ich nie czyta — ale mają się zgadzać z tym, co sprzedaje producent. Zestawy siedzą w `SZ` w `data.js`:

| Zestaw | Wartości | Dla kogo |
| --- | --- | --- |
| `mares` | 2–8 | pianki Mares (numeracja producenta) |
| `maresBoot` | `XS 38-39` … `3XL 45-46` | buty Mares — sklepy podają literę razem z EU ([underwater.pl](https://www.underwater.pl/2130-buty-nurkowe-mares-flexa-ds-5-mm.html)) |
| `maresFin` | `S`, `R`, `XL` | płetwy Mares z otwartą piętą, m.in. Avanti Quattro+ ([mares.com](https://www.mares.com/en_US/avanti-quattro-18)) |
| `finJet` | `S`–`2XL` | Scubapro Jet Fin |
| `finHollis` | `R`, `XL`, `2XL` | Hollis F1 i F1 LT — nie ma S ani M ([diverightinscuba.com](https://www.diverightinscuba.com/f1-tech-fin.html)) |
| `cressi` | `XS/1` … `XXXL/7` | **tylko pianki** Cressi; kamizelki, kaptury i rękawice tej marki mają zwykłe litery |
| `one` | `uniwersalny` | skrzydła (XDEEP, Tecline, Mares XR są jednorozmiarowe), butle, drobne, pozycje ogólne |

Rozmiar zapisany wcześniej zostaje na liście wyboru, nawet jeśli katalog zmienił oznaczenia — edytor dokłada go do `sizes`, żeby nie znikał ze sprzętu w szafie.

### Weryfikacja danych (B1, wrzesień 2026)

Sprawdzone u producenta i poprawione:

| Pozycja | Ustalenie | Źródło |
| --- | --- | --- |
| `mares-flexacore` | „100% Ultrastretch neoprene, predominantly in 3 mm, with strategic 4 mm inserts", kaptur zintegrowany — grubość 3 mm w modelu potwierdzona | [mares.com](https://www.mares.com/en_SE/flexa-core-412469) |
| `tusa-boots-5` | but Tusa to **Imprex** (DB-0101), 5,0 mm neopren, zamek boczny | [tusa.com](https://tusa.com/us-/TUSA/Boots/Imprex_(Dive_Boot)) |
| `tusa-boots-3` | wersja 3 mm to **Imprex Dive Slipper** (DB-0201), 3,0 mm, niskie wsuwane | [scuba.com](https://www.scuba.com/products/tusa-imprex-3mm-dive-slipper) |
| `tusa-libero` | „Libero II" **nie istnieje** w ofercie Tusa; odpowiednikiem jest **Crestline** (BC-0601) | [divers-supply.com](https://www.divers-supply.com/jacksonville/tusa-crestline-bcd.html) |
| `tusa-liberator` | nazwa **Liberator Sigma II** (BC-0101) potwierdzona | [tusa.com](https://tusa.com/us-en/Tusa/BCJs/BC0101B_LIBERATOR_SIGMA_II) |
| `fin-tusa-xpert` | aktualne oznaczenie modelu to **X-Pert Zoom Z3** | [tusa.com](https://tusa.com/us-en/TUSA/Fins) |
| `fin-mares-aq-plus` | masa pary Regular ≈ 1,7 kg — wartość w katalogu potwierdzona | [divegearexpress.com](https://www.divegearexpress.com/mares-avanti-quattro-plus-fins) |

Wszystkie 62 pozycje deklarujące „producent (grubość)" mają grubość w oznaczeniu modelu (np. `Flexa 5.4.3`, `Buty Imprex 5 mm`), czyli deklaracja pokrywa się ze specyfikacją producenta. Pilnuje tego test „katalog: uczciwe źródła i brak duplikatów nazw".

**Czego nie da się potwierdzić u producentów** (i dlatego zostaje szacunkiem): masy butów, wyporność płetw i wyporność własna kamizelek. Producenci publikują dla kamizelek wyłącznie **udźwig** (lift), a dla płetw ani masy w parze, ani wyporności. Jedyne dostępne liczby to pomiary nurków (np. Scubapro Jet Fin XL: 3,3 lb na płetwę na sucho, −0,6 lb wyporności w wodzie słodkiej — [ScubaBoard](https://scubaboard.com/community/threads/how-negatively-buoyant-are-scubapro-jet-fins.398241/)), zgodne co do rzędu wielkości z katalogiem, ale zbyt zależne od rozmiaru i pasków, żeby podawać je jako dane producenta.

## 5. Model balastu (`model.js`)

Punkt kontrolny: **5 m, koniec nurkowania, rezerwa w butli, pusta kamizelka, pół oddechu.** Wszystkie składniki w kg wyporności w wodzie (+ unosi).

```
L_woda = B_ciało + Σ B_sprzęt(d = 5 m) + μ_dośw + θ0 + Σ θ_j
L_suchy = L_woda / (1 − ρ_w / 11,34)     → zaokrąglenie w górę do 0,5 kg
```

- **Ciało:** % tłuszczu z BMI (Deurenberg: `1,2·BMI + 0,23·wiek − 10,8·[M] − 5,4 + k_budowa`, k: szczupła −3, wysportowana −6, umięśniona −10, przeciętna 0, pełniejsza +3, otyła +5) lub podany; gęstość (Siri); `B = m(ρ_w/ρ_ciała − 1) + V_płuc·ρ_w`, `V_płuc = (M 3,0 / K 2,5 l)·wzrost/175`.
- **Neopren:** `V = BSA(Du Bois) × pokrycie × grubość`, `B = V(ρ_w − 0,38)(1 − c(d))·k_wiek`, `c(d) = 0,6(1 − 1/(1 + d/10))`, `k_wiek`: ≤0 lat 1,0; 1–3 lata 0,9; >3 lata 0,8. Buty z masą: dodatkowo podeszwa `−0,00008 × masa[g]`.
- **Suchy:** skorupa `b` lub neopren 4 mm (kompresja ×0,5); ocieplacz `g × BSA/1,9 × ρ_w/1,025` (to gaz: ta sama objętość, inna gęstość wody).
- **Butla:** `be + vd(ρ_w − 1,025) − vol × rezerwa × 0,00123`.
- **Skrzydło:** `0,3 + płyta` (stal −1,9, alu −0,5, miękka +0,5) lub `b`.
- **Zasolenie (ρ_w z akwenu):** wyporności wpisane w katalogu w kilogramach obowiązują w **morzu 1,025** — to punkt kalibracji. W innej wodzie ta sama rzecz wypiera tyle samo litrów, ale inaczej przelicza się to na kilogramy, więc `B(ρ_w) = b + V(ρ_w − 1,025)` dla kategorii suchy, kamizelka, skrzydło, płetwy i drobne. Objętość `V`: `p.vd`, gdy podana (butle); `(masa[g]/1000 + b)/1,025`, gdy znamy masę (płetwy); w pozostałych typowa — suchy 4,5 l (zgnieciony neopren 8,5), kamizelka 4,5, skrzydło 4,0, płetwy 1,5, drobne 1,6. Ciało, neopren i butle liczą ρ_w wprost we własnych wzorach.
  Rząd wielkości: dla suchego zestawu (E.Lite+, BZ400X, Zeos 28, Quattro+, automat, stal 12 l) 3,5 kg w wodzie słodkiej, 4,0 w Bałtyku i 7,0 w Morzu Czerwonym. Poprawka za zasolenie samych tych pięciu kategorii to około 0,5 kg między słodką a morzem — dokładnie jeden krok zaokrąglenia, więc pomijanie jej było widoczne.
- **Doświadczenie** (`divesBefore` + nurkowania w dzienniku): <25 → μ +1,0 kg, σ 2,5; 25–99 → +0,5, σ 2,0; 100–299 → 0, σ 1,6; ≥300 → −0,5, σ 1,4. Użytkownik nie podaje liczby nurkowań, tylko klika poziom; kafelek zapisuje `divesBefore = max(0, dolna granica poziomu − liczba nurkowań w dzienniku)`, więc **poziom podnosi się sam**, gdy dziennik urośnie ponad próg.
- **Uczenie:** regresja grzbietowa. Cel `y = ołów_idealny_w_wodzie − fizyka − μ`, gdzie ołów idealny = użyty ± `leadAdj` wg oceny. Cechy: wyraz wolny θ0 (prior N(0, σ_dośw²)) + wskaźnik każdej sztuki sprzętu (prior σ wg kategorii: pianka/ocieplacz 0,8, suchy 1,0, ocieplacz do suchego 1,2, kamizelka/skrzydło 0,5, butla 0,4, płetwy 0,3, kaptur 0,3, rękawice/buty 0,2). Szum σ = 0,7 kg. Waga nurkowania `0,5^(ranga/30)` (najnowsze najważniejsze). Przedział 80%: `±1,28·√(xᵀΣx + 0,25)`.
- Nauka pomija nurkowania bez `leadFb` lub bez `lead`, oraz sprzed `learnSince`.

Gęstości akwenów (`rho`, `WATER_TYPES`): Morze Czerwone 1,029 (≈40‰), Morze Śródziemne i Adriatyk 1,028 (≈38‰), ocean 1,025 (35‰), Bałtyk 1,005 (≈7‰), woda słodka 1,000. Wartość jest polem akwenu i zmienia się ją w Akwenach; karta „Balast" pokazuje ją obok nazwy akwenu, żeby było widać, skąd bierze się różnica między jeziorem a morzem.

## 6. Model ocieplenia

- **Temperatura nurkowania:** `T = 0,75·T_dno + 0,25·T_pow − max(0, (czas − 45)/15) − (nr_nurkowania_dnia − 1)`.
- **Grubość równoważna (mokre):** `Σ t × udział_tułowia(krój) × (1,15 jeśli półsucha)`, skorygowana kompresją względem typowego nurkowania: `× (1 − 0,5·c(d_śr)) / (1 − 0,5·c(7,5 m))`, `d_śr = głębokość_maks/2`, plus 1 mm za kaptur.
- **Komfort zestawu** (dla przeciętnego nurka), interpolacja: 1 mm → 26 °C, 3 → 22, 5 → 17, 7 → 12, 9 → 9, 11 → 7 (wg tabel sklepów nurkowych). Suchy: `tmin` ocieplacza (bez ocieplacza: trylaminat 20, neopren 14, zgnieciony 15), −0,5 °C z rękawicami.
- **Tolerancja osobista** `Δ = coldTol + Δ_nauka`; komfort nurka = komfort zestawu − Δ. Werdykt: zapas `T − komfort_nurka` ≥ 1 → „Wystarczy”, 0–1 → „Na granicy”, < 0 → „Za zimno”.
- **Nauka Δ:** dla każdej oceny zapas `m0` porównany z przedziałem oceny (zimno ≤ −2, chłodno −2…0, OK ≥ 0, za ciepło ≥ 4); informatywne tylko oceny poza przedziałem; `Δ_nauka = Σ korekt / (n + 1,5)`.
- **Doradca:** przegląda kombinacje z **własnego** sprzętu (bez `rental`): pianka × ocieplacz × kaptur oraz suchy × ocieplacz. Pokazuje do 3 najlżejszych wystarczających (sort: najwyższy komfort, potem najmniej ołowiu), a gdy żadna nie wystarcza — 3 najcieplejsze. Podświetlony jest tylko zestaw identyczny z wybranym.

## 7. Ekrany

0. **Kreator profilu (obowiązkowy)** — pokazuje się zamiast zakładek, gdy aktywny nurek ma `onboarded: false`: pierwsze uruchomienie, po „Wyczyść wszystkie dane" i po dodaniu nurka. Dolna nawigacja jest wtedy ukryta. Kroki: powitanie z wyborem języka, 1. imię, płeć, wiek; 2. wzrost, waga, budowa, opcjonalny % tłuszczu z podglądem wyporności ciała; 3. poziom doświadczenia i tolerancja zimna; 4. **sprzęt, kategoria po kategorii**. Krok 2 nie przepuszcza dalej bez sensownego wieku, wzrostu i wagi, a krok 4 prowadzi przez siedem kategorii (`WIZ_CATS`) w kolejności, w jakiej nurek się ubiera: skafander → ocieplacze → kaptur, rękawice, buty → kamizelka albo skrzydło → płetwy → butla → reszta. Każda ma własny ekran z wyszukiwarką zawężoną do swoich kategorii (`catalogPicker(cats)` — bez listy kategorii, bo tę wyznacza krok) i przyciskiem **Dalej** albo **Pomiń**. Nawigacja stoi **nad** wyszukiwarką: lista bywa długa, a pominięcie kategorii nie może wymagać przewijania przez pięćdziesiąt pianek. Pozycję własną dodaje się samym przyciskiem w kolorze akcentu (`button.alt`) — po jednym na kategorię kroku, bo rodzaj wynika z kroku; rozwijana lista rodzajów zostaje tylko w Szafie, gdzie widać cały katalog. **Wymagane są dwie**: skafander oraz kamizelka/skrzydło; butla wymagana nie jest, bo na ekranie Oblicz wybiera się ją jednym tapnięciem spośród standardowych. Dodane pozycje lądują w osobnej karcie **Moja szafa** pod spodem — dodawanie i przeglądanie są rozdzielone wizualnie, a edytor otwiera się dopiero z przycisku „Edytuj”, żeby nie przerywał przechodzenia kategorii. Ostatni krok zapisuje zadeklarowany sprzęt wprost do zestawu (`toggleItem`). Pierwsze uruchomienie startuje z `freshState()` — pusty nurek, w szafie sam automat; przykładowy nurek (`seedState()`) został tylko pod „Wczytaj przykład” w Profilu. **Kreatora nie można pominąć ani obejść** — bez danych ciała nie da się policzyć wyporności. Powitanie nie proponuje już wczytania przykładowego nurka: na pierwszym uruchomieniu cudzy profil niczego nie wyjaśnia, a podstawia dane, które i tak trzeba zaraz zastąpić. Przykładowy nurek został tam, gdzie ma sens — w Profilu, obok czyszczenia danych.

**Wybór zamiast wpisywania.** Płeć, wiek, budowa, tolerancja zimna, doświadczenie i język to kafelki z grafiką (`tiles()`, klasy `.picks`/`.pick`), a wzrost i waga to suwaki — z polem liczbowym obok, więc wartość można też wpisać z klawiatury numerycznej (`inputmode="decimal"`); suwak i pole trzymają tę samą wartość, a po wyjściu z pola obowiązuje zakres suwaka. **Suwak chodzi co 2,5 cm i 2,5 kg** — palcem i tak nikt nie trafi precyzyjniej, a większy skok znaczy mniej przypadkowych zmian. Pole liczbowe ma za to `step="any"`, więc wpisać można dowolną wartość (73,4 kg zostaje 73,4 kg). Jedyny koszt: przy wartości spoza siatki suwak stawia uchwyt na najbliższym wielokrotności 2,5 — dokładną liczbę zawsze pokazuje pole obok. Do wpisania zostają tylko imię i opcjonalny % tłuszczu. Te same komponenty obsługują kreator i zakładkę Profil, więc jedna zmiana działa w obu miejscach.

Edycja profilu **nie przebudowuje widoku**: suwak i pola tekstowe zapisują stan i odświeżają wyłącznie `#body-out` (`refreshBody()`), a ten ma stałą wysokość (`.kv.fixed`). Inaczej przycisk „Dalej" uciekał spod palca — `blur → change → render()` podmieniał DOM między naciśnięciem a puszczeniem i kliknięcie przepadało.

1. **Oblicz:** przypięty pasek (ołów + zakres, przycisk **wyjaśnij** `?`, skrót zestawu, woda, komfort, werdykt) — nie przewija się. **Bez butli i bez kamizelki albo skrzydła ołowiu nie pokazujemy w ogóle**: zamiast liczby stoi kreska i zdanie „Dodaj butlę — bez tego nie policzę ołowiu", znika przycisk `?`, karta **Balast** zastępuje wykresy tym samym komunikatem, doradca ocieplenia przestaje podawać ołów przy propozycjach, a szkic nurkowania nie podpowiada wartości (`setIssues()`, `SET_NEED`). Butla i kamizelka dźwigają największą część bilansu wyporności — liczba bez nich zmieniłaby się o kilka kilogramów, a nurek zapamiętałby tę pierwszą. Karty w kolejności: **Planowane nurkowanie** — tylko cztery pola, które realnie zmieniają wynik: akwen z wyszukiwaniem po pierwszych literach, **miesiąc jako kafelki** (12 skrótów, jedno tapnięcie), głębokość maks. i temperatura dna; zaraz pod nią przycisk zapisu po nurkowaniu, bo to następny krok po tej samej karcie; dalej **Ocieplenie** (werdykt i doradca od razu, rozbicie temperatury nurkowania pod przyciskiem `?` w nagłówku — `ui.thermInfo`) i **Zestaw** (chipy + szybkie dodawanie: kupiony/wypożyczony, katalog, pozycja ogólna, edytor) wraz z rzędem **standardowych butli** wybieranych jednym tapnięciem, bez wpisywania czegokolwiek do szafy. Skąd bierze się liczba ołowiu — karty **Balast** (skala z przedziałem, rozkład ołowiu, przypomnienie o kontroli na 5 m) i **Skąd ta liczba** (wykres rozbieżny składników) — pokazuje dopiero przycisk `?` w pasku (`ui.explain`), który po rozwinięciu przewija do nich. 
**Dlaczego w planie jest miesiąc, a nie data.** Plan potrzebuje daty wyłącznie po to, żeby wziąć z akwenu temperatury na ten miesiąc — dzień nie zmienia niczego w wyniku. Pole `rrrr-mm-dd` z ikoną kalendarza okazało się przy tym najbardziej zawodnym elementem ekranu na telefonie, więc na Oblicz zastąpiły je kafelki miesięcy (`set-month`; akcja nie może nazywać się `pick-…`, bo tamten prefiks obsługuje kafelki profilu). Kafelek zapisuje `plan.date` jako pierwszy dzień wybranego miesiąca, zachowując dotychczasowy rok, i od razu woła `fillTemps()`.

**Pełna data zostaje w dzienniku**, gdzie liczy się dzień: formularz nurkowania (`planFields(pl, pre, true)`) ma pole `rrrr-mm-dd` i ikonę kalendarza obsługiwaną na `pointerdown` z `preventDefault()`, żeby dotknięcie po wpisaniu daty nie przepadło przez przebudowę widoku. Nurkowanie zakładane przyciskiem „Po nurkowaniu" dostaje **dzisiejszą datę**, bo plan niesie już tylko miesiąc.

### Samouczek na żywym ekranie

Po kreatorze (`finishWizard`, z opóźnieniem 400 ms) rusza siedmiokrokowe oprowadzanie: pasek z wynikiem → karta planu → ocieplenie → zestaw → „Po nurkowaniu: zapisz i oceń" → „Wczytaj z komputera" w Dzienniku → dolna nawigacja. Dwa kroki o nauce modelu stoją obok siebie nie bez powodu: piąty mówi, że oceny wiążą się z **konkretnym sprzętem** (ile ołowiu potrzebuje ten nurek, która pianka wystarcza właśnie jemu), a szósty — że dane z komputera wypełnią datę, głębokość, czas i temperatury, ale sprzęt, ołów i komfort trzeba dodać samemu, bo tego żaden komputer nie zapisuje. Nie ma zrzutów ekranu ani osobnego widoku — **podświetlamy prawdziwe elementy** na danych nurka: `.tour-hole` to `position: fixed` z `box-shadow: 0 0 0 9999px` przyciemniającym resztę, a `.tour-box` to dymek stawiany nad albo pod celem. Cel wyższy niż pół ekranu (karta planu, karta zestawu) i tak nie zmieści dymka obok, więc wtedy dymek siada nad nawigacją — inaczej zasłaniałby to, o czym właśnie opowiada.

Trzy rzeczy, które trzeba pamiętać przy zmianach:

- **`#tour` żyje poza `#view`**, bo `render()` podmienia całe wnętrze widoku. Ma własny nasłuch kliknięć — główny go nie obejmuje.
- **Kroki celują selektorami** (`#summary .sb`, `#plan-card`, `#thermal-card`, `#set-card`, `[data-act="log-from-plan"]`, `nav.tabs`). Zmiana struktury tych kart wymaga poprawienia `TOUR`; krok bez celu jest po cichu pomijany, więc zepsuty selektor nie wywali aplikacji, tylko zgubi krok.
- **Pozycje liczymy z `getBoundingClientRect()`** przy każdym kroku i przy `resize`, bo dymek przypięty na sztywno rozjeżdża się po obrocie telefonu.

Koniec samouczka — „Zaczynamy", „Pomiń" i Escape tak samo — wraca na **Oblicz** i przewija na górę, bo szósty krok zostawia nurka w Dzienniku, a zacząć ma od liczenia. `S.tourDone` pilnuje, żeby samouczek poszedł raz — także wtedy, gdy ktoś doda drugiego nurka. Powtórzyć go można z Profilu („Samouczek → Pokaż jeszcze raz"). Na telefonie w przeglądarce pierwszeństwo ma bramka instalacyjna (`gateOn()`), więc samouczek poczeka do instalacji.

### Założenia planu zamiast pól

Czas, numer nurkowania dnia, rezerwa i temperatura powierzchni **nie mają pól w planie** — zostają w danych z ostrożnymi założeniami, bo plan ma być szybki do ustawienia:

| Wartość | Założenie | Dlaczego |
| --- | --- | --- |
| Nurkowanie dnia nr | **2** | typowy dzień to 2–3 nurkowania, a kolejne wychładza (−1 °C) — komfort liczony ostrożniej |
| Czas | 50 min | tyle trwa typowe nurkowanie rekreacyjne |
| Rezerwa | 50 bar | punkt kontrolny balastu i tak zakłada rezerwę |
| Temp. powierzchni | z presetu akwenu na wybrany miesiąc | waży tylko 25% temperatury nurkowania, więc rzadko zmienia werdykt |

Karta planu trzyma te założenia pod przyciskiem **`?`** w nagłówku (`ui.planInfo`) — domyślnie nie zabierają miejsca, ale jednym tapnięciem widać, skąd bierze się wynik. `migrate()` normalizuje je w planie (rezerwa 50, `nDay` co najmniej 2), bo nie ma już UI, w którym dałoby się je zmienić. Wszystkie cztery są za to **opcjonalne w formularzu nurkowania** — w zwijanej sekcji „Szczegóły (opcjonalnie)" (`planFields(pl, pre, true)`), bo tam zapisuje się rzeczywistość, a nie plan.

2. **Dziennik:** lista (najnowsze pierwsze) i formularz nurkowania w kolejności wpisywania po wyjściu z wody: **dane nurkowania** (to, co pokazuje komputer, plus zwijane szczegóły: czas, kolejność, temperatura powierzchni, rezerwa), **balast** z oceną, **komfort cieplny** z notatką, a na końcu **użyty zestaw** — sprzęt zwykle nie zmienia się między nurkowaniami, więc nie zasłania tego, co trzeba poprawić.
3. **Szafa:** mój sprzęt z wypornością na 5 m w morzu i nauczoną korektą; edytor; katalog z wyszukiwaniem (`catalogPicker()`, ten sam co w kreatorze).

**Co wolno zmienić w pozycji z katalogu.** Tylko to, co zależy od egzemplarza: **własność** (przyciski Mój / Wypożyczony), **rozmiar** (kafelki z rozmiarówki producenta; pozycje jednorozmiarowe — skrzydła, butle, drobne — nie mają tego pola w ogóle) i **rok zakupu** — ten ostatni tylko dla własnego sprzętu, bo wypożyczony jest z półki wypożyczalni i przełączenie na „Wypożyczony" czyści rok. Grubość, krój, wyporność i reszta `p` pochodzą od producenta i nie mają tu pól; kto ma sprzęt inny niż katalogowy, dodaje **pozycję własną** — ta ma pełny edytor z nazwą i wszystkimi parametrami. Dzięki temu nikt nie „poprawia" katalogu przypadkiem, a `src` pozostaje prawdziwe.
4. **Akweny:** presety i własne; gęstość wody i 12 miesięcy temperatur.
5. **Profil:** te same kafelki i suwaki co w kreatorze (język z flagami, płeć, wiek w 5 zakresach, wzrost i waga suwakami, budowa jako sylwetki, tolerancja zimna w 5 stopniach z wartością w °C, doświadczenie w 4 poziomach), karta **Nurkowie** (lista z liczbą nurkowań i sprzętu, przełączanie, dodanie nurka przez kreator, usunięcie z potwierdzeniem — ostatniego nurka nie da się usunąć), język, dane ciała, tolerancja zimna, nurkowania poza dziennikiem, czego nauczył się model, reset nauki, kopia zapasowa (zapis i odczyt pliku `.json`, bez pokazywania danych na ekranie), czyszczenie, wczytanie przykładu.

Na dole Profilu stoi jedna linijka: nazwa aplikacji i **© Maciej Korzeniowski** z bieżącym rokiem (`.credit`). Tylko tam — to miejsce „o aplikacji", a nie coś, co ma towarzyszyć liczeniu balastu.

Przełącznik nurków siedzi w nagłówku (`#who`) i pojawia się dopiero przy co najmniej dwóch profilach; przy jednym nagłówek pokazuje licznik nurkowań jak dotąd.

### Wczytanie nurkowania z komputera

`parseSuuntoJson()` w `src/import.js` czyta plik `.json` z aplikacji Suunto (Ocean, Nautic, Nautic S — jeden plik to jedno nurkowanie) i wypełnia szkic nurkowania: datę, głębokość maks. (`Header.Depth.Max`), czas (`Header.DiveTime` w sekundach, nie `Duration` — ta liczy też powierzchnię) oraz temperatury.

Dwie rzeczy, których nie widać bez prawdziwego pliku:

- **nazwy w `Header.Temperature` bywają zamienione** — `Max` potrafi być chłodniejsze niż `Min` — więc nie ufamy nazwom, tylko bierzemy skrajne wartości (najcieplej = powierzchnia, najzimniej = dno), najchętniej z próbek;
- **`Latitude`/`Longitude` są w radianach**, nie w stopniach.

Szkic z importu dostaje `imported`, przez co formularz otwiera się z banerem mówiącym wprost, czego modelowi brakuje: sprzętu, ołowiu z oceną i komfortu cieplnego. W dzienniku nurkowanie bez ołowiu albo bez oceny balastu ma plakietkę „bez oceny balastu", a nad listą jest przypomnienie, że takie wpisy nie uczą modelu — uzupełnia się je przyciskiem Edytuj.

**Bramka instalacyjna.** Na telefonie otwartym w przeglądarce (`IOS || ANDROID`, bez `display-mode: standalone` i bez `navigator.standalone`) zamiast zakładek pokazuje się `viewGate()`: po co instalować i jak to zrobić. Bramka jest **miękka** — „Użyję w przeglądarce" ustawia `S.installSkip` i więcej nie wraca, a wrócić do instrukcji można z Profilu („Na ekranie telefonu" → `gate-show`). Kroki zależą od tego, gdzie aplikacja stoi:

| Gdzie | Co pokazujemy |
| --- | --- |
| Android | przycisk **Zainstaluj**, gdy przeglądarka dała `beforeinstallprompt`; zawsze też kroki przez menu ⋮ |
| iOS (Safari) | Udostępnij → „Do ekranu początkowego" → Dodaj |
| przeglądarka w aplikacji (Facebook, Instagram, …) | najpierw „Otwórz w Safari/Chrome" — tam „dodaj do ekranu" w ogóle nie istnieje |

**„Masz ją już na ekranie".** Gdy aplikacja jest zainstalowana, a ktoś otworzy adres w przeglądarce, bramka nie namawia do instalacji, tylko odsyła do ikony — bo **na iOS w przeglądarce nie widać danych z aplikacji** (i odwrotnie). Skąd wiemy, że jest zainstalowana:

- **Android:** `navigator.getInstalledRelatedApps()` (Chrome 84+) odpowiada wprost. Wymaga wpisu o sobie samej w manifeście (`related_applications: [{platform:'webapp', url:'manifest.webmanifest'}]` oraz `id`); wpis jest względny, więc na pulpitach, gdzie API wymaga bezwzględnego `id`, detekcja nie zadziała — i nie musi, bo bramki tam nie ma.
- **iOS:** żadne API tego nie zdradza, zostaje poszlaka. `S.gateSeen` zapisuje, że instrukcja już się tu pokazywała; przy kolejnym wejściu **bez żadnych danych w tej przeglądarce** przyjmujemy, że nurek zainstalował aplikację i używa jej z ekranu. Komunikat mówi to jako przypuszczenie, a przycisk „Nie mam jej — pokaż, jak dodać" (`ui.gateSteps`) wraca do instrukcji, więc pomyłka nic nie kosztuje.

Na Androidzie zainstalowana aplikacja dzieli magazyn z przeglądarką, więc tam ten sam komunikat mówi tylko o wygodzie i pracy offline — nie o utracie danych, bo żadnej nie ma.

**Po instalacji: wróć do ikony.** Android zgłasza instalację zdarzeniem `appinstalled` — bramka zamienia wtedy instrukcję na „Gotowe — ikona jest na ekranie" z prośbą o zamknięcie karty. iOS takiego zdarzenia nie ma, więc tę samą myśl mówimy z góry, pod krokami instalacji. W obu przypadkach pokazujemy **podgląd ikony** (`homeIcon()`: `icons/icon-192.png` z podpisem „Balast", czyli `short_name` z manifestu) — bo „otwórz z ekranu" jest bezużyteczne, dopóki nurek nie wie, czego szuka wśród kilkudziesięciu ikon. Ten sam podgląd wchodzi do wariantu „Otwórz z ekranu telefonu".

**Na iOS instalacja nie zabiera danych.** Aplikacja z ekranu początkowego ma magazyn odrębny od Safari — `localStorage`, ciasteczka i service worker nie są współdzielone. Dlatego bramka pojawia się od razu, zanim ktoś zacznie wypełniać kreator, a nurkowi, który **ma już dane** (`hasData()`), pokazuje najpierw przycisk zapisu kopii zapasowej wraz z wyjaśnieniem, że po instalacji trzeba ją wczytać. Bez tego sami wyprodukowalibyśmy zgłoszenia „aplikacja skasowała mi wszystko".

**Akwen z lokalizacji telefonu.** Na karcie planu aplikacja pyta raz: „Ustawiać akwen po Twojej lokalizacji?". Odpowiedź siedzi w `S.geo` (`'on'` / `'off'`; brak = jeszcze nie pytaliśmy), a odmowa w samym telefonie też zapisuje `'off'`, żeby nie pytać w kółko. Po zgodzie zostaje sam przycisk **„Najbliższy”** — **w rzędzie etykiety „Akwen”, po prawej**, a nie pod kartą: to skrót do wypełnienia tego jednego pola, więc stoi przy nim, a nie kilka pól niżej. Jednorazowe pytanie o zgodę zostaje na dole, bo niesie wyjaśnienie, co dzieje się z pozycją. Formularz nurkowania używa tego samego `siteCombo()`, ale bez przycisku (argument `geo` dostaje tylko plan): tam akwen przychodzi z importu albo z planu. **Lista akwenów też się układa pod pozycję.** Gdy aplikacja zna pozycję (`lastPos` — tylko w pamięci karty, nigdy w `S`), pole wyboru akwenu pokazuje akweny **od najbliższego**, z odległością przy nazwie; po wpisaniu tekstu wraca kolejność katalogowa, bo kto szuka po nazwie, ten wie, czego chce.

Przy `'on'` `locateSite()` pyta `navigator.geolocation` przy starcie aplikacji i po tapnięciu „Najbliższy akwen", po czym wybiera **najbliższy akwen zwykłym dystansem** (`nearestSite()`, do 500 km) i mówi, który i z jakiej odległości.

**Dlaczego inną regułą niż import.** To dwa różne pytania. Pozycja z komputera pada nad samym akwenem, więc liczy się, **w którym rejonie jest** (`matchSite()`, `km / r`). Przycisk naciska nurek w domu albo w drodze, więc liczy się, **co ma najbliżej** — zasięg rejonu jest tu bez znaczenia. Zgłoszone z Warszawy: Deepspot leży 45 km stąd, ale poza swoim ośmiokilometrowym promieniem, a promień Bałtyku (400 km) obejmuje pół Polski — reguła rejonowa wybierała więc Bałtyk. Obie reguły mają własne testy, żeby nikt ich kiedyś nie scalił z powrotem w jedną. **Pozycja nie jest nigdzie zapisywana ani wysyłana** — służy wyłącznie do porównania z listą akwenów, która i tak leży w telefonie.

**Ikony własności w zestawie.** Chipy zestawu niosą ikonę: domek = mój, wózek = wypożyczony (`bareName()` ucina wtedy dopisek „(wypożyczony)" z nazwy). Legenda pokazuje się tylko wtedy, gdy w szafie jest choć jedna pozycja z wypożyczalni.

**Akwen z pozycji GPS.** Preset opisuje **listę nurkowisk**: `pts: [[szerokość, długość, promień?], …]`, bez ograniczenia liczby punktów. **Promień jest na punkt**, bo zatoka bywa rozległa, a kamieniołom ma kilkaset metrów; `r` akwenu to tylko wartość domyślna dla punktów, które własnego nie podały. Akwen punktowy (kamieniołom, basen) ma sam `lat`/`lon` i promień 3–4 km. Odległość do akwenu to odległość do **najbliższego z jego punktów** (`siteDistKm()`), bo nurkowiska leżą wzdłuż wybrzeża, a nie w kole wokół jego środka. Dzięki temu zasięgi zeszły z setek kilometrów do kilkunastu: Bałtyk to czternaście nurkowisk od Świnoujścia po Zatokę Pucką, każde z własnym promieniem 10–20 km, zamiast koła 400 km wokół środka morza — a z Gdyni jest do niego **2 km** zamiast 180. Dahab ma sześć punktów po 3–4 km (Blue Hole, Canyon, Lighthouse…), Chorwacja trzynaście wzdłuż wybrzeża. Dokładanie punktów jest tanie i zawsze poprawia dopasowanie: `siteHit()` bierze najlepszy z nich. Współrzędne są przybliżone (~1 km) i tak też je traktujemy. `matchSite()` liczy odległość po wielkim kole i wybiera akwen o **najmniejszym ilorazie `km / r`**, czyli ten, w którego zasięgu pozycja siedzi najgłębiej; przy braku trafienia akwen zostaje bez zmian, a pozycja jest tylko pokazana. Porównywanie samych kilometrów nie działało: nurkowanie w Honoratce (52,3402 N 18,2686 E) trafiało na „Bałtyk" 278 km dalej, bo jego promień 400 km obejmuje pół Polski, a kamieniołom nie mieścił się w swoim ośmiokilometrowym, skoro preset miał współrzędne o 12 km obok. Jedno i drugie jest poprawione, a pozycja z tamtego pliku jest w testach. Akweny dopisane ręcznie nie mają współrzędnych, więc nie biorą udziału. Z polskich akwenów preset zna Hańczę, Zakrzówek (Kraków), Koparki (Jaworzno), Piechcin, Honoratkę, Jezioro Tarnobrzeskie, Jezioro Piłakno (Mazury) i Deepspot; wszystkie są punktowe (promień 3–4 km), bo kamieniołom albo jezioro mieści się w kole. Zakrzówek leży w granicach Krakowa, więc to on, a nie Jaworzno, wychodzi jako najbliższy akwen z miasta — jest na to test. Formularz zawsze mówi, co się stało („Akwen rozpoznany z pozycji … 139 km od środka rejonu — zmień, jeśli nie ten"), bo rejon to nie punkt i pomyłka jest możliwa. Współrzędnych nie da się edytować w aplikacji, więc `migrate()` bierze je zawsze z presetu po `id` — zapisane kopie dostają i brakujące, i poprawione wartości.

Temperatury z komputera oznaczamy `tMeasured`, dzięki czemu zmiana akwenu albo daty ich nie nadpisze. Numer nurkowania dnia liczymy z dziennika, a podobne nurkowanie (ta sama data, głębokość ±0,6 m, czas ±3 min) daje ostrzeżenie zamiast cichego duplikatu. **Ołów i ocena ciepła zostają puste** — komputer ich nie zapisuje, a to z nich uczy się model. Pozycję GPS pokazujemy jako podpowiedź; akwen użytkownik wybiera sam.

Plik ma zwykle ~1 MB (głównie próbki), ale do stanu trafia sam wynik — próbki są odrzucane.

### Liczby wpisywane kciukiem

Głębokość, czas, numer nurkowania dnia, obie temperatury, rezerwa i ołów w dzienniku to pola z przyciskami **−/+** (`stepField()`, klasa `.step`) z krokiem dobranym do wielkości: 1 m, 5 min, 1 °C, 10 bar, 0,5 kg. Wpisanie z klawiatury numerycznej działa jak wcześniej.

Przyciski działają na `pointerdown` z `preventDefault()`, a **zmiana liczby nie przebudowuje widoku** — odświeżane są tylko wyniki pochodne (`refreshPlanDerived()`: pasek podsumowania, karta Ocieplenie w `#thermal-box`, szczegóły balastu w `#lead-box`). Pełny `render()` zostaje tylko dla zmiany daty i akwenu, bo te podmieniają wartości w polach temperatur. Dzięki temu pierwsze tapnięcie w dowolny przycisk po wpisaniu wartości nie przepada (wcześniej `blur → change → render()` podmieniał DOM między naciśnięciem a puszczeniem palca).

### Pisanie przy otwartej klawiaturze

Na telefonie klawiatura zabiera ponad połowę ekranu, a przypięty pasek i dolna nawigacja zjadały resztę — nie było widać ani wpisywanego tekstu, ani listy podpowiedzi akwenu. Gdy fokus wchodzi w pole tekstowe **i** widoczny obszar jest niski (`visualViewport` skurczył się o ponad 140 px, jak na iOS, albo wysokość okna spadła poniżej 600 px, jak na Androidzie), `body` dostaje klasę `kb`: znika dolna nawigacja i pasek podsumowania, nagłówek przestaje być przypięty, a pole przewija się na górę ekranu. Lista podpowiedzi jest ograniczona do `min(260px, 40vh)`, żeby mieściła się nad klawiaturą; przewijane jest całe pole z podpisem (`.fieldset`/`.f`), z 10 px zapasu od górnej krawędzi. Po wyjściu z pola wszystko wraca. Na desktopie klasa nigdy się nie włącza.

**Przełącznik języka.** Przycisk w prawym górnym rogu pokazuje **flagę języka, na który przełącza** (w polskiej wersji brytyjską, w angielskiej polską) — to ten sam `FLAG`, którego kreator używa na kafelkach języka. Nazwa dla czytnika ekranu i `title` mówią to samo słowami, bo flaga sama w sobie nic nie mówi na głos. Przycisk trzyma 32 px szerokości: nagłówek „Balast & Ocieplenie” mieści się na 390 px co do piksela, więc szerszy przycisk ucinał tytuł wielokropkiem.

**Motyw.** `S.theme` trzyma `'auto'` (domyślnie), `'light'` albo `'dark'`; kafelki stoją w **dwóch miejscach, zawsze pod językiem**: na powitalnym kroku kreatora (żeby dało się je ustawić od razu, na czystych danych, zanim pojawi się cokolwiek innego) i w Profilu, do późniejszej zmiany. To ustawienie urządzenia, nie nurka — jak język, jest wspólne dla wszystkich profili. `'auto'` **nie ustawia atrybutu** i zostawia decyzję media query `prefers-color-scheme`; wymuszenie ustawia `data-theme` na `<html>`, a arkusz rozpoznaje oba kierunki: `:root[data-theme="dark"]` wymusza ciemny, a `:root:not([data-theme="light"])` w bloku `@media (prefers-color-scheme: dark)` pozwala jasnemu przebić ciemny telefon. `applyTheme()` chodzi przy starcie **przed pierwszym renderem** (inaczej ciemna aplikacja mrugnęłaby jasnym) i przy każdym `render()`, a przy `'auto'` także na zmianę ustawienia telefonu. Aktualizuje też `<meta name="theme-color">` (`#0E2227` / `#E9EFEE`), żeby pasek stanu nie został jasny nad ciemną aplikacją. `migrate()` normalizuje pole: brak i wartość spoza listy znaczą `'auto'`.

## 8. Wygląd

Komponenty wyboru: `.picks` (siatka kafelków, wariant `.two` na dwie kolumny i `.rows` na pozycje pełnowierszowe), `.pick` (ikona SVG + podpis + wartość), `.slider` (suwak z odczytem). Ikony rysują `ICON`, `bodyIcon()` i `barsIcon()` w `app.js` — kontur `currentColor`, 24 × 24, bez zewnętrznych plików. Werdykty cieplne i oceny w dzienniku mają symbole: ✓ wystarczy, fala na granicy, płatek śniegu zimno, termometr chłodno, płomień za ciepło.

Tokeny w `:root` (jasny) i nadpisanie dla ciemnego (`prefers-color-scheme` oraz `[data-theme="dark"]`). Kolory: tło #E9EFEE, powierzchnia #FFF, tusz #10262B, akcent (ołów) #D4521B, morski #1B6A71. Czcionki: Barlow Condensed (nagłówki, liczby), Source Sans 3 (tekst), JetBrains Mono (dane) z systemowymi zapasami. Szerokość maks. 600 px, margines boczny 16 px, bez przewijania w poziomie.

## 9. Jakość

- `npm test` — testy modelu, katalogu i kompletności tłumaczeń. Muszą przechodzić przed każdym commitem.
- Przy zmianie modelu dopisz test z konkretną liczbą (np. komfort pianki, wynik balastu dla znanego przypadku).
- Ręcznie w przeglądarce (szerokość ~390 px): pasek przypięty, brak poziomego przewijania, oba języki, tryb ciemny, działanie offline po instalacji.

## 10. Prawa i ślady autorstwa

Licencja jest zastrzeżona (`LICENSE`, dwujęzycznie): kod wolno czytać, nie wolno kopiować ani przepisywać bez pisemnej zgody, a katalog sprzętu jest dodatkowo bazą danych chronioną prawem sui generis. Ślad autorstwa jedzie w trzech miejscach, bo każde trafia do kogoś innego:

| Gdzie | Co niesie | Dla kogo |
| --- | --- | --- |
| nagłówki w `src/*.js` | dwie linijki o prawach | ten, kto czyta repozytorium |
| baner w `dist/index.html` i `dist/sw.js` (wstawia `build.mjs`) | pełne warunki + link do LICENSE | ten, kto otworzy „pokaż źródło" na gotowej stronie |
| `public/robots.txt` | brak zgody na trenowanie modeli | roboty, które to honorują |

**Czego to nie robi.** `robots.txt`, `<meta name="robots" content="noai">` i baner nie są zabezpieczeniem technicznym — aplikacja jest statyczną stroną, więc cały kod i tak trafia do przeglądarki każdego użytkownika. To sygnały i dowody: robią z ewentualnej kopii jednoznaczne naruszenie zamiast szarej strefy, co wystarcza do zgłoszenia do hostingu czy sklepu z aplikacjami. Instrukcje wpisane „dla agentów AI" nie wiążą cudzego narzędzia — wygrywa polecenie jego operatora — więc nie udajemy, że wiążą.

## 11. Backlog

Rozpoznanie na przyszłość — zbieranie danych do globalnego modelu i monetyzacja — leży w **`docs/POMYSLY.md`**. Nic z tego nie jest zdecydowane; obie drogi ruszają zasadę „dane tylko lokalnie", więc wymagają świadomej decyzji, a nie cichego wdrożenia.


| # | Zadanie | Uwagi |
| --- | --- | --- |
| B1 | Pomiary wyporności płetw, butów i kamizelek | nazwy i grubości zweryfikowane (sekcja 4); brakujących wartości producenci nie publikują — potrzebny własny pomiar w wodzie |
| B2 | Import: UDDF oraz cel udostępniania na Androidzie (`share_target`) | JSON z aplikacji Suunto już działa (sekcja 7). Zostaje UDDF (Shearwater, Subsurface) i wygodniejsza droga na Androidzie; FIT dopiero na konkretne zgłoszenie |
| B4 | Model suchego skafandra zależny od ilości gazu i ocieplacza | obecnie stała `g` |
| B6 | Testy e2e (Playwright) | pasek, wyszukiwanie akwenu, data, EN, offline |
| B7 | Usunąć nieużywane klucze tłumaczeń (`odczuw.`, `odczuwalnie {t} °C`, `Twój zestaw daje komfort od`) | porządki; klucze po schowkowej kopii zapasowej już usunięte |
| B8 | Dostępność: pełna obsługa klawiatury w chipach i doradcy, role ARIA wykresu | |
