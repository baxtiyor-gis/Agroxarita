from django.contrib.gis.db import models


class TuproqLugat(models.Model):
    """Tuproq domen lug'ati (GIS.gdb coded-value domenlari; nom — kirilldan lotinga)."""

    MEXANIKA = "mexanika"
    SHORLANISH = "shorlanish"
    YUVILISH = "yuvilish"
    TOSHLANISH = "toshlanish"
    KLASS = "klass"
    TUR_TANLOV = [
        (MEXANIKA, "Mexanik tarkib"),
        (SHORLANISH, "Sho'rlanish"),
        (YUVILISH, "Yuvilish"),
        (TOSHLANISH, "Toshloqlik"),
        (KLASS, "Klass"),
    ]

    tur = models.CharField(max_length=16, choices=TUR_TANLOV)
    kod = models.IntegerField()  # domen ID
    nom = models.CharField(max_length=255)

    class Meta:
        verbose_name_plural = "tuproq lug'ati"
        constraints = [models.UniqueConstraint(fields=["tur", "kod"], name="tuproqlugat_tur_kod_uniq")]
        ordering = ["tur", "kod"]

    def __str__(self):
        return f"{self.tur}: {self.nom}"


class Tuproq(models.Model):
    """Tuproq poligoni (GIS.gdb `Soil`). Import — `import_tuproq`."""

    globalid = models.CharField(max_length=64, unique=True)
    tuman = models.ForeignKey(
        "border.Tuman", on_delete=models.SET_NULL, null=True, blank=True, related_name="tuproqlar", db_index=True
    )

    mexanika = models.ForeignKey(TuproqLugat, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    shorlanish = models.ForeignKey(TuproqLugat, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    yuvilish = models.ForeignKey(TuproqLugat, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    toshlanish = models.ForeignKey(TuproqLugat, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    klass = models.ForeignKey(TuproqLugat, on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    bonitet = models.FloatField(null=True, blank=True, db_index=True)  # ball_bonitet
    maydon = models.FloatField(null=True, blank=True)  # maydoni

    yer_osti_suvi = models.CharField(max_length=64, blank=True, default="")  # normallashtirilgan matn
    yer_osti_suvi_min = models.FloatField(null=True, blank=True)  # metr
    yer_osti_suvi_max = models.FloatField(null=True, blank=True)  # metr

    massiv_nomi = models.CharField(max_length=255, blank=True, default="")
    manba = models.JSONField(default=dict, blank=True)  # manba matn maydonlari (audit)

    geom = models.MultiPolygonField(srid=4326, spatial_index=True)
    geom_mvt = models.MultiPolygonField(srid=3857, spatial_index=True)

    class Meta:
        verbose_name_plural = "tuproqlar"

    def __str__(self):
        return self.globalid
