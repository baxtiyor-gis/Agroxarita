from django.urls import path

from . import views

urlpatterns = [
    path("tumanlar/<int:kod>/relyef/", views.tuman_relyef),
]
