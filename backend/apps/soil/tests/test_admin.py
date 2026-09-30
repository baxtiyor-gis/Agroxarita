import pytest
from django.contrib.auth import get_user_model

from apps.soil.models import TuproqClass
from apps.soil.tests.test_models import tuproq_yarat


@pytest.mark.django_db
def test_admin_sahifalari(client, tuman):
    lugat = TuproqClass.objects.create(tur="mexanika", kod=1, nom="Yengil")
    t = tuproq_yarat("{ABCDEF12-0000}", tuman=tuman, mexanika=lugat, bonitet=40)
    client.force_login(get_user_model().objects.create_superuser("a", "a@a.uz", "p"))
    assert client.get("/admin/soil/tuproq/").status_code == 200
    assert client.get("/admin/soil/tuproq/?q=ABCDEF").status_code == 200
    assert client.get(f"/admin/soil/tuproq/?mexanika__id__exact={lugat.pk}").status_code == 200
    assert client.get(f"/admin/soil/tuproq/{t.pk}/change/").status_code == 200
    assert client.get("/admin/soil/tuproqclass/").status_code == 200
    assert client.get("/admin/soil/tuproqclass/?tur=mexanika").status_code == 200
