from django.db import models


class KonturRelyef(models.Model):
    """Kontur relyefi: Copernicus DEM GLO-30 dan zonal statistika (`hisobla_relyef`)."""

    TEKIS, YENGIL, ORTA, TIK = "tekis", "yengil", "orta", "tik"
    SINF_TANLOV = [(TEKIS, "Tekis (<1°)"), (YENGIL, "Yengil (1-3°)"), (ORTA, "O'rta (3-7°)"), (TIK, "Tik (>7°)")]
    # 8 tomon (aspect azimuti, shimoldan soat yo'nalishida): kod -> nom
    YONALISHLAR = [
        ("Sh", "Shimol"), ("ShSh", "Shimoli-sharq"), ("Sq", "Sharq"), ("JSq", "Janubi-sharq"),
        ("J", "Janub"), ("JG", "Janubi-g'arb"), ("G", "G'arb"), ("ShG", "Shimoli-g'arb"),
    ]

    kontur = models.OneToOneField("land.Kontur", on_delete=models.CASCADE, related_name="relyef")
    balandlik_min = models.FloatField(null=True, blank=True)  # m
    balandlik_ortacha = models.FloatField(null=True, blank=True)
    balandlik_max = models.FloatField(null=True, blank=True)
    qiyalik_ortacha = models.FloatField(null=True, blank=True)  # gradus
    qiyalik_sinfi = models.CharField(max_length=16, choices=SINF_TANLOV, null=True, blank=True)
    yonalish = models.CharField(max_length=4, choices=YONALISHLAR, null=True, blank=True)
    yonalish_gradus = models.FloatField(null=True, blank=True)  # doiraviy o'rtacha azimut, 0..360
    hisoblangan = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "kontur relyeflari"

    def __str__(self):
        return f"relyef kontur={self.kontur_id}"
