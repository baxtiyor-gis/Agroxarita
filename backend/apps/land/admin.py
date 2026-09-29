from django.contrib.gis import admin

from .models import Kontur


@admin.register(Kontur)
class KonturAdmin(admin.GISModelAdmin):
    list_display = ("kontur_raqami", "tuman", "umumiy_maydoni")
    list_filter = ("tuman__viloyat",)
    search_fields = ("kontur_raqami", "yagona_kontur")
    show_full_result_count = False
    raw_id_fields = ("tuman",)
    list_select_related = ("tuman",)
