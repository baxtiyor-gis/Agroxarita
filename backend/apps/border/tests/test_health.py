from django.db.utils import OperationalError


def test_health_ok(client, db):
    r = client.get("/api/health/")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ok"
    assert d["postgis"][0].isdigit()


def test_health_baza_ishlamasa_503(client, monkeypatch):
    from django.db import connection

    def xato(*a, **k):
        raise OperationalError("baza yo'q")

    monkeypatch.setattr(connection, "cursor", xato)
    r = client.get("/api/health/")
    assert r.status_code == 503
    assert r.json()["status"] == "xato"
