# gifkit Studio

Webowy konwerter **Wideo → GIF** oraz **optymalizator GIF**, inspirowany aplikacją Gifski i napędzany biblioteką [`@sindresorhus/gifkit`](https://github.com/sindresorhus/gifkit).

Całe przetwarzanie odbywa się w **100% lokalnie w przeglądarce** (z wykorzystaniem Web Workera) — pliki nigdy nie są wysyłane na żaden serwer.

## Funkcje
- **Wideo → GIF:** wgrywanie `.mp4`, `.webm`, `.mov` (Drag & Drop lub selektor plików), podgląd i przycinanie zakresu (`Start` / `Koniec`).
- **Optymalizator GIF:** dekodowanie istniejących plików `.gif` przez `decodeAnimatedGIF`, przycinanie zakresu klatek, zmiana rozmiaru, FPS, jakości i ponowne kodowanie.
- **Konfiguracja wyjścia:** szerokość z zachowaniem proporcji, FPS (`5–30`), jakość kwantyzacji kolorów (`10%–95%`), prędkość (`0.5×–2×`), liczba powtórzeń (`forever` lub własna) oraz tryb **Bounce (ping-pong)**.
- **Płynny interfejs:** kodowanie w dedykowanym Web Workerze z paskiem postępu i możliwością anulowania.

## Design System & Stitch Skills
- System designu projektu opisany jest w [`.stitch/DESIGN.md`](.stitch/DESIGN.md) (opracowany według wytycznych skilla `taste-design`).
- Repozytorium zawiera zainstalowane pluginy [`google-labs-code/stitch-skills`](https://github.com/google-labs-code/stitch-skills) w katalogu `.agents/plugins/`:
  - `stitch-design`
  - `stitch-build`
  - `stitch-utilities`

## Uruchomienie lokalne

Wymagany Node.js `>= 22`.

```sh
npm install
npm run dev
```

## Skrypty

- `npm run dev` — serwer deweloperski Vite
- `npm run build` — produkcyjny build aplikacji
- `npm run preview` — podgląd zbudowanej aplikacji
- `npm run typecheck` — sprawdzanie typów TypeScript (`tsc --noEmit`)
- `npm test` — testy jednostkowe i integracyjne (`vitest run`)
