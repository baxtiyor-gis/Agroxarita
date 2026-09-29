import pytest

from apps.soil.normalizatsiya import kirill_lotin, yer_osti_suvi_parse


@pytest.mark.parametrize(
    "kirill, lotin",
    [
        ("Ўрта қумоқли", "O‘rta qumoqli"),
        ("Шўрланмаган", "Sho‘rlanmagan"),
        ("Енгил қумоқли", "Yengil qumoqli"),
        ("Оғир", "Og‘ir"),
        ("Баъзан", "Ba’zan"),
        ("Кучсиз шўрланган", "Kuchsiz sho‘rlangan"),
        ("Ҳосилдор", "Hosildor"),
        ("Чала", "Chala"),
        ("Ёмон", "Yomon"),
        ("Юқори", "Yuqori"),
        ("Ялпи", "Yalpi"),
        ("Мева", "Meva"),
        ("Аъло", "A’lo"),
        ("ЎРТА", "O‘RTA"),
        ("ШЎР", "SHO‘R"),
        ("", ""),
        (None, ""),
        ("Loam 5", "Loam 5"),
    ],
)
def test_kirill_lotin(kirill, lotin):
    assert kirill_lotin(kirill) == lotin


@pytest.mark.parametrize(
    "kirish, natija",
    [
        ("1-2", ("1–2", 1, 2)),
        ("1 - 2", ("1–2", 1, 2)),
        ("1,5 - 2", ("1,5–2", 1.5, 2)),
        ("1.5-2.5", ("1,5–2,5", 1.5, 2.5)),
        (">10", (">10", 10, None)),
        ("> 10", (">10", 10, None)),
        ("<1", ("<1", None, 1)),
        ("5", ("5", 5, 5)),
        (" ", (None, None, None)),
        ("", (None, None, None)),
        (None, (None, None, None)),
        ("  chuqur   suv ", ("chuqur suv", None, None)),
    ],
)
def test_yer_osti_suvi_parse(kirish, natija):
    assert yer_osti_suvi_parse(kirish) == natija
