import katalogJson from './data/ekin-katalogi.json'
import type { EkinQator, Iqlim, Kontur } from './types'

/**
 * Ekin mosligini baholash — V1 `old/src/lib/tavsiya.ts` qoidalari (sun'iy intellekt yo'q).
 *
 * Ball = 100 × (bonitet × sho'rlanish × suv × mexanika × qiyalik × foydalanish × ahamiyat × iqlim)
 *        − agrokimyo jarimasi
 *
 * Har bir omil `sabablar` ga o'z satri bilan yoziladi. Ma'lumot yo'q omil — neytral yoki
 * V1 dagi ehtiyotkor qiymat (bonitet 0,75 / sho'r 0,85 / mexanika 0,9), sabab ogohlantirish.
 */

// ------------------------------------------------------------------ tiplar
export interface Crop {
  id: string
  nom: string
  guruh: string
  bonitet_min: number
  bonitet_max: number
  shor_chidam: number
  suv_min: number | null
  suv_matn: string | null
  muddat: string | null
  ogit: { azot: string | null; fosfor: string | null; kaliy: string | null }
  iqlim: {
    fah_min: number | null
    fah_opt: number | null
    sovuqsiz_min: number | null
    sovuqqa_chidam: number
    issiqqa_chidam: number
    qishlash_min: number | null
  }
}

export const EKINLAR: Crop[] = katalogJson as Crop[]

export type Foyd = 'haydalma' | 'lalmi' | 'bog' | 'uzumzor' | 'tutzor' | 'tomorqa' | 'yaylov' | 'boshqa'

export interface IqlimKirish {
  fah: number | null
  sovuqsiz: number | null
  issiqKun: number | null
  minT: number | null
  /** kech bahorgi sovuq bo'lgan to'liq yillar soni / to'liq yillar soni */
  kechSovuqYil: number
  toliqYillar: number
}

/** Ketma-ket bir xil asosiy ekin (V1 ekin id si bilan) */
export interface Monokultura {
  id: string
  yillar: number
  dan: number
  gacha: number
}

/** V1 kodlariga keltirilgan kirish; `null` — ma'lumot yo'q */
export interface Kirish {
  bonitet: number | null
  /** 1 qumli, 2 yengil qumoq, 3 o'rta qumoq, 4 og'ir qumoq, 8 loyli/gilli */
  mex: number | null
  /** 1 sho'rlanmagan … 5 juda kuchli */
  shor: number | null
  /** gradus */
  qiyalik: number | null
  /** 0 juda kam … 4 juda ko'p */
  gumus: number | null
  fosfor: number | null
  kaliy: number | null
  foyd: Foyd
  /** null — iqlim ma'lumoti yo'q (omil 1,0) */
  iqlim: IqlimKirish | null
  mexNom: string | null
  shorNom: string | null
  monokultura: Monokultura | null
  /** tuproq yo'q yoki kontur maydonining <10% qismini qoplaydi */
  tuproqYoq: boolean
}

export interface Sabab {
  turi: 'ok' | 'ogoh' | 'xato'
  matn: string
}

export interface Tavsiya {
  crop: Crop
  ball: number
  sabablar: Sabab[]
  radSabab: string | null
}

// ------------------------------------------------------- V1 <-> V2 moslash
const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()

/**
 * V2 `mexanika` matni -> V1 kodi (mexanika: 1 qumli, 2 qumoq(yengil), 3 o'rta, 4 og'ir, 8 gilli).
 * V2 lug'ati: Qumoqli, Yengil qumoqli, O'rta qumoqli [+ shagal], Og'ir qumoqli, Og'ir va o'rta qumoqli,
 * Qumli, Loyli, Loy qumoqli.
 */
export function mexKodi(nom: string | null): number | null {
  if (!nom) return null
  const n = norm(nom)
  if (n.startsWith('ogir')) return 4 // og'ir, og'ir va o'rta (ehtiyotkor: og'ir)
  if (n.startsWith('loy qumoq')) return 4
  if (n.startsWith('loyli')) return 8
  if (n.startsWith('qumli')) return 1
  if (n.startsWith('yengil')) return 2
  if (n.startsWith('orta')) return 3
  if (n === 'qumoqli') return 3
  return null
}

