from django.contrib.gis.db import models


class IqlimKatak(models.Model):
    """0.1 gradusli katak (sug'oriladigan konturlar tushgan). kod = "{floor(lon*10)}_{floor(lat*10)}"."""

    kod = models.CharField(max_length=16, unique=True)
    ix = models.IntegerField()  # floor(lon*10)
    iy = models.IntegerField()  # floor(lat*10)
    markaz_lon = models.FloatField()
    markaz_lat = models.FloatField()
    geom = models.PolygonField(srid=4326, spatial_index=True)
    geom_mvt = models.PolygonField(srid=3857, spatial_index=True)
    sugorilad_maydon = models.FloatField(default=0)  # ga: katakdagi sug'oriladigan konturlar
    tuman = models.ForeignKey(
        "border.Tuman", on_delete=models.SET_NULL, null=True, blank=True, related_name="iqlim_kataklari"
    )  # eng katta sug'oriladigan ulush

    class Meta:
        verbose_name_plural = "iqlim kataklari"
        constraints = [models.UniqueConstraint(fields=["ix", "iy"], name="iqlimkatak_ix_iy_uniq")]

    def __str__(self):
        return self.kod


class IqlimKunlik(models.Model):
    katak = models.ForeignKey(IqlimKatak, on_delete=models.CASCADE, related_name="kunlik")
    sana = models.DateField()
    t_min = models.FloatField(null=True, blank=True)  # °C
    t_max = models.FloatField(null=True, blank=True)
    t_ort = models.FloatField(null=True, blank=True)
    yogin = models.FloatField(null=True, blank=True)  # mm
    et0 = models.FloatField(null=True, blank=True)  # mm (Hargreaves)
    radiatsiya = models.FloatField(null=True, blank=True)  # MJ/m2 (kunlik yig'indi)
    shamol = models.FloatField(null=True, blank=True)  # m/s (10 m, o'rtacha tezlik)
    namlik = models.FloatField(null=True, blank=True)  # nisbiy namlik %

    class Meta:
        verbose_name_plural = "iqlim kunlik"
        constraints = [models.UniqueConstraint(fields=["katak", "sana"], name="iqlimkunlik_katak_sana_uniq")]
        indexes = [models.Index(fields=["sana"], name="iqlimkunlik_sana_idx")]


class IqlimOylik(models.Model):
    katak = models.ForeignKey(IqlimKatak, on_delete=models.CASCADE, related_name="oylik")
    yil = models.SmallIntegerField()
    oy = models.SmallIntegerField()
    t_min = models.FloatField(null=True, blank=True)  # oylik o'rtacha t_min
    t_max = models.FloatField(null=True, blank=True)
    t_ort = models.FloatField(null=True, blank=True)
    yogin = models.FloatField(null=True, blank=True)  # yig'indi, mm
    et0 = models.FloatField(null=True, blank=True)  # yig'indi, mm
    radiatsiya = models.FloatField(null=True, blank=True)  # o'rtacha kunlik
    shamol = models.FloatField(null=True, blank=True)
    namlik = models.FloatField(null=True, blank=True)
    kunlar = models.SmallIntegerField(default=0)  # ma'lumotli kunlar soni

    class Meta:
        verbose_name_plural = "iqlim oylik"
        constraints = [models.UniqueConstraint(fields=["katak", "yil", "oy"], name="iqlimoylik_katak_yil_oy_uniq")]


class IqlimYillik(models.Model):
    katak = models.ForeignKey(IqlimKatak, on_delete=models.CASCADE, related_name="yillik")
    yil = models.SmallIntegerField()
    fah = models.FloatField(null=True, blank=True)  # foydali aktiv haroratlar yig'indisi (t_ort > 10 °C)
    sovuqsiz_kunlar = models.SmallIntegerField(null=True, blank=True)  # oxirgi bahorgi va birinchi kuzgi sovuq (t_min<0) orasida
    oxirgi_bahorgi_sovuq = models.DateField(null=True, blank=True)  # 1-iyulgacha oxirgi t_min<0
    birinchi_kuzgi_sovuq = models.DateField(null=True, blank=True)  # 1-iyuldan keyingi birinchi t_min<0
    yogin = models.FloatField(null=True, blank=True)  # yillik, mm
    et0 = models.FloatField(null=True, blank=True)
    t_ort = models.FloatField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "iqlim yillik"
        constraints = [models.UniqueConstraint(fields=["katak", "yil"], name="iqlimyillik_katak_yil_uniq")]
