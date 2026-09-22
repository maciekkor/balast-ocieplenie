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
| `src/seed.js` | `fromCat()`, `seedDiver()` (przykładowy nurek), `emptyDiver()` (nurek bez danych), `seedSites()`, `seedState()`, `migrate()` — dane startowe i migracja zapisanego stanu |
| `src/i18n.js` | `EN` (słownik PL→EN kluczowany polskim tekstem), `LBL` (etykiety kategorii, miesięcy, budowy, krojów, wody), `SITE_EN`, `FRAG_EN` (tłumaczenie fragmentów nazw katalogowych), `tr()`, `frag()` |
| `src/app.js` | Stan, zapis, widoki (render przez template stringi), obsługa zdarzeń (delegacja na `#view`) |
| `src/sw.template.js` | Service worker; `__VER__` podmieniany hashem przy buildzie |
| `public/` | `manifest.webmanifest`, ikony, `.nojekyll` — kopiowane do `dist/` |
| `build.mjs` | Skleja `src/` w `dist/index.html`, generuje `dist/sw.js` |
| `tests/` | Testy `node:test` modelu, katalogu i i18n |

Kolejność skryptów w buildzie: `data.js → model.js → seed.js → i18n.js → app.js` (wspólny zakres globalny, jak w przeglądarce).

Service worker: pliki aplikacji **najpierw sieć, potem pamięć** (świeża wersja po wdrożeniu), czcionki Google **najpierw pamięć, w tle odświeżenie**.

## 3. Model danych (`S`, zapisywany w całości jako JSON)

