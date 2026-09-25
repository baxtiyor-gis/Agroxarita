import type { Crop, Kontur, Sabab, Tavsiya } from './types'

/**
 * Ekin mosligini baholash — Agrobooks me'yorlari asosida.
 *
 * Ball = 100 × (bonitet × sho'rlanish × suv × mexanika × qiyalik) − agrokimyo jarimasi
 *
 * Har bir ko'paytuvchi kartochkada o'z satri bilan ko'rsatiladi, shuning uchun
 * foydalanuvchi "nega?" deb so'rashi shart emas — sabab doim ko'rinadi.
 */

const DARAJA_NOM = ['juda kam', 'kam', "o'rtacha", "ko'p", "juda ko'p"]
const MEX_NOM: Record<number, string> = {
  1: 'qumli',
  2: 'qumoq',
  3: "o'rta qumoq",
  4: 'og‘ir qumoq',
  8: 'gilli',
}
const SHOR_NOM: Record<number, string> = {
  1: "sho'rlanmagan",
  2: 'kuchsiz',
  3: "o'rtacha",
  4: 'kuchli',
  5: 'juda kuchli',
  6: "sho'rxok",
}

/** Ekin nomini kelishik bilan ishlatish uchun kichik yordamchi */
const yoq = (v: number) => v === -1 || v === null || v === undefined

// ---------------------------------------------------------------- bonitet
function bonitetBali(c: Crop, k: Kontur, s: Sabab[]) {
  if (yoq(k.bonitet)) {
    // Tuproq bonitirovkasi asosan sug'oriladigan dala yerlarida o'tkazilgan.
    // Ma'lumot yo'qligi tasodif emas: lalmi (72%) va yaylov (59%) konturlarda
    // u deyarli har doim yo'q — bu yerlarning unumdorligi past ekanining
    // bilvosita belgisi, shuning uchun jarima kattaroq.
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
    // Talabdan past — chiziqli pasayish
    const chet = lo - k.bonitet
    s.push({ turi: 'ogoh', matn: `Bonitet ${k.bonitet} — talabdan ${chet} ball past (${lo}–${hi})` })
    return Math.max(0.15, 1 - chet / 15)
  }
  if (k.bonitet > hi) {
    s.push({ turi: 'ok', matn: `Bonitet ${k.bonitet} — talabdan yuqori, muammo emas` })
    return 1
  }
  // Oraliq ichida: unumdorlikdan qanchalik foydalanilayotgani. Talabchan ekin
  // unumdor yerda o'z potensialini to'liq ochadi — ammo bu nozik farq (±2 ball),
  // shart-sharoitga mosligidan ustun kelmasligi kerak.
  const talabchanlik = Math.max(0, Math.min(1, (lo - 35) / 20))
  const koef = 0.98 + 0.02 * talabchanlik
  s.push({ turi: 'ok', matn: `Bonitet ${k.bonitet} — mos oraliqda (${lo}–${hi})` })
  return koef
}

// ------------------------------------------------------------ sho'rlanish
function shorBali(c: Crop, k: Kontur, s: Sabab[]) {
  if (yoq(k.shor)) return 0.85
  // soil_shorlanishi: 1 = sho'rlanmagan ... 6 = sho'rxok
  const bosim = Math.max(0, k.shor - 1) // 0..5
  if (bosim === 0) {
    s.push({ turi: 'ok', matn: "Sho'rlanmagan" })
    return 1
  }
  // Ekin chidamliligi 0..3 — chidamli ekin ko'proq bosimga bardosh beradi
  const chidam = c.shor_chidam
  const ortiq = bosim - chidam
  const nom = SHOR_NOM[k.shor] ?? `daraja ${k.shor}`
  if (ortiq <= 0) {
    s.push({ turi: 'ok', matn: `Sho'rlanish ${nom} — ${c.nom} bardosh beradi` })
    return 1
  }
  if (ortiq >= 3) {
    // Sho'rxok yerlar (354 kontur) — hech qanday ekin bevosita o'smaydi.
    // Nolga tushirmaymiz: melioratsiyadan keyin eng chidamli ekinlar mumkin,
    // shuning uchun juda past ball + aniq shart bilan ko'rsatamiz.
    s.push({
      turi: 'xato',
      matn: `Sho'rlanish ${nom} — avval sho'r yuvish va drenaj, keyin ${c.nom}`,
    })
    return c.shor_chidam >= 2 ? 0.28 : 0.12
  }
  s.push({ turi: 'ogoh', matn: `Sho'rlanish ${nom} — hosil pasayishi mumkin, sho'r yuvish kerak` })
  return ortiq === 1 ? 0.7 : 0.4
}


