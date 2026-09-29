# Tarixiy ekinlar modeli

Bu CatBoost klassifikatori kontur atributlari va oldingi yillardagi ekin xaritalaridan foydalanib, keyingi yil xaritada qayd etilishi mumkin bo'lgan asosiy ekin sinflarini bashorat qiladi. Maqsad yorlig'i — kontur-yil bo'yicha eng katta maydon ulushiga ega bo'lgan ekin; minimal ulush sukut bo'yicha 20%.

Bu **hosildorlik yoki eng foydali ekin modeli emas**. Hozirgi ma'lumotlarda hosil miqdori, fermerning xarajat/foydasi, urug' navi va sug'orish hajmi yo'q. Shuning uchun u tarixiy ekin tanlovlariga o'xshashlikni o'rganadi. Modelni agronomik tavsiya sifatida ishlatishdan oldin natijani mutaxassis tekshirishi kerak.

## O'qitish

Python 3.10+ muhitida:

```bash
python -m pip install -r ml/requirements.txt
python ml/train_crop_model.py --district bulungur
```

Farg'ona uchun:

```bash
python ml/train_crop_model.py --district fargona
```

Farg'onada hozircha faqat 2024 va 2026-yillar uchun yetarli asosiy ekin yorliqlari bor; u yerdagi model natijasi juda dastlabki bo'ladi. Ishonchli vaqt bo'yicha taqqoslash uchun qo'shimcha yillar va ko'proq ekin sinflari kerak.

Model `CatBoostClassifier` va `MultiClass` loss bilan o'qitiladi. O'zgaruvchilar tuproq, agrokimyo, yer turi, sug'orish belgisi, qiyalik, balandlik, yo'nalish, ERA5-Land iqlim me'yorlari va o'tgan yilgi asosiy ekin sinfini qamrab oladi. Konturdagi asosiy ekin ulushi sample weight sifatida beriladi; jami yozuvlari 50 tadan kam bo'lgan sinflar modelga kiritilmaydi.

## Vaqt bo'yicha baholash

Model 2025 va 2026-yillarni faqat undan oldingi yillar bilan o'qitib baholaydi. `metrics.json` da sinf qamrovi, top-1/top-3 aniqligi va eng ko'p uchragan ekinni tanlaydigan sodda bazaviy usul bilan solishtirish yoziladi. Test yilida avval uchramagan yoki kam yozuvli sinf model tomonidan bashorat qilinmaydi; shuning uchun metrikalar bilan birga known-class coverage ham ko'rsatiladi. Bu tekshiruv mavjud konturlar uchun keyingi yilni bashorat qilishni o'lchaydi; yangi tumanga yoki avval ko'rilmagan konturlarga umumlashishni emas.

## Natija fayllari

`ml/artifacts/<tuman>/` ichida:

- `catboost_crop_history.cbm` — o'qitilgan model.
- `metrics.json` — ma'lumot qamrovi va yil bo'yicha baholash.
- `predictions_<yil>.json` — har kontur uchun eng ehtimolli 3 ta tarixiy ekin sinfi.
- `feature_importance.csv` — umumiy model ahamiyatlari.
- `shap_importance.csv` — tanlangan namuna bo'yicha o'rtacha mutlaq SHAP hissalari.

Ekin sinflari `attrs.json` dagi `lug.ekin` nomlari bilan chiqadi. Ularni `crops.json` dagi 37 tavsiya ekini bilan aynan bir xil deb bo'lmaydi.
