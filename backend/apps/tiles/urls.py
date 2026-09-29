from django.urls import re_path

from . import views

urlpatterns = [
    # z/x/y ni view'da tekshiramiz (manfiy/katta qiymat -> 400, 404 emas)
    re_path(r"^(?P<qatlam>[\w-]+)/(?P<z>-?\d+)/(?P<x>-?\d+)/(?P<y>-?\d+)\.pbf$", views.tile),
]
