from django.urls import path, re_path

from . import views

urlpatterns = [
    path("dem/<int:z>/<int:x>/<int:y>.png", views.dem_tile),
    # z/x/y ni view'da tekshiramiz (manfiy/katta qiymat -> 400, 404 emas)
    re_path(r"^(?P<qatlam>[\w-]+)/(?P<z>-?\d+)/(?P<x>-?\d+)/(?P<y>-?\d+)\.pbf$", views.tile),
]
