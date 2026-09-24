# Pomysły na dalej: dane i pieniądze

Dwie analizy zamówione we wrześniu 2026. Nic tu nie jest zdecydowane — to rozpoznanie terenu przed decyzjami, które trzeba podjąć świadomie, bo obie ruszają fundament aplikacji: obietnicę, że dane zostają w telefonie.

Liczby w części o monetyzacji są szacunkami rzędu wielkości. Pewne są tylko prowizje i opłaty sklepów.

---

## 1. Statystyki i dane do globalnego modelu

Dziś aplikacja nie wysyła nic poza żądaniem o czcionki Google, a `CLAUDE.md` zabrania backendów, analityki i zewnętrznych API. To nie jest przeszkoda do obejścia — to cecha produktu, którą da się sprawdzić w kodzie. Każdy wariant poniżej ma cenę wyrażoną w zaufaniu.

### Dwa różne pytania

| Pytanie | Co odpowiada | Wartość dla modelu |
| --- | --- | --- |
| Ilu ludzi tego używa i gdzie się gubią? | statystyki użycia | żadna |
| Jaki ołów przy jakim zestawie i jakim nurku? | nurkowania z ocenami | cała |

### Warianty zbierania nurkowań

| Wariant | Co trzeba zbudować | Cena w zaufaniu | Realny plon |
| --- | --- | --- | --- |
| **A. Ręczny wkład plikiem** — przycisk „Pomóż ulepszyć model" zapisuje ten sam `.json` co kopia zapasowa, a nurek sam go wysyła | nic poza skrzynką pocztową | zero: reguła zostaje nietknięta | kilka–kilkanaście zestawów, za to świadomych i kompletnych |
| **B. Opt-in upload** — jeden przycisk, podgląd dokładnie tego, co poleci, zgoda przy każdym wysłaniu | jeden endpoint (Cloudflare Worker + KV/D1, ~0 zł przy tym ruchu) | wymaga zmiany reguły w `CLAUDE.md` i opisu w `SPEC.md` | proporcjonalny do liczby użytkowników |
| **C. Automatyczna telemetria** | jw. + polityka prywatności, RODO, retencja | niszczy to, co odróżnia tę aplikację | nie warto |

### Co wolno wysłać (wariant B)

Wysyłamy wyłącznie to, co jest cechą w modelu:

- **nurek:** płeć, wiek w przedziale, wzrost i waga zaokrąglone do 5, budowa, tolerancja zimna, poziom doświadczenia;
- **zestaw:** `catId` + rozmiar + znacznik „wypożyczony" dla każdej pozycji;
- **warunki:** gęstość wody, głębokość, temperatury, czas, numer nurkowania dnia;
- **wynik:** ołów oraz obie oceny (balast i komfort cieplny).

Nie wysyłamy: imienia, pozycji GPS, dat dziennych (miesiąc wystarczy), nazw pozycji własnych ani identyfikatora instalacji. **GPS i dokładne daty są dokładnie tym, co czyni „anonimowy" zrzut możliwym do powiązania z osobą** — kto nurkował w Honoratce 8 czerwca o 13:20, wie o sobie więcej, niż chciał zdradzić.

### Globalny model bez telemetrii w runtime

Najciekawsze jest to, że przepływ danych **nie musi być dwustronny w aplikacji**. Dziś nowy nurek startuje z θ = 0, czyli z zerową wiedzą; model uczy się dopiero z jego własnych ocen.

1. Zbierasz wkłady wariantem A albo B — u siebie, poza aplikacją.
2. Liczysz **priory**: globalny offset θ₀ i korekty dla najczęstszych cech katalogowych (pianka 5 i 7 mm, suchy trylaminat, butla aluminiowa i stalowa).
3. Wsypujesz je do repozytorium jako `priors.json` — i wchodzą do aplikacji **razem z buildem**.

Aplikacja dalej nie wysyła niczego, a mimo to każdy kolejny użytkownik zaczyna od sensownego punktu, który jego własne nurkowania szybko przykrywają. Wiedza wraca kanałem, który już istnieje: GitHub Pages.

**Progi i bezpieczeństwo.** Prior dla pojedynczej cechy ma sens od jakichś 30–50 nurkowań; samo θ₀ zacznie działać znacznie wcześniej. Prior wchodzi z szerokim przedziałem niepewności i nigdy jako pewna liczba — inaczej cudza średnia przebiłaby własne, trafne oceny nurka. To wprost wynika z zasady „nie przedstawiaj szacunków jako pewnych".

