"""Manba ma'lumotlarini normallashtirish (sof Python, Django/GDAL'ga bog'liq emas)."""
import re

# manbada aralash uchraydigan apostrof belgilari
_APOSTROFLAR = "\u2018\u2019'`\u02bb\u02bc\u00b4\u2032"
_APOSTROF_RE = re.compile(f"[{re.escape(_APOSTROFLAR)}]")

O_G_APOSTROF = "\u2018"  # o' / g' (oz, gz)
BOSHQA_APOSTROF = "\u2019"  # tutuq belgisi (ma'no, ...)

_TIP_XARITA = {
    "t": "tuman",  # lotin T
    "\u0442": "tuman",  # kirill т
    "ш": "shahar",  # kirill Ш
    "s": "shahar",
    "sh": "shahar",
}


def apostrof(matn):
    """`o`/`g` dan keyin ‘ (U+2018), boshqa joyda ’ (U+2019)."""

    def almashtir(m):
        oldingi = m.string[m.start() - 1] if m.start() > 0 else ""
        return O_G_APOSTROF if oldingi in "oOgG" else BOSHQA_APOSTROF

    return _APOSTROF_RE.sub(almashtir, matn)


def nom(matn):
    """Nomni tozalash: apostrof birxillashtiriladi, ortiqcha bo'shliqlar olib tashlanadi."""
    if matn is None:
        return ""
    return " ".join(apostrof(str(matn)).split())


def tip(qiymat):
    """`T`/`Т` -> 'tuman', `Ш` -> 'shahar'. Tanib bo'lmasa None."""
    if qiymat is None:
        return None
    return _TIP_XARITA.get(str(qiymat).strip().casefold())


def kod(cad_raqami):
    """'12:01' -> 1201. Noto'g'ri format bo'lsa ValueError."""
    m = re.fullmatch(r"\s*(\d{1,2})\s*:\s*(\d{2})\s*", str(cad_raqami or ""))
    if not m:
        raise ValueError(f"cad_raqami formati noto'g'ri: {cad_raqami!r}")
    return int(m.group(1)) * 100 + int(m.group(2))
