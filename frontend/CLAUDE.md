# frontend/ — Agroxarita V2 xarita UI

React 19 + Vite + TypeScript (strict) + Tailwind 4 + MapLibre GL + Zustand + react-router 7.
Paket menejeri — **npm** (`package-lock.json`).

## Buyruqlar

```
npm install
npm run dev     # http://localhost:5173  (xarita — /)
npm run build   # tsc -b && vite build
npm run lint    # oxlint
```

`/api` va `/tiles` — `vite.config.ts` da backendga (8000) proksi; productionda nginx (`nginx.conf`).
Dev'da `maplibre-gl` `optimizeDeps.exclude` da (worker fayli uchun) — olib tashlama.

## Tuzilma

```
src/
  app/router.tsx        createBrowserRouter: / (xarita), /map -> / (eski havolalar), * (404)
  layouts/MapLayout.tsx sidebar + header + <Outlet/>
  components/           Header, Sidebar, Logo; ui/ — Button, Select, Panel
  features/<nom>/       funksiya bo'yicha (hozir map/; keyin border/, kontur/ ...)
  pages/                MapPage, EskiMap (/map -> /), NotFound
  store/useUi.ts        faolBolim, tematik/klassFiltr, qatlamlar; `tozala()` — logo va "Tozalash" tugmasi
  lib/cn.ts             clsx + tailwind-merge
  styles/index.css      @theme tokenlari, .float-panel, .sidebar-navy
```

Alias: `@/` = `src/`.

## Qoidalar

- Faqat desktop — mobil layout yo'q. Sahifada scroll yo'q, xarita qolgan joyni egallaydi.
- Sidebar (320px, navy) = statistika (bo'limlar dropdown), filtr emas. Filtr/tanlov headerda.
- Dizayn tokenlari V1 dan (`old/src/index.css`): `paper`, `navy`, `leaf`, `line`, ... —
  rang qiymatini qo'lda yozma, token ishlat. Ranglar/legenda: `old/src/lib/ranglar.ts`.
- Geometriya — MVT tile (`vector` source); atribut/statistika — API + TanStack Query
  (keyingi tasklarda qo'shiladi). Statik JSON yuklanmaydi.
- Asosiy xarita — faqat OSM raster.
- Nomlash o'zbekcha lotinda (`bolim`, `kontur`, `tuman`); texnik atamalar inglizcha.
- MapLibre obyekti `useEffect` cleanup'da `remove()` qilinadi (StrictMode).
  Konteyner div'ga `absolute` berma — `.maplibregl-map` uni `relative` qiladi; tashqi wrapper ishlat.
- API tiplari `docs/api.md` ga mos bo'lsin.