### Statystyki użycia

GitHub Pages nie udostępnia logów. Najtańsza uczciwa opcja to przeniesienie hostingu na Cloudflare Pages i włączenie statystyk po stronie serwera — bez ciasteczek i bez skryptu w aplikacji. Trzeba jednak pamiętać, że **PWA po instalacji działa offline**, więc realne użycie i tak będzie niedoszacowane: dowiesz się, ilu ludzi weszło, nie — jak używają.

### Rekomendacja

Teraz wariant A: jeden przycisk, zero infrastruktury, reguła nietknięta. Przy okazji warto samodzielnie hostować czcionki, żeby aplikacja nie wykonywała **żadnego** żądania sieciowego — wtedy obietnica prywatności jest dosłowna. Wariant B dopiero wtedy, gdy będzie komu wysyłać.

---

## 2. Monetyzacja

### Czego nie robić

- **Reklamy** — wymagają zgód i ciasteczek, zabijają argument prywatności, a przy tej skali dają grosze.
- **Abonament dla nurka** — narzędzia używa się kilkanaście razy w sezonie. Abonament za coś, co otwierasz przed wyjazdem, ma fatalną retencję.
- **Własna bramka płatności** — Stripe plus serwer licencji to backend, rozliczenia i VAT-OSS na własnej głowie.

### Co ma szansę, od najbardziej realnego

**1. B2B: bazy nurkowe, centra i wypożyczalnie.** Jedyny kanał z kwotą, która broni czasu pracy. Baza wstawia własny katalog, instruktor w minutę dobiera balast kursantowi zamiast metodą prób w wodzie, wypożyczalnia widzi, co komu wydać. Sprzedaje się oszczędnością czasu i mniejszą liczbą przerwanych nurkowań. Widełki: 50–150 zł miesięcznie za placówkę; dwadzieścia placówek to 12–36 tys. zł rocznie. Wymaga wersji wieloużytkownikowej i faktur, czyli pierwszego prawdziwego backendu.

**2. Jednorazowa licencja „Pro"** przez pośrednika (Lemon Squeezy, Gumroad — rozliczają VAT jako sprzedawca). Darmowe: kalkulator i doradca ocieplenia. Płatne: import z komputera, wiele profili, historia i eksport dziennika. Klucz podpisany kryptograficznie, sprawdzany **lokalnie**, bez serwera licencji. Cena 39–59 zł jednorazowo; przy 2000 użytkowników i konwersji 2–3% daje 1,5–3,5 tys. zł rocznie. Pokryje kawę, nie pokryje pracy.

**3. Współpraca z producentem albo dystrybutorem** (na przykład polska marka suchych skafandrów): ich katalog prosto od nich, branding w rogu, opłata za wdrożenie plus utrzymanie. Uczciwe, dopóki nie dotyka rekomendacji — a model liczy fizykę, nie preferencje.

