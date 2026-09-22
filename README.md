# Balast i Ocieplenie

Kalkulator balastu i doradca ocieplenia dla nurków. Mówi, ile ołowiu zabrać i jaki zestaw założyć, a po każdym nurkowaniu uczy się z Twojej oceny. Działa w przeglądarce, instaluje się na ekranie głównym telefonu i działa bez internetu. **Wszystkie dane zostają w telefonie.**

> Wynik to punkt startowy. Przy nowej konfiguracji zawsze zrób kontrolę pływalności na 5 m z rezerwą w butli i pustą kamizelką.

## Instalacja na telefonie

- **iPhone (Safari):** otwórz stronę → Udostępnij → **Do ekranu początkowego**.
- **Android (Chrome):** otwórz stronę → menu ⋮ → **Zainstaluj aplikację**.

## Publikacja (GitHub Pages)

1. Wypchnij repozytorium na GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Każdy push na `main` uruchamia testy, build i publikację. Adres: `https://<użytkownik>.github.io/<repozytorium>/`.

## Rozwój

```bash
npm test        # testy
npm run build   # dist/
npm run serve   # podgląd na http://localhost:8080
```

Specyfikacja: [`docs/SPEC.md`](docs/SPEC.md). Zasady pracy (także dla Claude Code): [`CLAUDE.md`](CLAUDE.md).

## Przenoszenie danych

Profil → Kopia zapasowa → **Zapisz kopię do pliku**. Na drugim urządzeniu: Profil → Kopia zapasowa → **Wczytaj kopię z pliku**. Kopia to jeden plik `.json` ze wszystkimi profilami, szafą, dziennikiem i akwenami — wczytanie zastępuje dane w przeglądarce.
