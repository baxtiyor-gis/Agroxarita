from django.contrib.gis.db import models


class Kontur(models.Model):
    """Yer kontur (GIS.gdb `contour`). Geometriya faqat MVT uchun; import — `import_kontur`."""

    SUGORILADIGAN = "sugoriladigan"
    ANIQLANMAGAN = "aniqlanmagan"
    QX_TUPROQ = "qx_tuproq"  # atribut bo'yicha aniqlanmagan, lekin tuproq poligoni bilan qoplangan (`kontur_tuproq`)
    TUR_TANLOV = [
        (SUGORILADIGAN, "Sug'oriladigan"),
        (QX_TUPROQ, "QX yeri (tuproq bo'yicha)"),
        (ANIQLANMAGAN, "Aniqlanmagan"),
    ]

    manba_fid = models.BigIntegerField(unique=True)  # GDB OBJECTID
    tuman = models.ForeignKey("border.Tuman", on_delete=models.PROTECT, related_name="konturlar", db_index=True)
    kontur_raqami = models.IntegerField(null=True, blank=True)  # takrorlanishi mumkin
    yagona_kontur = models.CharField(max_length=64, null=True, blank=True)
    eski_kontur = models.CharField(max_length=64, null=True, blank=True)
    umumiy_maydoni = models.FloatField(null=True, blank=True)  # ga

    mfy = models.CharField(max_length=255, null=True, blank=True)
    massiv = models.CharField(max_length=255, null=True, blank=True)
    satr = models.CharField(max_length=255, null=True, blank=True)
    izox = models.TextField(null=True, blank=True)

    # yer turi maydonlari (ga) — nomlar manbadagidek
    haydalma_yer_sug = models.FloatField(null=True, blank=True)
    haydalma_shartli_sug = models.FloatField(null=True, blank=True)
    haydalma_lalmi = models.FloatField(null=True, blank=True)
    dehqon_xuj_sug = models.FloatField(null=True, blank=True)
    dehqon_xuj_lalmi = models.FloatField(null=True, blank=True)
    issiqxona = models.FloatField(null=True, blank=True)
    boglar_sug = models.FloatField(null=True, blank=True)
    bog_shartli_sug = models.FloatField(null=True, blank=True)
    bog_lalmi = models.FloatField(null=True, blank=True)
    bog_intensiv = models.FloatField(null=True, blank=True)
    uzumzor_sug = models.FloatField(null=True, blank=True)
    uzumzor_shartli_sug = models.FloatField(null=True, blank=True)
    uzumzor_lalmi = models.FloatField(null=True, blank=True)
    uzumzor_intensiv = models.FloatField(null=True, blank=True)
    kuchatxona = models.FloatField(null=True, blank=True)
    tutzor = models.FloatField(null=True, blank=True)
    terakzor = models.FloatField(null=True, blank=True)
    buz_yer_sug = models.FloatField(null=True, blank=True)
    buz_yer_lalmi = models.FloatField(null=True, blank=True)
    pichanzor = models.FloatField(null=True, blank=True)
    utloq_yaylov = models.FloatField(null=True, blank=True)
    utloq_yaylov_suvli = models.FloatField(null=True, blank=True)
    jami_qx_yeri = models.FloatField(null=True, blank=True)
    jami_qx_sug_yeri = models.FloatField(null=True, blank=True)
    tomarqa = models.FloatField(null=True, blank=True)
    dala_tomorqa = models.FloatField(null=True, blank=True)
    meliorativ_hol_yer = models.FloatField(null=True, blank=True)
    urmonzor = models.FloatField(null=True, blank=True)
    butazor = models.FloatField(null=True, blank=True)
    daraxtzor_jar_daryo_buyi = models.FloatField(null=True, blank=True)
    lhota_daraxtzor = models.FloatField(null=True, blank=True)
    urmon_kuchatxona = models.FloatField(null=True, blank=True)
    ariq_kanal_zovur = models.FloatField(null=True, blank=True)
    kol = models.FloatField(null=True, blank=True)
    suv_ombor_havza = models.FloatField(null=True, blank=True)
    dengiz_daryo_soy = models.FloatField(null=True, blank=True)
    botqoqliklar = models.FloatField(null=True, blank=True)
    qurilish_osti_yeri = models.FloatField(null=True, blank=True)
    yollar = models.FloatField(null=True, blank=True)
    kuchalar_maydon = models.FloatField(null=True, blank=True)
    shurxok_yer = models.FloatField(null=True, blank=True)
    qumlar = models.FloatField(null=True, blank=True)
    boshqa_yer = models.FloatField(null=True, blank=True)

    # geometrik tuman: eng katta kesishuv maydoni bo'yicha (`kontur_tuman`); `tuman` — manba (distrikt_id)
    tuman_geo = models.ForeignKey(
        "border.Tuman", on_delete=models.SET_NULL, null=True, blank=True, related_name="geo_konturlar", db_index=True
    )
    tur = models.CharField(max_length=32, choices=TUR_TANLOV, default=ANIQLANMAGAN, db_index=True)  # `kontur_tur`

    geom = models.MultiPolygonField(srid=4326, spatial_index=True)
    geom_mvt = models.MultiPolygonField(srid=3857, spatial_index=True)
    # z < 13 tile'lari uchun oldindan soddalashtirilgan (~19 m) va 3857 dagi maydon (m2, piksel filtri).
    # Import to'ldiradi; NULL bo'lsa view geom_mvt dan foydalanadi. GiST yo'q (filtr geom_mvt bo'yicha).
    geom_mvt_s = models.MultiPolygonField(srid=3857, null=True, blank=True, spatial_index=False)
    maydon_mvt = models.FloatField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "konturlar"
        indexes = [models.Index(fields=["tuman", "kontur_raqami"], name="kontur_tuman_raqam_idx")]

    def __str__(self):
        return f"{self.kontur_raqami} ({self.tuman_id})"
