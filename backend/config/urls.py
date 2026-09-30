from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.border.urls")),
    path("api/", include("apps.land.urls")),
    path("api/", include("apps.relief.urls")),
    path("tiles/", include("apps.tiles.urls")),
]
