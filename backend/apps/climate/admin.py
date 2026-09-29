from django.contrib import admin

from .models import IqlimKatak, IqlimKunlik, IqlimOylik, IqlimYillik


@admin.register(IqlimKatak)
class IqlimKatakAdmin(admin.ModelAdmin):
    list_display = ("kod", "markaz_lon", "markaz_lat", "sugorilad_maydon", "tuman")
    search_fields = ("kod",)
    list_select_related = ("tuman",)
    raw_id_fields = ("tuman",)
    exclude = ("geom_mvt",)


@admin.register(IqlimKunlik)
class IqlimKunlikAdmin(admin.ModelAdmin):
    list_display = ("katak", "sana", "t_min", "t_max", "t_ort", "yogin", "et0")
    list_select_related = ("katak",)
    raw_id_fields = ("katak",)
    date_hierarchy = "sana"
    show_full_result_count = False


@admin.register(IqlimOylik)
class IqlimOylikAdmin(admin.ModelAdmin):
    list_display = ("katak", "yil", "oy", "t_ort", "yogin", "et0")
    list_select_related = ("katak",)
    raw_id_fields = ("katak",)
    list_filter = ("yil", "oy")


@admin.register(IqlimYillik)
class IqlimYillikAdmin(admin.ModelAdmin):
    list_display = ("katak", "yil", "fah", "sovuqsiz_kunlar", "yogin", "et0")
    list_select_related = ("katak",)
    raw_id_fields = ("katak",)
    list_filter = ("yil",)
