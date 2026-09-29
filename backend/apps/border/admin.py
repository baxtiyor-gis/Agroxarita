from django.contrib.gis import admin

from .models import Massiv, Tuman, Viloyat


@admin.register(Viloyat)
class ViloyatAdmin(admin.GISModelAdmin):
    list_display = ("nom", "region_id", "soato")
    search_fields = ("nom",)
    ordering = ("nom",)


@admin.register(Tuman)
class TumanAdmin(admin.GISModelAdmin):
    list_display = ("nom", "kod", "tip", "viloyat")
    list_filter = ("tip", "viloyat")
    search_fields = ("nom",)
    ordering = ("nom",)
    list_select_related = ("viloyat",)


@admin.register(Massiv)
class MassivAdmin(admin.GISModelAdmin):
    list_display = ("nom", "tuman")
    list_filter = ("tuman__viloyat",)
    search_fields = ("nom",)
    ordering = ("nom",)
    list_select_related = ("tuman",)
    # 3241 ta massiv — tuman tanlovi select emas, qidiruv orqali
    raw_id_fields = ("tuman",)
