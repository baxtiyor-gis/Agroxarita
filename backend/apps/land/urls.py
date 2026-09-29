from django.urls import path

from . import views

urlpatterns = [
    path("konturlar/<int:id>/", views.kontur_batafsil),
]
