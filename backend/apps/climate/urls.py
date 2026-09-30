from django.urls import path

from . import views

urlpatterns = [
    path("konturlar/<int:id>/iqlim/", views.kontur_iqlim),
]
