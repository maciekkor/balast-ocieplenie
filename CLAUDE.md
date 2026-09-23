# CLAUDE.md — Balast i Ocieplenie

Aplikacja PWA dla nurków: kalkulator balastu i doradca ocieplenia, który uczy się z ocen po nurkowaniach. Pełna specyfikacja: **`docs/SPEC.md`** — przeczytaj ją przed zmianą logiki i aktualizuj ją razem z kodem.

## Komendy

```bash
npm test          # testy (node:test) — muszą przechodzić przed commitem
npm run build     # składa src/ → dist/ (index.html, sw.js, manifest, ikony)
npm run serve     # build + lokalny serwer na http://localhost:8080
```

Brak zależności npm. Wymagany Node ≥ 20.

## Struktura

- `src/shell.html` — CSS i szkielet; `src/data.js` katalog i akweny; `src/model.js` fizyka i nauka (czyste funkcje, bez DOM); `src/import.js` wczytywanie nurkowania z pliku komputera; `src/seed.js` dane startowe i migracja; `src/i18n.js` tłumaczenia; `src/app.js` stan, widoki, zdarzenia; `src/sw.template.js` service worker.
- `public/` — pliki statyczne kopiowane do `dist/`.
- `dist/` — wynik buildu, **nie commituj** (jest w `.gitignore`); publikuje go GitHub Actions (`.github/workflows/pages.yml`).

## Zasady