/**
 * V2 `shorlanish` matni -> V1 kodi (1 sho'rlanmagan … 5 juda kuchli). V2 da "sho'rxok" yo'q.
 * V2 lug'ati: Sho'rlanmagan, Kuchsiz, O'rtacha, Kuchli, Juda kuchli, Kam, Sho'rlanmagan yoki kam,
 * Ba'zan kam sho'rlangan, Ba'zan kuchsiz.
 */
export function shorKodi(nom: string | null): number | null {
  if (!nom) return null
  const n = norm(nom)
  if (n.startsWith('shorlanmagan')) return 1
  if (n.includes('juda kuchli')) return 5
  if (n.includes('kuchsiz')) return 2
  if (n.includes('kuchli')) return 4
  if (n.includes('ortacha')) return 3
  if (n.includes('kam')) return 2
  return null
}

/** V2 yer turi kodi (`yer_turlari[].kod`) -> foydalanish guruhi; kiritilmaganlar qishloq xo'jaligi emas */
const FOYD_KOD: Record<string, Foyd> = {
  haydalma_yer_sug: 'haydalma',
  haydalma_shartli_sug: 'haydalma',
  dehqon_xuj_sug: 'haydalma',
  buz_yer_sug: 'haydalma',
  haydalma_lalmi: 'lalmi',
  dehqon_xuj_lalmi: 'lalmi',
  buz_yer_lalmi: 'lalmi',
  boglar_sug: 'bog',
  bog_shartli_sug: 'bog',
  bog_lalmi: 'bog',
  bog_intensiv: 'bog',
  uzumzor_sug: 'uzumzor',
  uzumzor_shartli_sug: 'uzumzor',
  uzumzor_lalmi: 'uzumzor',
  uzumzor_intensiv: 'uzumzor',
  tutzor: 'tutzor',
  tomarqa: 'tomorqa',
  dala_tomorqa: 'tomorqa',
  issiqxona: 'tomorqa',
  pichanzor: 'yaylov',
  utloq_yaylov: 'yaylov',
  utloq_yaylov_suvli: 'yaylov',
}

export function foydalanish(yerTurlari: Kontur['yer_turlari']): Foyd {
  let eng: Foyd = 'boshqa'
  let m = 0
  for (const y of yerTurlari) {
    const f = !y.jami ? FOYD_KOD[y.kod] : undefined
    if (f && y.maydon > m) {
      m = y.maydon
      eng = f
    }
  }
  return eng
}

/** V2 ekin kodi (9 xonali) -> V1 ekin id si; ro'yxatda yo'qlar tavsiya katalogida yo'q */
export const EKIN_KOD: Record<number, string> = {
  102010000: 'bugdoy',
  101010000: 'goza',
  102020000: 'arpa',
  102060000: 'makkajoxori',
  108040000: 'makka',
  102080000: 'sholi',
  104040000: 'piyoz',
  107010000: 'kartoshka',
  108010000: 'beda',
  106020000: 'mosh',
  103020000: 'kungaboqar',
  105020000: 'qovun',
  106010000: 'noxot',
  104030000: 'sabzi',
  105010000: 'tarvuz',
  104010000: 'pomidor',
  106030000: 'loviya',
  104050000: 'sarimsoqpiyoz',
  103030000: 'kunjut',
  104070400: 'karam',
  108030000: 'oq-joxori',
  103070000: 'yeryongoq',
  105030000: 'qovoq',
  103050000: 'mahsar',
  103010000: 'soya',
  108020000: 'xashaki-lavlagi',
  104070100: 'gulkaram',
  104020000: 'bodring',
  104110100: 'shirin-qalampir',
  104130000: 'osh-lavlagi',
  109210000: 'qulupnay',
  104070200: 'brokkoli',
  104120000: 'baqlajon',
  103060000: 'zigir',
  104110200: 'achchiq-qalampir',
  104070300: 'kolrabi',
  9: 'tritikale',
}

/** Bir xil asosiy ekin oxirgi yillarda ketma-ket (`MONOKULTURA_MIN` yil va undan ko'p) */
export const MONOKULTURA_MIN = 3

export function monokultura(ekinlar: EkinQator[]): Monokultura | null {
  const asosiy = new Map<number, number>()
  for (const e of ekinlar) if (e.asosiy) asosiy.set(e.yil, e.kod)
  const yillar = [...asosiy.keys()].sort((a, b) => b - a)
  if (!yillar.length) return null
  const gacha = yillar[0]
  const kod = asosiy.get(gacha)!
  let dan = gacha
  while (asosiy.get(dan - 1) === kod) dan--
  const id = EKIN_KOD[kod]
  const uzunlik = gacha - dan + 1
  return id && uzunlik >= MONOKULTURA_MIN ? { id, yillar: uzunlik, dan, gacha } : null
}

