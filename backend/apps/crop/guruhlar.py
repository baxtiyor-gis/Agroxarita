"""Ekin guruhlari: domen kodi -> qisqa guruh kodi (sof Python)."""

# guruh kodi -> nom (API va legenda uchun; tartib — ko'rsatish tartibi)
GURUHLAR = {
    "paxta": "Paxta",
    "galla": "Don (g‘alla, arpa, javdar, suli)",
    "sholi": "Sholi",
    "makkajoxori": "Makkajo‘xori (don)",
    "moyli": "Moyli ekinlar",
    "sabzavot": "Sabzavot",
    "poliz": "Poliz",
    "dukkakli": "Dukkakli ekinlar",
    "kartoshka": "Kartoshka",
    "ozuqa": "Ozuqa ekinlari",
    "bog": "Bog‘ va mevali daraxtlar",
    "uzum": "Uzumzor",
    "boshqa": "Boshqa (texnik, dorivor va h.k.)",
}
GURUH_TANLOV = list(GURUHLAR.items())

_KOD_ORALIQ = {  # aniq kodlar (prefiksdan ustun)
    101010000: "paxta",
    102010000: "galla", 102020000: "galla", 102040000: "galla", 102050000: "galla",
    102060000: "makkajoxori",
    102080000: "sholi",
    109000000: "bog",
    109190000: "uzum",
    113000000: "bog",
}
_PREFIKS = (("103", "moyli"), ("104", "sabzavot"), ("105", "poliz"), ("106", "dukkakli"),
            ("107", "kartoshka"), ("108", "ozuqa"), ("109", "bog"))
_OZUQA_KICHIK = {5, 6, 7, 9}  # "... (ozuqa uchun)": g‘alla, arpa, g‘alla+beda, tritikale


def guruh_kodi(kod):
    """Domen kodi -> guruh kodi ('paxta', 'galla', ..., 'boshqa')."""
    kod = int(kod)
    if kod in _KOD_ORALIQ:
        return _KOD_ORALIQ[kod]
    if kod in _OZUQA_KICHIK:
        return "ozuqa"
    s = str(kod)
    for prefiks, guruh in _PREFIKS:
        if s.startswith(prefiks):
            return guruh
    return "boshqa"