- **Dane tylko lokalnie** (`localStorage`, klucz `balast-ocieplenie.v1`). Żadnych backendów, analityki, zewnętrznych API. Jedyne zasoby z sieci to czcionki Google.
- **Bez frameworków i bibliotek w runtime.** Widoki to template stringi w `app.js`; każdy tekst użytkownika przechodzi przez `esc()`.
- **Zmiana schematu `S` = migracja w `migrate()`** (`src/seed.js`; wołana przy starcie i przy imporcie kopii, więc stare kopie zapasowe też się wczytują) i w razie potrzeby podbicie `S.v`. Użytkownicy mają dane w telefonach — nie wolno ich zgubić.
- **i18n:** każdy nowy tekst UI piszesz po polsku w `tr('…')` i dodajesz tłumaczenie do `EN` w `src/i18n.js`. Test wykryje brakujące. Nazwy kategorii, miesięcy itp. są w `LBL`; fragmenty nazw katalogowych w `FRAG_EN`.
- **Katalog:** nowa pozycja w `CATALOG` musi mieć unikalne `id`, `cat` z `CAT_ORDER`, `sizes` i uczciwe `src` („producent (…)” tylko gdy wartość naprawdę pochodzi od producenta, w innym razie „szacunek…”). Nie zmieniaj `id` istniejących pozycji — odwołują się do nich dane użytkowników (`catId`). `sizes` bierz z zestawu w `SZ` i z rozmiarówki producenta (skrzydła są jednorozmiarowe, płetwy Mares to `S/R/XL`, Hollis F1 `R/XL/2XL`), a nowe pole w `p` dodawaj tylko wtedy, gdy ktoś je czyta — nieużywane pola usuwamy.
- **Edytor sprzętu:** pozycja z katalogu ma do zmiany tylko własność (przyciski Mój/Wypożyczony), rozmiar (kafelki; jednorozmiarowe pozycje nie mają tego pola) i rok zakupu (sam dla „Mój”). Parametry `p` edytuje się wyłącznie w pozycjach własnych — nie dodawaj pól `p` do edytora katalogowego.
- **Bramka instalacyjna:** telefon w przeglądarce dostaje `viewGate()` zamiast zakładek, ale miękko — „Użyję w przeglądarce” (`S.installSkip`) wyłącza ją na stałe, a Profil pozwala wrócić. Na iOS zainstalowana aplikacja ma osobny magazyn niż Safari, więc przy istniejących danych bramka musi najpierw proponować kopię zapasową. Gdy aplikacja jest już zainstalowana (`getInstalledRelatedApps` na Androidzie, poszlaka `S.gateSeen` bez danych na iOS), bramka odsyła do ikony zamiast namawiać do instalacji — na iOS dane z aplikacji nie są w przeglądarce widoczne.
- **Lokalizacja:** `locateSite()` pyta telefon o pozycję tylko przy `S.geo === 'on'` i wybiera **najbliższy** akwen (`nearestSite()`, dystans), a nie rejon zawierający pozycję — regułę `km / r` (`matchSite()`) zostaw importowi z komputera, bo tam pozycja pada nad samym akwenem; pozycji nie zapisujemy i nie wysyłamy, porównujemy ją wyłącznie z listą akwenów w pamięci.
- **Kreator kończy się sprzętem:** krok 4 prowadzi przez kategorie (`WIZ_CATS`), a wymagane są tylko skafander i kamizelka/skrzydło — butli nie wymagamy, bo wybiera się ją na Oblicz spośród standardowych. Dodawanie (karta kategorii) i przegląd (karta „Moja szafa”) są rozdzielone. Pierwsze uruchomienie to `freshState()` (pusta szafa), a `seedState()` służy już tylko „Wczytaj przykład”.
- **Samouczek:** `TOUR` celuje selektorami w prawdziwe elementy (`#summary .sb`, `#plan-card`, `#thermal-card`, `#set-card`, `[data-act="log-from-plan"]`, `nav.tabs`) — zmieniasz te karty, popraw kroki. `#tour` leży poza `#view` i ma własny nasłuch kliknięć; `S.tourDone` pilnuje, żeby poszedł raz.
- **Prawa autorskie:** licencja jest zastrzeżona (`LICENSE`). Nagłówki w `src/*.js`, baner wstawiany przez `build.mjs` do `dist/index.html` i `dist/sw.js` oraz `public/robots.txt` mają zostać — to ślad autorstwa, nie ozdoba.
- **Model:** zmiana wzoru lub stałej → test z konkretną liczbą w `tests/model.test.js` + opis w `docs/SPEC.md` (sekcje 5–6). Punkt kontrolny balastu to zawsze 5 m, rezerwa, pusta kamizelka.
- **Ołów tylko z kompletnym zestawem:** bez butli i bez kamizelki/skrzydła (`setIssues()`) nie pokazujemy liczby nigdzie — ani w pasku, ani w karcie Balast, ani przy propozycjach doradcy, ani jako podpowiedź w dzienniku. Zamiast tego komunikat, czego dodać.
- **Bezpieczeństwo nurka:** zostaw komunikat o kontroli pływalności na 5 m; nie przedstawiaj szacunków jako pewnych.
- **Klawiatura:** pole tekstowe na niskim ekranie włącza `body.kb` (chowa nawigację i pasek, przewija pole na górę). Nowe pola tekstowe testuj przy wysokości ~420 px.
- **UI:** format daty `rrrr-mm-dd`; przecinek dziesiętny w PL; ołów w górę do 0,5 kg; układ działa na 390 px bez poziomego przewijania, w jasnym i ciemnym motywie; kolory tylko z tokenów CSS.
- **Akweny:** preset ma `lat`, `lon` i promień `r` w km; `matchSite()` wybiera ten o najmniejszym `km / r`, więc mały akwen wygrywa z wielkim rejonem, który go obejmuje. Współrzędnych nie ma w UI — `migrate()` bierze je zawsze z presetu.
- **Butle:** twinsety to `cat:'tank'` (zastępują butlę podstawową, `p.n` tylko do etykiety „2 × 12 l"), a butle stage to `cat:'stage'` — poza `SINGLE`, więc dokładają się do zestawu i można mieć kilka; stage nie zaspokaja wymogu butli w `setIssues()`.
- **Sprzęt spoza szafy:** uid `cat:<id>` w `plan.items` bierze pozycję prosto z katalogu (szybki wybór butli). Każde wyszukiwanie sprzętu po uid rób przez `itemOf(uid, P())`, nigdy przez `wardrobe.find`.
- **Plan ma tylko cztery pola** (akwen, miesiąc kafelkami, głębokość, temp. dna) — pełna data z kalendarzem żyje wyłącznie w formularzu nurkowania, bo w planie dzień niczego nie zmienia. Czas, nr nurkowania dnia, rezerwa i temp. powierzchni żyją w danych z założeniami normalizowanymi w `migrate()`, a edytuje się je w zwijanej sekcji formularza nurkowania — nie dodawaj ich z powrotem do planu.
- **Wiele profili:** dane aktywnego nurka bierz przez `P()` (nigdy `S.profile` itd.), a do modelu podawaj `dst()`. Akweny i język są wspólne.
- **Kreator (`onboarded: false`)** renderuje się bez pełnego `render()` przy edycji pól i musi mieć stałą wysokość — inaczej przycisk „Dalej” ucieka spod palca między naciśnięciem a puszczeniem.
- Po zmianach sprawdź w przeglądarce: pasek podsumowania przypięty, oba języki, formularz nurkowania, szafa, offline po instalacji.

## Wdrożenie

Push na `main` → workflow uruchamia testy, build i publikuje `dist/` na GitHub Pages (Settings → Pages → Source: **GitHub Actions**). Service worker dostaje nową wersję z hasha buildu, więc telefony pobiorą aktualizację przy następnym otwarciu.

## Backlog

Lista w `docs/SPEC.md`, sekcja 11. Bierz zadania po kolei, chyba że użytkownik wskaże inne.