const daraja = (d: { daraja: number | null; qoplanish: number } | null | undefined) =>
  d && d.daraja != null && d.qoplanish >= 0.1 ? Math.max(0, Math.min(4, d.daraja - 1)) : null

/** API javobi (+ iqlim) -> V1 kodlaridagi kirish */
export function kirishQur(k: Kontur, iq: Iqlim | null | undefined): Kirish {
  const t = k.tuproq
  const ishonchli = !!t && t.qoplanish >= 0.1
  const mex = ishonchli ? mexKodi(t.mexanika) : null
  const shor = ishonchli ? shorKodi(t.shorlanish) : null
  const toliq = iq ? iq.yillik.filter((y) => y.toliq).length : 0
  return {
    bonitet: ishonchli ? t.bonitet : null,
    mex,
    shor,
    qiyalik: k.relyef?.qiyalik.ortacha ?? null,
    // V2 daraja 1-based (1 juda kam … 5 juda ko'p) -> V1 0-based
    gumus: daraja(k.agrokimyo?.gumus),
    fosfor: daraja(k.agrokimyo?.fosfor),
    kaliy: daraja(k.agrokimyo?.kaliy),
    foyd: foydalanish(k.yer_turlari),
    iqlim: iq
      ? {
          fah: iq.korsatkich.fah,
          sovuqsiz: iq.korsatkich.sovuqsiz,
          issiqKun: iq.korsatkich.issiq_kun,
          minT: iq.korsatkich.min_t,
          kechSovuqYil: iq.korsatkich.kech_sovuq_yillar,
          toliqYillar: toliq,
        }
      : null,
    mexNom: ishonchli && t.mexanika ? t.mexanika.toLowerCase() : null,
    shorNom: ishonchli && t.shorlanish ? t.shorlanish.toLowerCase() : null,
    monokultura: monokultura(k.ekinlar ?? []),
    tuproqYoq: !ishonchli,
  }
}

const DARAJA_NOM = ['juda kam', 'kam', "o'rtacha", "ko'p", "juda ko'p"]

// ---------------------------------------------------------------- bonitet
function bonitetBali(c: Crop, k: Kirish, s: Sabab[]) {
  if (k.bonitet == null) {
    // Tuproq bonitirovkasi asosan sug'oriladigan dala yerlarida o'tkazilgan; lalmi va
    // yaylovda deyarli yo'q — bu yerlar unumdorligi pastligining bilvosita belgisi (jarima kattaroq).
    const organilmagan = k.foyd === 'lalmi' || k.foyd === 'yaylov'
    s.push({
      turi: 'ogoh',
      matn: organilmagan
        ? `Tuproq o'rganilmagan (${k.foyd === 'lalmi' ? 'lalmi' : 'yaylov'}) — dala tekshiruvi kerak`
        : "Bonitet ma'lumoti yo'q — baho taxminiy",
    })
    return organilmagan ? 0.55 : 0.75
  }
  const { bonitet_min: lo, bonitet_max: hi } = c
  if (k.bonitet < lo) {
    const chet = lo - k.bonitet
    s.push({ turi: 'ogoh', matn: `Bonitet ${k.bonitet} — talabdan ${chet} ball past (${lo}–${hi})` })
    return Math.max(0.15, 1 - chet / 15)
  }
  if (k.bonitet > hi) {
    s.push({ turi: 'ok', matn: `Bonitet ${k.bonitet} — talabdan yuqori, muammo emas` })
    return 1
  }
  // Oraliq ichida: talabchan ekin unumdor yerda potensialini ochadi (nozik farq, ±2 ball)
  const talabchanlik = Math.max(0, Math.min(1, (lo - 35) / 20))
  s.push({ turi: 'ok', matn: `Bonitet ${k.bonitet} — mos oraliqda (${lo}–${hi})` })
  return 0.98 + 0.02 * talabchanlik
}

