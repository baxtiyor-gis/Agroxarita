import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_admin_royxat(client, kontur):
    client.force_login(get_user_model().objects.create_superuser("a", "a@a.uz", "p"))
    javob = client.get("/admin/land/kontur/")
    assert javob.status_code == 200
    assert client.get("/admin/land/kontur/?q=7").status_code == 200
