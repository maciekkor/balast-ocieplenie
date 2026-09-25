# Wersje centrów nurkowych

Każdy katalog `brands/<id>/` z plikiem `brand.json` to osobna aplikacja: ta sama co główna, ale z logo, kolorami, ikoną i aktualnościami centrum. Build (`npm run build`) składa ją do `dist/<id>/`, a GitHub Actions publikuje pod adresem

```
https://maciekkor.github.io/balast-ocieplenie/<id>/
```

Ten adres centrum daje kursantom. Po „Dodaj do ekranu początkowego" kursant ma na telefonie ikonę centrum i jego nazwę, nie „Balast".

Katalogi zaczynające się od `_` są pomijane — `_example/` to szablon, nie opublikowana wersja.

> **Repozytorium jest publiczne.** Logo, grafiki i nazwa centrum trafiają tu dopiero wtedy, gdy centrum zgodziło się na współpracę i jego aplikacja ma iść do kursantów. Wcześniej — oferty, zrzuty i pliki centrum trzymamy poza repozytorium.

## Nowe centrum

1. Skopiuj `_example/` do `brands/<id>/`. **Nazwa katalogu = `id`** i to jest część adresu, więc wybierz krótko i na zawsze (`divemania`, `deepspot`). Zmiana `id` później to nowy adres, nowa aplikacja na telefonach i nowe, puste dane kursantów.
2. Podmień pliki i wypełnij `brand.json` (pola niżej).
3. `npm test && npm run build` — build zatrzyma się z listą błędów, jeśli czegoś brakuje.
4. Sprawdź `dist/<id>/` w przeglądarce, w jasnym i ciemnym motywie, na 390 px.
5. Commit, PR, merge — po wdrożeniu adres działa.

## `brand.json`

| Pole | Wymagane | Opis |
| --- | --- | --- |
| `id` | tak | małe litery, cyfry, myślnik; równe nazwie katalogu. Zajęte: `icons`, `brand`, `shots` |
| `name` | tak | nazwa centrum — napis albo `{"pl": "…", "en": "…"}` |
| `appName` | tak | nazwa pod ikoną na ekranie telefonu, **najwyżej 12 znaków** (dłuższą telefon utnie) |
| `logo` | tak | logo do nagłówka i powitania; najlepiej SVG, poziome, czytelne na jasnym **i** ciemnym tle |
| `icon192`, `icon512` | tak | ikona aplikacji, PNG 192×192 i 512×512, kwadrat bez przezroczystych rogów |
| `appleIcon` | tak | ikona dla iPhone'a, PNG 180×180 |
| `colors.light`, `colors.dark` | tak | cztery kolory `#RRGGBB` na każdy motyw: `accent` (przyciski, liczba ołowiu), `accentInk` (tekst na przycisku), `teal` (zaznaczenia), `tealSoft` (tło zaznaczeń) |
| `site` | nie | `id` akwenu z `src/data.js`, od którego startuje nowy nurek — zwykle domowa woda centrum |
| `contact` | nie | `url` (tylko `https://`), `phone`, `email` — pokazywane w Profilu |
| `news` | nie | aktualności, niżej |

**Kolory sprawdź na kontrast.** `accentInk` na `accent` musi być czytelny (co najmniej 4,5 : 1), a `accent` na jasnym tle aplikacji też, bo tym kolorem jest duża liczba ołowiu. Jasny, nasycony kolor marki zwykle wymaga ciemnego `accentInk`, a w ciemnym motywie — jaśniejszej wersji samego `accent`.

## Aktualności

Na górze ekranu Oblicz, najwyżej **dwie** naraz — tam nurek zagląda przed każdym nurkowaniem. Każda to grafika z opcjonalnym tytułem, zdaniem i linkiem:

```json
"news": [
  {
    "id": "2026-11-marsa-alam",
    "img": "news/wyjazd.jpg",
    "title": {"pl": "Wyjazd: Marsa Alam, listopad", "en": "Trip: Marsa Alam, November"},
    "text":  {"pl": "7 dni, 18 nurkowań.", "en": "7 days, 18 dives."},
    "url": "https://centrum.pl/wyjazdy",
    "from": "2026-09-15",
    "until": "2026-10-31"
  }
]
```

- `img` — plik w katalogu centrum. **1200 × 675 (16:9), JPEG albo WebP do ~200 KB**: grafika jedzie w paczce aplikacji, więc każdy kilobajt kursant pobiera przy aktualizacji.
- `from` / `until` — aktualność pokazuje się od–do (włącznie). Po `until` znika sama, nie trzeba jej usuwać od razu.
- `id` — dowolny napis, unikalny. Nurek może aktualność ukryć, a ukrycie pamiętamy po `id`; **nowa grafika dostaje nowe `id`**, żeby pokazała się także tym, którzy ukryli poprzednią.
- `url` — tylko `https://`; otwiera się w przeglądarce.

### Zmiana aktualności

Centrum przysyła grafikę i dwa zdania → podmieniasz plik i wpis w `news` → commit na `main`. Workflow buduje i wdraża w ~1 minutę, service worker dostaje nową wersję, a telefony pobiorą ją przy następnym otwarciu aplikacji (pokażą przy kolejnym — aktualizacja idzie w tle).

Aplikacja **niczego nie pobiera z serwera centrum**: aktualności są częścią paczki, więc działają offline i nie zdradzają nikomu, kiedy kursant otwiera aplikację. Samodzielna edycja przez centrum (bez pośrednika) wymagałaby pobierania treści z zewnątrz, czyli zmiany zasady „dane i zasoby tylko lokalnie" z `CLAUDE.md` — to osobna decyzja.

## Co jest wspólne, a co osobne

Wszystkie wersje leżą pod jednym adresem `maciekkor.github.io`, więc przeglądarka daje im wspólną pamięć. Dlatego:

- **Dane nurka są osobne.** Każda wersja trzyma stan pod własnym kluczem (`balast-ocieplenie.v1@<id>`). Kursant dwóch centrów ma dwie niezależne aplikacje. Kto miał już główną aplikację w tej samej przeglądarce, dostaje na powitaniu przycisk „Przenieś moje dane" (kopia, oryginał zostaje). Na iPhonie zainstalowana aplikacja ma osobną pamięć i tego przycisku nie zobaczy.
- **Tryb offline jest osobny.** Każdy service worker ma cache `balast-<id>-<wersja>` i kasuje wyłącznie swoje, a główny nie obsługuje podkatalogów centrów. Wdrożenie jednej wersji nie wyłącza offline drugiej — pilnuje tego test.
- **Katalog sprzętu, akweny, model i tłumaczenia są wspólne** — wersja centrum to ta sama aplikacja, nie fork. Poprawka w modelu trafia do wszystkich przy następnym wdrożeniu.

Własna domena centrum (np. `app.centrum.pl`) nie jest obsługiwana: wymaga osobnej publikacji z własnym CNAME.