// ------------------------------------------------------------ sho'rlanish
function shorBali(c: Crop, k: Kirish, s: Sabab[]) {
  if (k.shor == null) return 0.85
  const bosim = Math.max(0, k.shor - 1) // 0..4
  if (bosim === 0) {
    s.push({ turi: 'ok', matn: "Sho'rlanmagan" })
    return 1
  }
  const nom = k.shorNom ?? `daraja ${k.shor}`
  // Ekin chidamliligi 0..3 — chidamli ekin ko'proq bosimga bardosh beradi
  const ortiq = bosim - c.shor_chidam
  if (ortiq <= 0) {
    s.push({ turi: 'ok', matn: `Sho'rlanish ${nom} — ${c.nom} bardosh beradi` })
    return 1
  }
  if (ortiq >= 3) {
    // Hech qanday ekin bevosita o'smaydi; melioratsiyadan keyin eng chidamlilar mumkin
    s.push({ turi: 'xato', matn: `Sho'rlanish ${nom} — avval sho'r yuvish va drenaj, keyin ${c.nom}` })
    return c.shor_chidam >= 2 ? 0.28 : 0.12
  }
  s.push({ turi: 'ogoh', matn: `Sho'rlanish ${nom} — hosil pasayishi mumkin, sho'r yuvish kerak` })
  return ortiq === 1 ? 0.7 : 0.4
}

/**
 * Suv omili faqat me'yorni ko'rsatadi; o'ta suvtalab ekin uchungina ogohlantirish
 * (V1: barcha konturlar sug'oriladi deb qabul qilinadi).
 */
function suvBali(c: Crop, s: Sabab[]) {
  const talab = c.suv_min ?? 0
  const matn = c.suv_matn?.split(',')[0] ?? ''
  if (talab >= 10000) {
    s.push({ turi: 'ogoh', matn: `Juda suvtalab — ${matn}, suv resursi tekshirilsin` })
    return 0.7
  }
  if (talab >= 6000) {
    s.push({ turi: 'ogoh', matn: `Suvtalab ekin — ${matn}` })
    return 0.92
  }
  s.push({ turi: 'ok', matn: `Sug'orish me'yori: ${matn}` })
  return 1
}

// ------------------------------------------------------------- mexanika
/** Ildizmevalar og'ir tuproqda yomon o'sadi */
const ILDIZMEVA = new Set(['sabzi', 'kartoshka', 'osh-lavlagi', 'xashaki-lavlagi', 'piyoz', 'sarimsoqpiyoz'])

/** Ekin guruhining tuproq mexanikasiga talabi (kod: 2 yengil qumoq, 3 o'rta, 4 og'ir, 8 gilli) */
const MEX_MOSLIK: Record<string, Record<number, number>> = {
  boshoqli: { 2: 0.88, 3: 1.0, 4: 0.98, 8: 0.9 },
  texnika: { 2: 0.9, 3: 1.0, 4: 0.96, 8: 0.86 },
  dukkakli: { 2: 0.94, 3: 1.0, 4: 0.92, 8: 0.82 },
  sabzavot: { 2: 1.0, 3: 0.98, 4: 0.84, 8: 0.7 },
  poliz: { 2: 1.0, 3: 0.96, 4: 0.82, 8: 0.68 },
  yem: { 2: 0.9, 3: 1.0, 4: 0.96, 8: 0.9 },
  kopyillik: { 2: 0.96, 3: 1.0, 4: 0.9, 8: 0.78 },
}

function mexBali(c: Crop, k: Kirish, s: Sabab[]) {
  if (k.mex == null) return 0.9
  const nom = k.mexNom ?? `mexanika ${k.mex}`
  if (ILDIZMEVA.has(c.id) && k.mex >= 4) {
    s.push({ turi: 'ogoh', matn: `${nom} tuproq — ildizmeva shakli buzilishi mumkin` })
    return 0.55
  }
  if (c.id === 'sholi' && k.mex <= 2) {
    s.push({ turi: 'ogoh', matn: `${nom} tuproq — suv tez shimiladi, sholiga noqulay` })
    return 0.5
  }
  const mos = MEX_MOSLIK[c.guruh]?.[k.mex] ?? 1
  if (mos >= 0.98) s.push({ turi: 'ok', matn: `Tuproq mexanikasi ${nom} — ${c.nom} uchun qulay` })
  else if (mos >= 0.9) s.push({ turi: 'ok', matn: `Tuproq mexanikasi: ${nom}` })
  else s.push({ turi: 'ogoh', matn: `${nom} tuproq — ${c.nom} uchun unchalik qulay emas` })
  return mos
}