**4. Afiliacja ze sklepami** przy pozycjach katalogowych („gdzie kupić"). Prowizje w tej branży są niskie, a ryzyko realne: doradca ocieplenia, który zarabia na poleceniu cieplejszej pianki, przestaje być doradcą. Jeśli wchodzić, to z oznaczeniem linków i bez wpływu na kolejność podpowiedzi.

**5. Sklepy mobilne** (Capacitor → App Store, Google Play) to **dystrybucja, nie przychód**: 99 USD rocznie za konto Apple, 25 USD jednorazowo za Google, prowizja 15% przy małych przychodach. Dają wiarygodność i wyszukiwanie w sklepie — ale PWA masz dziś za darmo.

**6. Darowizny** (Ko-fi, BuyMeACoffee) — nie policzysz na tym budżetu, kosztują jedną linijkę w Profilu.

### Kolejność

Najpierw bezpłatnie zbuduj dowód, że narzędzie działa: kilkadziesiąt realnych nurkowań z ocenami — to samo, czego potrzebuje globalny model. Potem porozmawiaj z **jedną** bazą. Jeśli zapłaci 100 zł miesięcznie, masz odpowiedź na pytanie o monetyzację; jeśli nie zapłaci żadna, żadna licencja Pro tego nie naprawi. Wersja Pro dla nurków jest dobrym dodatkiem i złym fundamentem.

Najtrudniejszy element obu dróg jest ten sam: **B2B i płatności wymagają backendu**, czyli świadomego złamania zasady, która dziś odróżnia tę aplikację. Warto ją złamać raz, w jednym miejscu i jawnie — na przykład tak, że wersja dla nurka zostaje w stu procentach lokalna, a konto ma wyłącznie baza.

---

## 3. Funkcje dla baz nurkowych i centrów szkoleniowych

Analiza z września 2026, zamówiona pod kątem: **co dołożyć, żeby baza chciała współpracować.** Wnioski z `POMYSLY.md` sekcja 2 zostają w mocy — B2B to jedyny kanał z kwotą, która broni czasu pracy — ale tamta analiza mówiła „wymaga wersji wieloużytkownikowej", nie mówiąc, co to konkretnie znaczy. To jest ta lista.

**Zastrzeżenie, które trzeba postawić na początku:** nie prowadzę bazy nurkowej. Poniższe bolączki to hipotezy wyprowadzone z tego, jak wygląda dobieranie balastu na kursie, a nie z wywiadów. Zanim cokolwiek z tego powstanie, warto zadać pytania z ostatniej części — jedna rozmowa z instruktorem jest warta więcej niż cała ta sekcja.

### Co baza naprawdę robi z balastem

| Sytuacja | Jak wygląda dziś | Co kosztuje |
| --- | --- | --- |
| Kursant wchodzi pierwszy raz do wody | instruktor strzela z oka, potem poprawki na płyciźnie | 10–20 min czasu instruktora na osobę, wychłodzony kursant, czasem przerwane nurkowanie |
| Wypożyczalnia wydaje sprzęt | rozmiar z oka, ołów „weź 10, zobaczymy" | wracanie po ołów, kolejka przy skrzyni |
| Gość przyjeżdża z własnym sprzętem | wszystko od nowa | jak wyżej |
| Ten sam gość wraca za rok | nikt nie pamięta, ile miał | powtórka całej procedury |

Wspólny mianownik: **liczba, którą ktoś już kiedyś ustalił, nigdzie nie zostaje.** Aplikacja to rozwiązuje dla jednego nurka. Dla bazy — jeszcze nie, i poniższe tego dotyczy.

### Czego brakuje architekturalnie (warunek wstępny)

Trzy rzeczy w obecnym kodzie blokują użycie w bazie i trzeba je nazwać wprost, zanim zacznie się liczyć funkcje:

1. **Szafa należy do nurka** (`S.profiles[].wardrobe`). Baza ma jedną wypożyczalnię i czterdziestu kursantów — dziś jej sprzęt musiałby być skopiowany do każdego profilu osobno. To jest **warunek wstępny większości pozostałych punktów** (B9).
2. **Lista nurków to płaska lista kafelków** bez wyszukiwania i sortowania. Przy trzech osobach w rodzinie działa, przy czterdziestu kursantach nie (B14).
3. **Nic nie wychodzi z aplikacji na papier ani do arkusza.** Nie ma `@media print`, nie ma CSV — jest tylko kopia zapasowa w JSON, czyli format dla aplikacji, nie dla człowieka (B11, B18).

### Propozycje, bez backendu

Te mieszczą się w zasadzie „dane tylko lokalnie" i działają na tablecie stojącym na ladzie bazy. To jest zestaw, którym da się pójść na rozmowę.

| # | Funkcja | Co rozwiązuje bazie | Koszt |
| --- | --- | --- | --- |
| **B10** | **Szybkie liczenie bez profilu** — jeden ekran: wzrost, waga, skafander, butla → ołów. Nic się nie zapisuje | gość z ulicy, kolejka przy skrzyni z ołowiem; **to jest funkcja, którą się pokazuje w pierwszej minucie demo** | mały |
| **B9** | **Magazyn bazy** — sprzęt wypożyczalni w jednym miejscu, wspólny dla profili, z rozmiarami i sztukami | przestaje dublować katalog na każdego kursanta; pozwala zapytać „co mam wydać" | średni (migracja `S`) |
| **B11** | **Karta wydania do druku** — nazwisko, lista sprzętu z rozmiarami, ołów, akwen, data | kartka do ręki kursanta i do segregatora; ślad, że procedura była | mały (`@media print`) |
| **B12** | **Tabela ołowiu na ścianę** — macierz „waga nurka × typowy zestaw wypożyczalni", wygenerowana z katalogu bazy, do wydruku | działa nawet wtedy, gdy nikt nie otworzy aplikacji; **najtańszy prezent, jaki można bazie zrobić** | mały |
| **B14** | **Lista nurków z wyszukiwaniem i archiwum** — sortowanie po ostatnim nurkowaniu, chowanie nieaktywnych | czterdziestu kursantów w sezonie | mały |
| **B15** | **Profil kursanta w dwóch pytaniach** — skrócony kreator (wzrost, waga, reszta domyślna), oznaczony jako gość | zakładanie profilu przy ladzie ma trwać 20 sekund, nie minutę | mały |
| **B13** | **Przekazanie profilu kodem QR** — profil i zestaw w części `#` adresu, bez serwera; kursant skanuje i ma swoje liczby u siebie | kursant wychodzi z bazy z wynikiem w telefonie — i wraca do aplikacji sam | średni |
| **B17** | **Protokół kontroli na 5 m** — prowadzona procedura: zejdź, sprawdź, dodaj/zdejmij, zapisz | to jest dokładnie to, czego instruktor uczy; aplikacja przestaje być kalkulatorem, a staje się częścią metodyki | średni |
| **B18** | **Eksport CSV** dziennika i listy wydań | baza wkleja do swojego arkusza i robi z tym, co chce | mały |
| **B16** | **Nazwa i logo bazy** w nagłówku, ustawiane raz na tablecie | tablet wygląda jak narzędzie bazy, nie jak cudza aplikacja | mały |

**Kolejność, gdyby robić:** B10 → B12 → B11 → B14 + B15 → B9 → reszta. Pierwsze trzy dają się pokazać na spotkaniu i nie wymagają zmiany schematu danych.

### Co wymaga backendu — i dlatego jest osobną decyzją

Nie da się tego zrobić lokalnie i nie należy udawać, że się da:

- **Ten sam magazyn na kilku urządzeniach** (lada, łódź, telefon instruktora). To jest pierwsza rzecz, o którą baza zapyta po demo.
- **Konto bazy, faktury, abonament** — patrz sekcja 2.
- **Katalog bazy wysyłany kursantom** do ich prywatnych aplikacji.
- **Globalny model z priorami** — sekcja 1; dla bazy jest ważniejszy niż dla pojedynczego nurka, bo jej goście nie mają własnej historii ocen i startują z zerową wiedzą modelu.

Uczciwe postawienie sprawy przed bazą: wersja na tablet działa dziś i za darmo, offline, bez konta; synchronizacja to osobny produkt, który powstanie wtedy, gdy będzie komu za niego zapłacić.

### Funkcje dla nurka, które przy okazji wzmacniają ofertę B2B

- **B17 protokół kontroli na 5 m** (wyżej) — jednocześnie karmi naukę modelu, bo poprawka po kontroli to najlepszej jakości dana, jaką ta aplikacja może dostać.
- **B2 import UDDF** (już w backlogu) — Shearwater jest standardem w bazach technicznych.
- **B19 rozkład ołowiu** — pas, kieszenie trymowe, kamizelka: instruktor i tak to tłumaczy, aplikacja może pokazać.

### O co zapytać bazę, zanim cokolwiek powstanie

Te pytania rozstrzygają połowę powyższej listy i kosztują jedną kawę:

1. Ile czasu na kursie schodzi na dobieranie balastu i czy ktoś to w ogóle liczy?
2. Czy zapisujecie, ile ołowiu miał kursant — a jeśli tak, to gdzie i czy ktoś do tego wraca?
3. Co jest większym problemem: balast czy dobranie grubości pianki do temperatury?
4. Kto miałby to obsługiwać — instruktor, osoba na ladzie, czy sam kursant na swoim telefonie?
5. Ile urządzeń musiałoby widzieć te same dane, żeby to miało sens? (Jeśli odpowiedź brzmi „jedno", cały backend odpada i robi się to w tydzień.)
6. Co dziś macie zapisane w Excelu i czy dałoby się to wczytać?

**Najważniejsza jest piątka.** Jeżeli bazie wystarczy jeden tablet na ladzie, wszystko z tabeli „bez backendu" da się dowieźć bez łamania zasady o danych lokalnych — a to jest jedyny wariant, w którym ten projekt zostaje tym, czym jest.