/**
 * Barcha konturlar sug'oriladigan deb qabul qilinadi (hudud sug'orma
 * dehqonchilik zonasi). Suv omili faqat me'yorni ko'rsatadi, jarima bermaydi —
 * sholidek o'ta suvtalab ekin uchungina ogohlantirish beriladi.
 */
function suvBali(c: Crop, _k: Kontur, s: Sabab[]) {
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

function mexBali(c: Crop, k: Kontur, s: Sabab[]) {
  if (yoq(k.mex)) return 0.9
  const nom = MEX_NOM[k.mex] ?? `mexanika ${k.mex}`

  // Ildizmevalar og'ir tuproqda shaklini buzadi — eng qattiq cheklov
  if (ILDIZMEVA.has(c.id) && k.mex >= 4) {
    s.push({ turi: 'ogoh', matn: `${nom} tuproq — ildizmeva shakli buzilishi mumkin` })
    return 0.55
  }
  if (c.id === 'sholi' && k.mex <= 2) {
    s.push({ turi: 'ogoh', matn: `${nom} tuproq — suv tez shimiladi, sholiga noqulay` })
    return 0.5
  }

  // Guruh bo'yicha mexanik moslik
  const mos = mexMoslik(c, k)
  if (mos >= 0.98) {
    s.push({ turi: 'ok', matn: `Tuproq mexanikasi ${nom} — ${c.nom} uchun qulay` })
  } else if (mos >= 0.9) {
    s.push({ turi: 'ok', matn: `Tuproq mexanikasi: ${nom}` })
  } else {
    s.push({ turi: 'ogoh', matn: `${nom} tuproq — ${c.nom} uchun unchalik qulay emas` })
  }
  return mos
}

// -------------------------------------------------------------- qiyalik
function qiyalikBali(k: Kontur, s: Sabab[]) {
  if (yoq(k.qiyalik) || k.qiyalik < 0) return 1
  const q = k.qiyalik
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

// --------------------------------------------------- tuproq mos kelishi
/**
 * Ekin guruhining tuproq mexanikasiga talabi.
 *
 * Bu AHAMIYAT dan mustaqil omil: unumdorlik bir xil bo'lsa ham, og'ir gilli
 * tuproqda sabzavot emas, g'alla yaxshi o'sadi. Shu omil bo'lmasa ro'yxat
 * faqat "muhimlik" tartibiga aylanib qoladi.
 *
 * Mexanika kodi: 2 = qumoq, 3 = o'rta qumoq, 4 = og'ir qumoq, 8 = gilli
 */
const MEX_MOSLIK: Record<string, Record<number, number>> = {
  //        qumoq  o'rta  og'ir  gilli
  boshoqli: { 2: 0.88, 3: 1.0, 4: 0.98, 8: 0.9 },
  texnika: { 2: 0.9, 3: 1.0, 4: 0.96, 8: 0.86 },
  dukkakli: { 2: 0.94, 3: 1.0, 4: 0.92, 8: 0.82 },
  sabzavot: { 2: 1.0, 3: 0.98, 4: 0.84, 8: 0.7 },
  poliz: { 2: 1.0, 3: 0.96, 4: 0.82, 8: 0.68 },
  yem: { 2: 0.9, 3: 1.0, 4: 0.96, 8: 0.9 },
  kopyillik: { 2: 0.96, 3: 1.0, 4: 0.9, 8: 0.78 },
}

function mexMoslik(c: Crop, k: Kontur): number {
  if (yoq(k.mex)) return 1
  return MEX_MOSLIK[c.guruh]?.[k.mex] ?? 1
}

// ------------------------------------------------------------ agrokimyo
/**
 * NPK tanqisligi — o'g'it bilan qoplanadi, shuning uchun jarima kichik.
 * Ammo o'g'itga talabi yuqori ekin tanqis tuproqda ko'proq yutqazadi:
 * jarima ekinning o'z me'yoriga proporsional.
 */
function ogitTalabi(matn: string | null): number {
  if (!matn) return 1
  const m = matn.replace(/ /g, ' ').match(/(\d[\d\s]*)\s*[–\-—]\s*(\d[\d\s]*)/)
  if (!m) return 1
  const o = (parseInt(m[1].replace(/\s/g, ''), 10) + parseInt(m[2].replace(/\s/g, ''), 10)) / 2
  // Diapazon tor: 60 kg/ga → 0.85, 120 → 1.0, 220 → 1.2.
  // NPK tanqisligi o'g'itlash bilan hal bo'ladi — u ekin tanlovini
  // belgilamasligi kerak, faqat xarajat farqini bildiradi.
  return Math.max(0.85, Math.min(1.2, 0.85 + (o - 60) / 800))
}

function agrokimyo(c: Crop, k: Kontur, s: Sabab[]) {
  let jarima = 0
  const tekshir = (d: number, nom: string, meyor: string | null) => {
    if (yoq(d) || d > 1) return
    const asos = d === 0 ? 3 : 1.8
    jarima += asos * ogitTalabi(meyor)
    const qism = meyor ? ` — ${meyor.split(',')[0]}` : ''
    s.push({ turi: 'ogoh', matn: `${nom} ${DARAJA_NOM[d]}${qism}` })
  }
  // Gumus — dukkakli ekinlar azotni o'zi to'playdi, ular kam yutqazadi
  if (!yoq(k.gumus) && k.gumus <= 1) {
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
/**
 * Hududning asosiy ekinlari birinchi navbatda tavsiya etiladi.
 *
 * Bulung'ur — sug'orma dehqonchilik zonasi: g'alla va paxta almashlab ekish
 * asosi, beda oraliq ekin. Kunjut yoki mahsar agronomik jihatdan mos bo'lsa
 * ham, ular asosiy ekin emas — ro'yxat boshida turishi noto'g'ri.
 */
/**
 * Diapazon ataylab tor (1.0–0.88): ahamiyat tartiblashga ta'sir qiladi, ammo
 * tuproq shartlarini bosib ketmasligi kerak. Aks holda ro'yxat har konturda
 * bir xil bo'lib qoladi — bu tavsiya emas, oddiy reyting.
 */
const AHAMIYAT: Record<string, number> = {
  // Strategik ekinlar — davlat buyurtmasi va almashlab ekish asosi
  bugdoy: 1.0,
  goza: 1.0,
  makkajoxori: 0.99,
  arpa: 0.98,
  beda: 0.98,
  tritikale: 0.95, // bug'doy bilan bir xil ekin, kamroq tarqalgan
  // Keng tarqalgan sabzavot va poliz
  kartoshka: 0.97,
  piyoz: 0.97,
  sabzi: 0.96,
  pomidor: 0.96,
  karam: 0.95,
  bodring: 0.94,
  tarvuz: 0.94,
  qovun: 0.94,
  // Dukkakli — takroriy ekin sifatida qadrli
  mosh: 0.94,
  soya: 0.93,
  loviya: 0.93,
  noxot: 0.92,
  // Boshqa texnika ekinlari
  kungaboqar: 0.92,
  sholi: 0.9,
  'oq-joxori': 0.9,
  makka: 0.9,
  'xashaki-lavlagi': 0.92,
  'osh-lavlagi': 0.92,
  sarimsoqpiyoz: 0.94,
  qovoq: 0.92,
  // Qulupnay — tomchilatib sug'orish va pardali qoplama talab qiladi,
  // hududda sanoat miqyosida yetishtirilmaydi
  qulupnay: 0.8,
}

/** Ro'yxatda yo'q ekinlar — kam tarqalgan (kunjut, mahsar, zig'ir, brokkoli...) */
const AHAMIYAT_SUKUT = 0.88

function ahamiyatBali(c: Crop, k: Kontur, s: Sabab[]) {
  let a = AHAMIYAT[c.id] ?? AHAMIYAT_SUKUT

  // Unumdor yerni yem-xashakka berish — resursdan noto'g'ri foydalanish.
  // Beda almashlab ekishda kerak, ammo uning o'rni past bonitetli yerlar.
  if (c.guruh === 'yem' && !yoq(k.bonitet) && k.bonitet >= 65) {
    a *= k.bonitet >= 75 ? 0.5 : 0.7
    s.push({
      turi: 'ogoh',
      matn: `Bonitet ${k.bonitet} — unumdor yer, oziqa ekini o'rniga don yoki sabzavot foydaliroq`,
    })
    return a
  }

  if (a >= 0.94) {
    s.push({ turi: 'ok', matn: 'Hududning asosiy ekini' })
  } else if (a <= AHAMIYAT_SUKUT) {
    s.push({ turi: 'ogoh', matn: 'Hududda kam tarqalgan — bozorini oldindan aniqlang' })
  }
  return a
}

// --------------------------------------------------- hozirgi foydalanish
/**
 * Ko'p yillik ekinzor (bog', uzumzor, tutzor) allaqachon o'rnatilgan bo'lsa,
 * uni bir yillik ekinga almashtirish katta xarajat — buni hisobga olamiz.
 *
 * Teskarisi ham muhim: konturda hozir haydalma dehqonchilik bo'lsa, dala
 * ekinlari infrastruktura tayyor holda ekiladi — bu real ustunlik.
 */
/**
 * Ko'p yillik ekinzor qatorlari orasiga ekish (interkropping).
 *
 * O'zbekistonda keng tarqalgan amaliyot: bog' va uzumzor qatorlari orasi
 * 4–6 m, yosh bog'da esa yanada keng — bu maydon bo'sh turmasligi kerak.
 * Mos ekin soyaga chidamli, past bo'yli va ildizi sayoz bo'lishi lozim.
 *
 * Koeffitsient — qator oralig'idagi ekin sifatida qanchalik mos.
 */
const QATOR_ORASI: Record<string, number> = {
  // Dukkakli — eng yaxshi: azot to'playdi, past bo'yli, bog'ga foyda keltiradi
  mosh: 1.0,
  loviya: 1.0,
  noxot: 0.97,
  soya: 0.94,
  yeryongoq: 0.94,
  // Sabzavot — soyaga chidamli, sug'orish bog' bilan birga
  sabzi: 0.9,
  piyoz: 0.9,
  sarimsoqpiyoz: 0.92,
  'osh-lavlagi': 0.88,
  karam: 0.85,
  bodring: 0.85,
  // Yem-xashak — bog' ostida siderat sifatida
  beda: 0.9,
  // Poliz — ko'p joy egallaydi, faqat keng qatorli yosh bog'da
  qovun: 0.7,
  tarvuz: 0.7,
  qovoq: 0.72,
  // Boshoqli va texnika ekinlari mos emas: baland, mexanizatsiya bog'ga zarar
  bugdoy: 0.35,
  arpa: 0.35,
  tritikale: 0.35,
  makkajoxori: 0.25,
  goza: 0.25,
  kungaboqar: 0.25,
  sholi: 0.1,
}

function foydalanishBali(c: Crop, k: Kontur, s: Sabab[]) {
  const kopyillik = ['bog', 'uzumzor', 'tutzor'].includes(k.foyd)
  const dalaEkini = ['boshoqli', 'texnika', 'dukkakli', 'sabzavot', 'poliz'].includes(c.guruh)
  const foydNom = k.foyd === 'bog' ? "bog'" : k.foyd

  if (kopyillik) {
    if (c.guruh === 'kopyillik') {
      s.push({ turi: 'ok', matn: `Hozir ${foydNom} — ko'p yillik ekin o'rnida` })
      return 1
    }
    // Bog'ni ko'chirib tashlash tavsiya emas — u allaqachon qiymatli.
    // Aksincha: qatorlar orasiga qo'shimcha ekin ekish mumkin.
    const mos = QATOR_ORASI[c.id] ?? 0.6
    if (mos >= 0.9) {
      s.push({
        turi: 'ok',
        matn: `${foydNom.charAt(0).toUpperCase() + foydNom.slice(1)} qatorlari orasiga ekish mumkin`,
      })
    } else if (mos >= 0.7) {
      s.push({ turi: 'ogoh', matn: `Qator orasiga ekish mumkin, lekin joy talab qiladi` })
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
  // Haydalma yoki lalmi — dala ekinlari uchun tayyor maydon
  if ((k.foyd === 'haydalma' || k.foyd === 'lalmi') && dalaEkini) {
    return 1
  }
  if (k.foyd === 'tomorqa' && (c.guruh === 'sabzavot' || c.guruh === 'poliz')) {
    s.push({ turi: 'ok', matn: 'Tomorqa — sabzavot va poliz uchun qulay' })
    return 1
  }
  return 0.96
}

// ------------------------------------------------------------- mavsum
/**
 * Ekish mavsumi — tavsiyani mazmunli guruhlarga ajratadi.
 *
 * Bug'doy (kuzgi) va g'o'za (bahorgi) raqib emas: ular almashlab ekish
 * tizimining turli qismlari. Mavsumni ko'rsatmasak, ro'yxat "bug'doy yoki
 * g'o'za?" degan noto'g'ri tanlovga majburlaydi.
 */
export type Mavsum = 'kuzgi' | 'bahorgi'

export function mavsum(c: Crop): Mavsum {
  const m = (c.muddat ?? '').toLowerCase()
  // Kuzda ekiladigan: sentyabr-oktyabr bilan boshlanadi
  return /^(sentyabr|oktyabr|kuzgi|avgust oxiri)/.test(m) ? 'kuzgi' : 'bahorgi'
}

export const MAVSUM_NOM: Record<Mavsum, string> = {
  kuzgi: 'Kuzgi ekish',
  bahorgi: 'Bahorgi ekish',
}

// ------------------------------------------------------------------ asos
export function baholash(c: Crop, k: Kontur): Tavsiya {
  const s: Sabab[] = []

  const b = bonitetBali(c, k, s)
  const sh = shorBali(c, k, s)
  const w = suvBali(c, k, s)
  const m = mexBali(c, k, s)
  const q = qiyalikBali(k, s)
  const f = foydalanishBali(c, k, s)
  const a = ahamiyatBali(c, k, s)

  const kopaytma = b * sh * w * m * q * f * a
  const jarima = kopaytma > 0 ? agrokimyo(c, k, s) : 0
  const ball = Math.max(0, Math.round(kopaytma * 100 - jarima))

  // Nega rad etildi — eng jiddiy to'siqni topamiz
  let radSabab: string | null = null
  if (ball < 25) {
    const xato = s.find((x) => x.turi === 'xato')
    radSabab = xato?.matn ?? 'Shart-sharoit mos emas'
  }

  return { crop: c, ball, sabablar: s, radSabab }
}

export function tavsiyalar(crops: Crop[], k: Kontur): Tavsiya[] {
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