// -------------------------------------------------------------- qiyalik
function qiyalikBali(k: Kirish, s: Sabab[]) {
  const q = k.qiyalik
  if (q == null || q < 0) return 1
  if (q < 3) {
    s.push({ turi: 'ok', matn: `Qiyalik ${q.toFixed(1)}° — tekis, mexanizatsiyaga qulay` })
    return 1
  }
  if (q < 8) {
    s.push({ turi: 'ok', matn: `Qiyalik ${q.toFixed(1)}° — yengil nishab` })
    return 0.92
  }
  if (q < 15) {
    s.push({ turi: 'ogoh', matn: `Qiyalik ${q.toFixed(1)}° — eroziya xavfi, terrasalash kerak` })
    return 0.65
  }
  s.push({ turi: 'xato', matn: `Qiyalik ${q.toFixed(1)}° — dala ekinlari uchun juda tik` })
  return 0.25
}

// ------------------------------------------------------------ agrokimyo
/** O'g'it me'yori (matndan o'rtacha): 60 kg/ga → 0.85, 120 → 1.0, 220 → 1.2 */
function ogitTalabi(matn: string | null): number {
  if (!matn) return 1
  const m = matn.replace(/ /g, ' ').match(/(\d[\d\s]*)\s*[–\-—]\s*(\d[\d\s]*)/)
  if (!m) return 1
  const o = (parseInt(m[1].replace(/\s/g, ''), 10) + parseInt(m[2].replace(/\s/g, ''), 10)) / 2
  return Math.max(0.85, Math.min(1.2, 0.85 + (o - 60) / 800))
}

function agrokimyo(c: Crop, k: Kirish, s: Sabab[]) {
  let jarima = 0
  const tekshir = (d: number | null, nom: string, meyor: string | null) => {
    if (d == null || d > 1) return
    jarima += (d === 0 ? 3 : 1.8) * ogitTalabi(meyor)
    const qism = meyor ? ` — ${meyor.split(',')[0]}` : ''
    s.push({ turi: 'ogoh', matn: `${nom} ${DARAJA_NOM[d]}${qism}` })
  }
  // Gumus — dukkakli ekinlar azotni o'zi to'playdi
  if (k.gumus != null && k.gumus <= 1) {
    const dukkak = c.guruh === 'dukkakli'
    jarima += (k.gumus === 0 ? 3 : 1.8) * (dukkak ? 0.3 : ogitTalabi(c.ogit.azot))
    s.push({
      turi: dukkak ? 'ok' : 'ogoh',
      matn: dukkak
        ? `Gumus ${DARAJA_NOM[k.gumus]} — ${c.nom} azotni o'zi to'playdi`
        : `Gumus ${DARAJA_NOM[k.gumus]} — organik o'g'it kerak`,
    })
  }
  tekshir(k.fosfor, 'Fosfor', c.ogit.fosfor)
  tekshir(k.kaliy, 'Kaliy', c.ogit.kaliy)
  return jarima
}

// ----------------------------------------------------- ekinning ahamiyati
/** Diapazon ataylab tor (1.0–0.88): tartiblashga ta'sir qiladi, tuproq shartlarini bosib ketmaydi */
const AHAMIYAT: Record<string, number> = {
  bugdoy: 1.0,
  goza: 1.0,
  makkajoxori: 0.99,
  arpa: 0.98,
  beda: 0.98,
  tritikale: 0.95,
  kartoshka: 0.97,
  piyoz: 0.97,
  sabzi: 0.96,
  pomidor: 0.96,
  karam: 0.95,
  bodring: 0.94,
  tarvuz: 0.94,
  qovun: 0.94,
  mosh: 0.94,
  soya: 0.93,
  loviya: 0.93,
  noxot: 0.92,
  kungaboqar: 0.92,
  sholi: 0.9,
  'oq-joxori': 0.9,
  makka: 0.9,
  'xashaki-lavlagi': 0.92,
  'osh-lavlagi': 0.92,
  sarimsoqpiyoz: 0.94,
  qovoq: 0.92,
  qulupnay: 0.8, // tomchilatib sug'orish va pardali qoplama talab qiladi
}

/** Ro'yxatda yo'q ekinlar — kam tarqalgan */
const AHAMIYAT_SUKUT = 0.88