```js
S = {
  v: 1,                         // wersja schematu
  lang: 'pl' | 'en',            // wspólny dla wszystkich nurków
  activeId: 'p-xxxxxx',         // id nurka, którego dane są na ekranie
  sites: [ { id, name, rho /*kg/l*/, ts: [12 × °C powierzchnia], tb: [12 × °C dno], preset?: bool } ],
  profiles: [ {                 // każdy nurek osobno (B3)
    id, onboarded /*false = kreator dopyta o profil*/,
    learnSince?: 'rrrr-mm-dd',  // nauka tylko z nurkowań od tej daty
    profile: { name, sex: 'M'|'K', age, height /*cm*/, weight /*kg*/,
               build: 'slim'|'athletic'|'muscular'|'average'|'fuller'|'obese',
               bf /*% tłuszczu lub ''*/, coldTol /*°C, + = odporny*/, divesBefore /*nurkowania poza dziennikiem*/ },
    wardrobe: [ { uid, catId /*id z CATALOG lub null*/, cat, brand, model, size, year|null,
                  rental?: bool, p: {/*parametry wg kategorii, kopia z katalogu, edytowalna*/}, src /*źródło wartości*/ } ],
    dives: [ { id, date, siteId, depth, time, tSurf, tBottom, nDay, reserve, items: [uid],
               lead /*kg*/|null, leadFb: 'light'|'ok'|'heavy'|null, leadAdj /*kg*/, thermal: 'cold'|'cool'|'ok'|'warm'|null, note } ],
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
| `wing` | `lift` kg, `plate` (`steel`, `alu`, `soft`), `b?` nadpisanie |
| `tank` | `vol` l, `bar`, `mat` (`stal`, `alu`), `be` kg wyporność pusta w morzu 1,025 z zaworem, `vd` l objętość zewnętrzna |
| `fins` | `b` kg wyporność pary, `mass?` g pary, `mat?` |
| `misc` | `b` kg |

**Pozycja spoza szafy.** `plan.items` (i `dives[].items`) mogą zawierać uid w formie `cat:<id z CATALOG>` — sprzęt brany prosto z katalogu, bez kopiowania do szafy; używa tego szybki wybór butli na ekranie Oblicz i w formularzu nurkowania. `itemOf()`/`resolveItems()` w `model.js` rozwiązują takie uid przez `catalogItem()`. Model liczy je jak każdą inną pozycję, ale **nie są cechą w nauce** — korekty per sztuka wymagają historii nurkowań w tej konkretnej sztuce, a te ma tylko sprzęt z szafy.

Wybór w zestawie: jedna pozycja z `wetsuit`, `dry`, `under`, `tank`, `fins` oraz jedna z pary `bcd`/`wing`. Suchy skafander wyklucza pianki i ocieplacze mokre i odwrotnie.

## 4. Katalog sprzętu

161 pozycji w 12 kategoriach. Marki: Mares, Cressi, Scubapro, Fourth Element, Bare, Aqualung, Tusa, Scubatech, Santi, Avatar, XDEEP, Tecline, Apeks, Hollis oraz pozycje ogólne.

Pole `src` opisuje wiarygodność: `producent (…)`, `szacunek`, `szacunek z masy i materiału`, `grubość: producent; masa: szacunek`. Producenci pianek, ocieplaczy i płetw nie publikują wyporności — dlatego katalog trzyma parametry fizyczne, a wyporność liczy model dla konkretnego nurka.

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
- **Suchy:** skorupa `b` lub neopren 4 mm (kompresja ×0,5); ocieplacz `g × BSA/1,9`.
- **Butla:** `be + vd(ρ_w − 1,025) − vol × rezerwa × 0,00123`.
- **Skrzydło:** `0,3 + płyta` (stal −1,9, alu −0,5, miękka +0,5) lub `b`.
- **Doświadczenie** (`divesBefore` + nurkowania w dzienniku): <25 → μ +1,0 kg, σ 2,5; 25–99 → +0,5, σ 2,0; 100–299 → 0, σ 1,6; ≥300 → −0,5, σ 1,4. Użytkownik nie podaje liczby nurkowań, tylko klika poziom; kafelek zapisuje `divesBefore = max(0, dolna granica poziomu − liczba nurkowań w dzienniku)`, więc **poziom podnosi się sam**, gdy dziennik urośnie ponad próg.
- **Uczenie:** regresja grzbietowa. Cel `y = ołów_idealny_w_wodzie − fizyka − μ`, gdzie ołów idealny = użyty ± `leadAdj` wg oceny. Cechy: wyraz wolny θ0 (prior N(0, σ_dośw²)) + wskaźnik każdej sztuki sprzętu (prior σ wg kategorii: pianka/ocieplacz 0,8, suchy 1,0, ocieplacz do suchego 1,2, kamizelka/skrzydło 0,5, butla 0,4, płetwy 0,3, kaptur 0,3, rękawice/buty 0,2). Szum σ = 0,7 kg. Waga nurkowania `0,5^(ranga/30)` (najnowsze najważniejsze). Przedział 80%: `±1,28·√(xᵀΣx + 0,25)`.
- Nauka pomija nurkowania bez `leadFb` lub bez `lead`, oraz sprzed `learnSince`.

## 6. Model ocieplenia

- **Temperatura nurkowania:** `T = 0,75·T_dno + 0,25·T_pow − max(0, (czas − 45)/15) − (nr_nurkowania_dnia − 1)`.
- **Grubość równoważna (mokre):** `Σ t × udział_tułowia(krój) × (1,15 jeśli półsucha)`, skorygowana kompresją względem typowego nurkowania: `× (1 − 0,5·c(d_śr)) / (1 − 0,5·c(7,5 m))`, `d_śr = głębokość_maks/2`, plus 1 mm za kaptur.
- **Komfort zestawu** (dla przeciętnego nurka), interpolacja: 1 mm → 26 °C, 3 → 22, 5 → 17, 7 → 12, 9 → 9, 11 → 7 (wg tabel sklepów nurkowych). Suchy: `tmin` ocieplacza (bez ocieplacza: trylaminat 20, neopren 14, zgnieciony 15), −0,5 °C z rękawicami.
- **Tolerancja osobista** `Δ = coldTol + Δ_nauka`; komfort nurka = komfort zestawu − Δ. Werdykt: zapas `T − komfort_nurka` ≥ 1 → „Wystarczy”, 0–1 → „Na granicy”, < 0 → „Za zimno”.
- **Nauka Δ:** dla każdej oceny zapas `m0` porównany z przedziałem oceny (zimno ≤ −2, chłodno −2…0, OK ≥ 0, za ciepło ≥ 4); informatywne tylko oceny poza przedziałem; `Δ_nauka = Σ korekt / (n + 1,5)`.
- **Doradca:** przegląda kombinacje z **własnego** sprzętu (bez `rental`): pianka × ocieplacz × kaptur oraz suchy × ocieplacz. Pokazuje do 3 najlżejszych wystarczających (sort: najwyższy komfort, potem najmniej ołowiu), a gdy żadna nie wystarcza — 3 najcieplejsze. Podświetlony jest tylko zestaw identyczny z wybranym.

## 7. Ekrany

0. **Kreator profilu (obowiązkowy)** — pokazuje się zamiast zakładek, gdy aktywny nurek ma `onboarded: false`: pierwsze uruchomienie, po „Wyczyść wszystkie dane" i po dodaniu nurka. Dolna nawigacja jest wtedy ukryta. Kroki: powitanie z wyborem języka (albo „Zobacz przykład", albo „Pomiń"), 1. imię, płeć, wiek; 2. wzrost, waga, budowa, opcjonalny % tłuszczu z podglądem wyporności ciała; 3. poziom doświadczenia i tolerancja zimna; 4. wybór startowej szafy (przykładowy zestaw albo sam automat). Krok 2 nie przepuszcza dalej bez sensownego wieku, wzrostu i wagi. **Kreatora nie można pominąć** — bez danych ciała nie da się policzyć wyporności, więc jedyne wyjście poza nim to „Zobacz przykład", które wczytuje kompletny profil przykładowego nurka.

**Wybór zamiast wpisywania.** Płeć, wiek, budowa, tolerancja zimna, doświadczenie i język to kafelki z grafiką (`tiles()`, klasy `.picks`/`.pick`), a wzrost i waga to suwaki — z polem liczbowym obok, więc wartość można też wpisać z klawiatury numerycznej (`inputmode="decimal"`); suwak i pole trzymają tę samą wartość, a po wyjściu z pola obowiązuje zakres suwaka. Do wpisania zostają tylko imię i opcjonalny % tłuszczu. Te same komponenty obsługują kreator i zakładkę Profil, więc jedna zmiana działa w obu miejscach.

Edycja profilu **nie przebudowuje widoku**: suwak i pola tekstowe zapisują stan i odświeżają wyłącznie `#body-out` (`refreshBody()`), a ten ma stałą wysokość (`.kv.fixed`). Inaczej przycisk „Dalej" uciekał spod palca — `blur → change → render()` podmieniał DOM między naciśnięciem a puszczeniem i kliknięcie przepadało.

