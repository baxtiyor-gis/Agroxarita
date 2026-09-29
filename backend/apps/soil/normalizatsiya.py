"""Tuproq ma'lumotlarini normallashtirish (sof Python, Django/GDAL'ga bog'liq emas)."""
import re

O_G_APOSTROF = "‘"  # o' / g'
BOSHQA_APOSTROF = "’"  # tutuq belgisi

_UNLILAR = set("аеёиоуўэюяыАЕЁИОУЎЭЮЯЫ")

# kirill (kichik harf) -> lotin
_XARITA = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "ё": "yo", "ж": "j", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p",
    "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "x", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "shch", "ы": "i", "э": "e", "ю": "yu", "я": "ya",
    "ў": "o" + O_G_APOSTROF, "ғ": "g" + O_G_APOSTROF, "қ": "q", "ҳ": "h",
}


def _katta(harf):
    return harf.isalpha() and harf.isupper()


def kirill_lotin(matn):
    """O'zbek kirill -> lotin. Apostrof: o‘/g‘ uchun U+2018, tutuq (ъ) uchun U+2019."""
    if matn is None:
        return ""
    matn = str(matn)
    chiqish = []
    for i, h in enumerate(matn):
        kichik = h.lower()
        if kichik == "ь":
            continue
        if kichik == "ъ":
            chiqish.append(BOSHQA_APOSTROF)
            continue
        oldingi = matn[i - 1] if i > 0 else ""
        keyingi = matn[i + 1] if i + 1 < len(matn) else ""
        if kichik == "е":
            lotin = "ye" if (not oldingi.isalpha() or oldingi in _UNLILAR) else "e"
        elif kichik in _XARITA:
            lotin = _XARITA[kichik]
        else:
            chiqish.append(h)  # lotin harf, raqam, bo'shliq, tinish belgilari
            continue
        if _katta(h):
            butun_katta = len(lotin) > 1 and (_katta(keyingi) or _katta(oldingi))
            lotin = lotin.upper() if butun_katta else lotin[0].upper() + lotin[1:]
        chiqish.append(lotin)
    return "".join(chiqish)


_SON = r"(\d+(?:[.,]\d+)?)"
_ORALIQ_RE = re.compile(rf"{_SON}\s*[-–—]\s*{_SON}")
_KATTA_RE = re.compile(rf">\s*{_SON}")
_KICHIK_RE = re.compile(rf"<\s*{_SON}")
_YAKKA_RE = re.compile(_SON)


def _son(s):
    return float(s.replace(",", "."))


def _fmt(x):
    return str(int(x)) if x == int(x) else str(x).replace(".", ",")


def yer_osti_suvi_parse(matn):
    """Yer osti suvi chuqurligi (m) -> (normal_matn, min, max).

    '1-2' -> ('1–2', 1, 2); '>10' -> ('>10', 10, None); '<1' -> ('<1', None, 1);
    '5' -> ('5', 5, 5); bo'sh -> (None, None, None); tushunarsiz -> (tozalangan matn, None, None).
    """
    if matn is None:
        return (None, None, None)
    toza = " ".join(str(matn).split())
    if not toza:
        return (None, None, None)
    m = _ORALIQ_RE.fullmatch(toza)
    if m:
        a, b = _son(m.group(1)), _son(m.group(2))
        return (f"{_fmt(a)}–{_fmt(b)}", a, b)
    m = _KATTA_RE.fullmatch(toza)
    if m:
        a = _son(m.group(1))
        return (f">{_fmt(a)}", a, None)
    m = _KICHIK_RE.fullmatch(toza)
    if m:
        b = _son(m.group(1))
        return (f"<{_fmt(b)}", None, b)
    m = _YAKKA_RE.fullmatch(toza)
    if m:
        a = _son(m.group(1))
        return (_fmt(a), a, a)
    return (toza, None, None)