function ahamiyatBali(c: Crop, k: Kirish, s: Sabab[]) {
  let a = AHAMIYAT[c.id] ?? AHAMIYAT_SUKUT

  // Unumdor yerni yem-xashakka berish — resursdan noto'g'ri foydalanish
  if (c.guruh === 'yem' && k.bonitet != null && k.bonitet >= 65) {
    a *= k.bonitet >= 75 ? 0.5 : 0.7
    s.push({
      turi: 'ogoh',
      matn: `Bonitet ${k.bonitet} — unumdor yer, oziqa ekini o'rniga don yoki sabzavot foydaliroq`,
    })
    return a
  }
  if (a >= 0.94) s.push({ turi: 'ok', matn: 'Hududning asosiy ekini' })
  else if (a <= AHAMIYAT_SUKUT) s.push({ turi: 'ogoh', matn: 'Hududda kam tarqalgan — bozorini oldindan aniqlang' })
  return a
}

// --------------------------------------------------- hozirgi foydalanish
/** Ko'p yillik ekinzor qatorlari orasiga ekish (interkropping) uchun ekinning moslik koeffitsienti */
const QATOR_ORASI: Record<string, number> = {
  mosh: 1.0,
  loviya: 1.0,
  noxot: 0.97,
  soya: 0.94,
  yeryongoq: 0.94,
  sabzi: 0.9,
  piyoz: 0.9,
  sarimsoqpiyoz: 0.92,
  'osh-lavlagi': 0.88,
  karam: 0.85,
  bodring: 0.85,
  beda: 0.9,
  qovun: 0.7,
  tarvuz: 0.7,
  qovoq: 0.72,
  bugdoy: 0.35,
  arpa: 0.35,
  tritikale: 0.35,
  makkajoxori: 0.25,
  goza: 0.25,
  kungaboqar: 0.25,
  sholi: 0.1,
}

const FOYD_NOM: Record<Foyd, string> = {
  haydalma: 'haydalma',
  lalmi: 'lalmi',
  bog: "bog'",
  uzumzor: 'uzumzor',
  tutzor: 'tutzor',
  tomorqa: 'tomorqa',
  yaylov: 'yaylov',
  boshqa: 'boshqa yer',
}

export const KOPYILLIK: Foyd[] = ['bog', 'uzumzor', 'tutzor']

function foydalanishBali(c: Crop, k: Kirish, s: Sabab[]) {
  const dalaEkini = ['boshoqli', 'texnika', 'dukkakli', 'sabzavot', 'poliz'].includes(c.guruh)
  const foydNom = FOYD_NOM[k.foyd]

  if (KOPYILLIK.includes(k.foyd)) {
    if (c.guruh === 'kopyillik') {
      s.push({ turi: 'ok', matn: `Hozir ${foydNom} — ko'p yillik ekin o'rnida` })
      return 1
    }
    // Bog'ni ko'chirib tashlash tavsiya emas — qatorlar orasiga qo'shimcha ekin ekiladi
    const mos = QATOR_ORASI[c.id] ?? 0.6
    if (mos >= 0.9) {
      s.push({ turi: 'ok', matn: `${foydNom.charAt(0).toUpperCase() + foydNom.slice(1)} qatorlari orasiga ekish mumkin` })
    } else if (mos >= 0.7) {
      s.push({ turi: 'ogoh', matn: 'Qator orasiga ekish mumkin, lekin joy talab qiladi' })
    } else {
      s.push({
        turi: 'xato',
        matn: `${c.nom} ${foydNom} qatorlari orasiga mos emas — baland o'sadi, daraxtlarni soyalaydi`,
      })
    }
    return mos
  }
  if (k.foyd === 'yaylov') {
    if (c.guruh === 'yem') {
      s.push({ turi: 'ok', matn: 'Hozir yaylov — yem-xashak ekini tabiiy davomi' })
      return 1
    }
    s.push({ turi: 'ogoh', matn: "Hozir yaylov — haydashga o'tkazish kerak" })
    return 0.88
  }
  if ((k.foyd === 'haydalma' || k.foyd === 'lalmi') && dalaEkini) return 1
  if (k.foyd === 'tomorqa' && (c.guruh === 'sabzavot' || c.guruh === 'poliz')) {
    s.push({ turi: 'ok', matn: 'Tomorqa — sabzavot va poliz uchun qulay' })
    return 1
  }
  return 0.96
}

// ------------------------------------------------------------- mavsum
export type Mavsum = 'kuzgi' | 'bahorgi'

