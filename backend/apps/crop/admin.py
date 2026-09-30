from django.contrib import admin

from .models import EkinClass, KonturEkin


@admin.register(EkinClass)
class EkinClassAdmin(admin.ModelAdmin):
    list_display = ("kod", "nom", "guruh")
    list_filter = ("guruh",)
    search_fields = ("nom",)


@admin.register(KonturEkin)
class KonturEkinAdmin(admin.ModelAdmin):
    list_display = ("kontur", "yil", "ekin", "maydon", "ulush", "asosiy")
    list_filter = ("yil", "asosiy")
    raw_id_fields = ("kontur",)
    show_full_result_count = False
