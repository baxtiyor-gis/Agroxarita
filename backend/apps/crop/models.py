from django.db import models
from django.db.models import Q

from .guruhlar import GURUH_TANLOV


class EkinClass(models.Model):
    """Ekin lug'ati (GIS.gdb `crop_name` domeni; ikki yil domeni birlashtirilgan)."""

    kod = models.IntegerField(unique=True)
    nom = models.CharField(max_length=128)
    guruh = models.CharField(max_length=16, choices=GURUH_TANLOV, db_index=True)

    class Meta:
        ordering = ["kod"]
        verbose_name_plural = "ekin klasslari"

    def __str__(self):
        return f"{self.kod} {self.nom}"


class KonturEkin(models.Model):
    """Kontur + yil + ekin: ekin poligonlari kontur bilan fazoviy bog'langan (`import_ekin`)."""

    kontur = models.ForeignKey("land.Kontur", on_delete=models.CASCADE, related_name="ekinlar")
    yil = models.PositiveSmallIntegerField()
    ekin = models.ForeignKey(EkinClass, on_delete=models.PROTECT, related_name="kontur_ekinlar")
    maydon = models.FloatField()  # ga: kesishuv maydoni (kontur maydonidan oshmaydi)
    ulush = models.FloatField()  # kesishuv / ekin poligoni maydoni, 0..1
    asosiy = models.BooleanField(default=False)  # shu yil konturdagi eng katta jami maydonli ekin

    class Meta:
        verbose_name_plural = "kontur ekinlari"
        constraints = [
            models.UniqueConstraint(fields=["kontur", "yil", "ekin"], name="konturekin_kontur_yil_ekin_uniq"),
            # tile: LEFT JOIN ... AND asosiy — konturga yilda bittadan ko'p asosiy bo'lmaydi
            models.UniqueConstraint(fields=["kontur", "yil"], condition=Q(asosiy=True), name="konturekin_asosiy_uniq"),
        ]
        indexes = [
            models.Index(fields=["kontur", "yil"], name="konturekin_kontur_yil_idx"),
            models.Index(fields=["yil", "ekin"], name="konturekin_yil_ekin_idx"),
        ]

    def __str__(self):
        return f"{self.kontur_id} {self.yil} {self.ekin_id}"