/** Ekish mavsumi: kuzgi (bug'doy) va bahorgi (g'o'za) raqib emas — almashlab ekishning turli qismlari */
export function mavsum(c: Crop): Mavsum {
  const m = (c.muddat ?? '').toLowerCase()
  return /^(sentyabr|oktyabr|kuzgi|avgust oxiri)/.test(m) ? 'kuzgi' : 'bahorgi'
}

export const MAVSUM_NOM: Record<Mavsum, string> = {
  kuzgi: 'Kuzgi ekish',
  bahorgi: 'Bahorgi ekish',
}

// ---------------------------------------------------------------- iqlim
const f0 = (v: number) => Math.round(v).toLocaleString('ru')

/**
 * Iqlim omili (ERA5-Land, konturga katak bo'yicha). Bir tuman ichida odatda 0,85–1.
 * Ma'lumot yo'q bo'lsa — 1 va "iqlim ma'lumoti yo'q" sababi.
 */
function iqlimBali(c: Crop, k: Kirish, s: Sabab[]) {
  const q = k.iqlim
  const t = c.iqlim
  if (!q) {
    s.push({ turi: 'ogoh', matn: "Iqlim ma'lumoti yo'q — iqlim omili hisobga olinmadi" })
    return 1
  }
  const kuzgiDon = mavsum(c) === 'kuzgi' && c.id !== 'qulupnay'

  // 4.1 + 4.2 — issiqlik yetarliligi va sovuqsiz davr (ikkalasi balandlikka bog'liq → min)
  let issiqlik = 1
  let issiqlikMatn: Sabab | null = null
  if (!kuzgiDon && t.fah_min && q.fah != null) {
    const opt = t.fah_opt ?? t.fah_min
    if (q.fah >= opt) {
      if (t.fah_min >= 2500)
        issiqlikMatn = { turi: 'ok', matn: `Faol haroratlar yig'indisi ${f0(q.fah)}°C — ${c.nom} uchun yetarli (talab ${f0(t.fah_min)})` }
    } else if (q.fah >= t.fah_min) {
      issiqlik = 0.9 + (0.1 * (q.fah - t.fah_min)) / Math.max(1, opt - t.fah_min)
      issiqlikMatn = { turi: 'ok', matn: `Faol haroratlar ${f0(q.fah)}°C — yetarli, lekin kechpishar navlarga kam (maqbul ${f0(opt)})` }
    } else {
      issiqlik = Math.max(0.3, 1 - 2.5 * (1 - q.fah / t.fah_min))
      issiqlikMatn = {
        turi: issiqlik < 0.5 ? 'xato' : 'ogoh',
        matn: `Faol haroratlar ${f0(q.fah)}°C — ${c.nom} uchun yetmaydi (talab ${f0(t.fah_min)}), hosil to'liq pishmaydi`,
      }
    }
  }
  if (t.sovuqsiz_min && q.sovuqsiz != null && q.sovuqsiz < t.sovuqsiz_min) {
    const sk = Math.max(0.6, 1 - 0.01 * (t.sovuqsiz_min - q.sovuqsiz))
    if (sk < issiqlik) {
      issiqlik = sk
      issiqlikMatn = {
        turi: 'ogoh',
        matn: `Sovuqsiz davr ${Math.round(q.sovuqsiz)} kun — ${c.nom} uchun qisqa (talab ${t.sovuqsiz_min}), erta kuzgi sovuq xavfi`,
      }
    }
  }
  if (issiqlikMatn) s.push(issiqlikMatn)

  // 4.3 — kech bahorgi sovuq. V1: "10 yilda N marta"; V2: ulush × 10 (davr qisqa bo'lsa taxminiy)
  let kech = 1
  if (q.toliqYillar > 0) {
    const n = (q.kechSovuqYil / q.toliqYillar) * 10
    if (c.id === 'qulupnay') kech = n >= 4 ? 0.8 : n >= 2 ? 0.9 : 1
    else if (!kuzgiDon && t.sovuqqa_chidam === 0) kech = n >= 4 ? 0.85 : n >= 2 ? 0.93 : 1
    else if (!kuzgiDon && t.sovuqqa_chidam === 1) kech = n >= 4 ? 0.95 : 1
    if (kech < 1) {
      const davr = `${q.toliqYillar} yilning ${q.kechSovuqYil} tasida`
      s.push({
        turi: 'ogoh',
        matn:
          n >= 4
            ? `Kech bahorgi sovuq ${davr} — gullash davrida hosil nobud bo'lish xavfi`
            : `Kech bahorgi sovuq ${davr} — ekish muddatini kechiktiring`,
      })
    }
  }

  // 4.4 — jazirama (Tmax ≥ 35 °C kunlar)
  let issiq = 1
  const kun = q.issiqKun
  if (kun != null) {
    const JADVAL: Record<number, number[]> = {
      3: [1, 1, 1, 1],
      2: [1, 1, 1, 0.95],
      1: [1, 0.95, 0.9, 0.85],
      0: [1, 0.9, 0.8, 0.7],
    }
    const oraliq = kun <= 20 ? 0 : kun <= 40 ? 1 : kun <= 60 ? 2 : 3
    issiq = (JADVAL[t.issiqqa_chidam] ?? JADVAL[2])[oraliq]
    if (kuzgiDon) issiq = Math.max(0.95, issiq)
    if (issiq < 1)
      s.push({
        turi: 'ogoh',
        matn: kuzgiDon
          ? `Yozda ${Math.round(kun)} kun jazirama — don to'lishida garmsel xavfi`
          : `Yozda ${Math.round(kun)} kun ≥35°C — ${c.nom}ni erta bahorgi yoki kuzgi muddatda eking`,
      })
  }

  // 4.5 — qishki sovuq (faqat qishlaydigan ekinlar)
  let qish = 1
  if (t.qishlash_min != null && q.minT != null) {
    const farq = t.qishlash_min - q.minT
    if (farq > 3) qish = 0.7
    else if (farq > 0) qish = 0.85
    if (qish < 1)
      s.push({
        turi: 'ogoh',
        matn: `Yillik minimum ${q.minT.toFixed(1).replace('.', ',')}°C — qishki ayoz xavfi (chidaydi ${t.qishlash_min}°C gacha)`,
      })
  }

  return Math.max(0.45, issiqlik * kech * issiq * qish)
}

