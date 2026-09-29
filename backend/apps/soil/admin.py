from django.contrib.gis import admin

from .models import Tuproq, TuproqLugat


@admin.register(Tuproq)
class TuproqAdmin(admin.GISModelAdmin):
    list_display = ("globalid_qisqa", "tuman", "bonitet", "mexanika", "shorlanish", "klass")
    list_filter = ("mexanika", "shorlanish", "klass", "tuman__viloyat")
    search_fields = ("globalid",)
    show_full_result_count = False
    raw_id_fields = ("tuman",)
    list_select_related = ("tuman", "mexanika", "shorlanish", "klass")

    @admin.display(description="globalid", ordering="globalid")
    def globalid_qisqa(self, obj):
        return obj.globalid[:9]


@admin.register(TuproqLugat)
class TuproqLugatAdmin(admin.ModelAdmin):
    list_display = ("tur", "kod", "nom")
    list_filter = ("tur",)
