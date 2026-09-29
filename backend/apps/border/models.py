from django.contrib.gis.db import models


class GeometriyaMixin(models.Model):
    """Umumiy geometriya maydonlari (GiST indeks bilan)."""

    geom = models.MultiPolygonField(srid=4326, spatial_index=True)
    # tile uchun: import vaqtida to'ldiriladi (ST_Transform har so'rovda qilinmaydi)
    geom_mvt = models.MultiPolygonField(srid=3857, spatial_index=True)
    # soddalashtirilgan (~250 m) — past zoom tile'lari uchun
    geom_mvt_s = models.MultiPolygonField(srid=3857, spatial_index=True)
    # [minLon, minLat, maxLon, maxLat]
    bbox = models.JSONField(default=list)

    class Meta:
        abstract = True


class Viloyat(GeometriyaMixin):
    region_id = models.PositiveSmallIntegerField(unique=True)
    soato = models.CharField(max_length=16, unique=True)
    nom = models.CharField(max_length=100)

    class Meta:
        ordering = ["nom"]
        verbose_name_plural = "viloyatlar"

    def __str__(self):
        return self.nom


class Tuman(GeometriyaMixin):
    class Tip(models.TextChoices):
        TUMAN = "tuman", "Tuman"
        SHAHAR = "shahar", "Shahar"

    viloyat = models.ForeignKey(Viloyat, on_delete=models.CASCADE, related_name="tumanlar")
    kod = models.PositiveIntegerField(unique=True)  # 1201
    soato = models.CharField(max_length=16, unique=True)
    nom = models.CharField(max_length=100)
    tip = models.CharField(max_length=10, choices=Tip.choices, default=Tip.TUMAN)

    class Meta:
        ordering = ["nom"]
        verbose_name_plural = "tumanlar"

    def __str__(self):
        return self.nom


class Massiv(GeometriyaMixin):
    tuman = models.ForeignKey(Tuman, on_delete=models.CASCADE, related_name="massivlar")
    globalid = models.CharField(max_length=64, unique=True)  # manbadagi globalid - kalit
    massiv_id = models.BigIntegerField(null=True, blank=True)  # unique emas: 0/NULL/takror bo'lishi mumkin
    nom = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["nom"]
        verbose_name_plural = "massivlar"

    def __str__(self):
        return self.nom or str(self.massiv_id)
