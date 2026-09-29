from django.contrib import admin

from .models import KonturRelyef


@admin.register(KonturRelyef)
class KonturRelyefAdmin(admin.ModelAdmin):
    list_display = ("kontur", "balandlik_ortacha", "qiyalik_ortacha", "qiyalik_sinfi", "yonalish", "hisoblangan")
    list_filter = ("qiyalik_sinfi", "yonalish")
    raw_id_fields = ("kontur",)
    show_full_result_count = False
