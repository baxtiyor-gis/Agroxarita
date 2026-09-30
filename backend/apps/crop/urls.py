from django.urls import path

from . import views

urlpatterns = [
    path("ekinlar/", views.ekinlar_royxati),
]