1. **Oblicz:** przypięty pasek (ołów + zakres, przycisk **wyjaśnij** `?`, skrót zestawu, woda, komfort, werdykt) — nie przewija się. Karty w kolejności: **Nurkowanie** (akwen z wyszukiwaniem po pierwszych literach, data rrrr-mm-dd z ikoną kalendarza otwierającą natywny wybór daty — obsługiwaną na `pointerdown` z `preventDefault()`, żeby dotknięcie po wpisaniu daty nie przepadło przez przebudowę widoku, głębokość, czas, nr nurkowania, temperatury, rezerwa); **Ocieplenie** (rozbicie temperatury, doradca); **Zestaw** (chipy + szybkie dodawanie: kupiony/wypożyczony, katalog, pozycja ogólna, edytor) wraz z rzędem **standardowych butli** wybieranych jednym tapnięciem, bez wpisywania czegokolwiek do szafy. Skąd bierze się liczba ołowiu — karty **Balast** (skala z przedziałem, rozkład ołowiu, przypomnienie o kontroli na 5 m) i **Skąd ta liczba** (wykres rozbieżny składników) — pokazuje dopiero przycisk `?` w pasku (`ui.explain`), który po rozwinięciu przewija do nich. Na końcu przycisk „Po nurkowaniu”.
2. **Dziennik:** lista (najnowsze pierwsze) i formularz nurkowania z oceną balastu i ciepła.
3. **Szafa:** mój sprzęt z wyporności na 5 m w morzu i nauczoną korektą; edytor parametrów; katalog z wyszukiwaniem.
4. **Akweny:** presety i własne; gęstość wody i 12 miesięcy temperatur.
5. **Profil:** te same kafelki i suwaki co w kreatorze (język z flagami, płeć, wiek w 5 zakresach, wzrost i waga suwakami, budowa jako sylwetki, tolerancja zimna w 5 stopniach z wartością w °C, doświadczenie w 4 poziomach), karta **Nurkowie** (lista z liczbą nurkowań i sprzętu, przełączanie, dodanie nurka przez kreator, usunięcie z potwierdzeniem — ostatniego nurka nie da się usunąć), język, dane ciała, tolerancja zimna, nurkowania poza dziennikiem, czego nauczył się model, reset nauki, kopia zapasowa (zapis i odczyt pliku `.json`, bez pokazywania danych na ekranie), czyszczenie, wczytanie przykładu.

