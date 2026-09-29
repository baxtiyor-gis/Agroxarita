from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health),
    path("viloyatlar/", views.viloyat_royxat),
    path("viloyatlar/<int:region_id>/", views.viloyat_batafsil),
    path("tumanlar/", views.tuman_royxat),
    path("tumanlar/<int:kod>/", views.tuman_batafsil),
]