// ------------------------------------------------------------------ asos
export function baholash(c: Crop, k: Kirish): Tavsiya {
  const s: Sabab[] = []

  const b = bonitetBali(c, k, s)
  const sh = shorBali(c, k, s)
  const w = suvBali(c, s)
  const m = mexBali(c, k, s)
  const q = qiyalikBali(k, s)
  const f = foydalanishBali(c, k, s)
  const a = ahamiyatBali(c, k, s)
  const iq = iqlimBali(c, k, s)

  const kopaytma = b * sh * w * m * q * f * a * iq
  const jarima = kopaytma > 0 ? agrokimyo(c, k, s) : 0
  const ball = Math.max(0, Math.round(kopaytma * 100 - jarima))

  // Ketma-ket ekish (V1 Ekinlar tabidagi ogohlantirish): ballga ta'sir qilmaydi, sabab sifatida
  const mono = k.monokultura
  if (mono && mono.id === c.id) {
    s.push({
      turi: 'ogoh',
      matn: `${mono.yillar} yil ketma-ket ekilgan (${mono.dan}–${mono.gacha}) — tuproq charchashi va kasallik xavfi, almashlab ekish tavsiya etiladi`,
    })
  } else if (mono && c.guruh === 'dukkakli') {
    s.push({ turi: 'ok', matn: 'Almashlab ekish uchun mos — tuproq azotini tiklaydi' })
  }

  let radSabab: string | null = null
  if (ball < 25) {
    const xato = s.find((x) => x.turi === 'xato')
    radSabab = xato?.matn ?? 'Shart-sharoit mos emas'
  }

  return { crop: c, ball, sabablar: s, radSabab }
}

export function tavsiyalar(k: Kirish, crops: Crop[] = EKINLAR): Tavsiya[] {
  return crops.map((c) => baholash(c, k)).sort((a, b) => b.ball - a.ball)
}

/** Ball rangi — svetofor emas, gradatsiya */
export function ballRang(ball: number): string {
  if (ball >= 85) return 'var(--color-score-90)'
  if (ball >= 70) return 'var(--color-score-70)'
  if (ball >= 50) return 'var(--color-score-50)'
  if (ball >= 25) return 'var(--color-score-30)'
  return 'var(--color-score-0)'
}

export function ballNom(ball: number): string {
  if (ball >= 85) return "A'lo"
  if (ball >= 70) return 'Yaxshi'
  if (ball >= 50) return "O'rtacha"
  if (ball >= 25) return 'Zaif'
  return 'Mos emas'
}