Przełącznik nurków siedzi w nagłówku (`#who`) i pojawia się dopiero przy co najmniej dwóch profilach; przy jednym nagłówek pokazuje licznik nurkowań jak dotąd.

### Pisanie przy otwartej klawiaturze

Na telefonie klawiatura zabiera ponad połowę ekranu, a przypięty pasek i dolna nawigacja zjadały resztę — nie było widać ani wpisywanego tekstu, ani listy podpowiedzi akwenu. Gdy fokus wchodzi w pole tekstowe **i** widoczny obszar jest niski (`visualViewport` skurczył się o ponad 140 px, jak na iOS, albo wysokość okna spadła poniżej 600 px, jak na Androidzie), `body` dostaje klasę `kb`: znika dolna nawigacja i pasek podsumowania, nagłówek przestaje być przypięty, a pole przewija się na górę ekranu. Lista podpowiedzi jest ograniczona do `min(260px, 40vh)`, żeby mieściła się nad klawiaturą; przewijane jest całe pole z podpisem (`.fieldset`/`.f`), z 10 px zapasu od górnej krawędzi. Po wyjściu z pola wszystko wraca. Na desktopie klasa nigdy się nie włącza.

## 8. Wygląd

Komponenty wyboru: `.picks` (siatka kafelków, wariant `.two` na dwie kolumny i `.rows` na pozycje pełnowierszowe), `.pick` (ikona SVG + podpis + wartość), `.slider` (suwak z odczytem). Ikony rysują `ICON`, `bodyIcon()` i `barsIcon()` w `app.js` — kontur `currentColor`, 24 × 24, bez zewnętrznych plików. Werdykty cieplne i oceny w dzienniku mają symbole: ✓ wystarczy, fala na granicy, płatek śniegu zimno, termometr chłodno, płomień za ciepło.

Tokeny w `:root` (jasny) i nadpisanie dla ciemnego (`prefers-color-scheme` oraz `[data-theme="dark"]`). Kolory: tło #E9EFEE, powierzchnia #FFF, tusz #10262B, akcent (ołów) #D4521B, morski #1B6A71. Czcionki: Barlow Condensed (nagłówki, liczby), Source Sans 3 (tekst), JetBrains Mono (dane) z systemowymi zapasami. Szerokość maks. 600 px, margines boczny 16 px, bez przewijania w poziomie.

## 9. Jakość

- `npm test` — testy modelu, katalogu i kompletności tłumaczeń. Muszą przechodzić przed każdym commitem.
- Przy zmianie modelu dopisz test z konkretną liczbą (np. komfort pianki, wynik balastu dla znanego przypadku).
- Ręcznie w przeglądarce (szerokość ~390 px): pasek przypięty, brak poziomego przewijania, oba języki, tryb ciemny, działanie offline po instalacji.

## 10. Backlog

| # | Zadanie | Uwagi |
| --- | --- | --- |
| B1 | Pomiary wyporności płetw, butów i kamizelek | nazwy i grubości zweryfikowane (sekcja 4); brakujących wartości producenci nie publikują — potrzebny własny pomiar w wodzie |
| B2 | Import logów z komputera nurkowego (UDDF, FIT Garmin/Suunto, eksport Subsurface) | parsowanie lokalne; wypełnia głębokość, czas, temperatury |
| B4 | Model suchego skafandra zależny od ilości gazu i ocieplacza | obecnie stała `g` |
| B6 | Testy e2e (Playwright) | pasek, wyszukiwanie akwenu, data, EN, offline |
| B7 | Usunąć nieużywane klucze tłumaczeń (`odczuw.`, `odczuwalnie {t} °C`, `Twój zestaw daje komfort od`) | porządki; klucze po schowkowej kopii zapasowej już usunięte |
| B8 | Dostępność: pełna obsługa klawiatury w chipach i doradcy, role ARIA wykresu | |
