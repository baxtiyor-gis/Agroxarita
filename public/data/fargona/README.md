# Farg'ona tumani ma'lumotlari

Bu papkaga quyidagi fayllar qo'yiladi (tuzilishi `public/data/bulungur/` bilan bir xil):

| Fayl | Majburiy | Mazmuni |
|---|---|---|
| `attrs.json` | ha | Kontur atributlari (ustunli, `AttrPack`); ekin yillari `col.ekin24`, `col.ekin26` … — faqat mavjud yillar |
| `geom.geojson` | ha | Kontur geometriyasi, `properties.id` = `attrs.col.id` |
| `iqlim.json` | yo'q | ERA5-Land iqlimi (bo'lmasa — namuna rejimi) |
| `relyef.webp` | yo'q | Relyef rasmi (DEM) |
| `relyef.json` | yo'q | `corners`, `min`, `max`, `stops`, ixtiyoriy `gorizontalIzoh` |
| `gorizontal.geojson` | yo'q | Gorizontallar (chiziqlar + `elev` li yorliq nuqtalari) |

`attrs.json` yoki `geom.geojson` bo'lmasa, ilova "Farg'ona tumani ma'lumotlari hali yuklanmagan" deb ko'rsatadi.
