"""Adaptador HTTP probado en proceso con TestClient y dependencias inyectadas."""
import pytest
from fastapi.testclient import TestClient

from app.api.aplicacion_web import crear_app
from app.config import Configuracion
from app.contenedor import construir_servicio

SOLICITUD = {"nombre": "Laura Rojas", "email": "laura@example.com", "edad": 22, "score": 760,
             "ingresos": 2_100_000.0, "monto": 1_200_000.0, "es_estudiante": True}


class MonitorFijo:
    def __init__(self, sano: bool) -> None:
        self._sano = sano

    def esta_sano(self) -> bool:
        return self._sano


@pytest.fixture
def cliente() -> TestClient:
    return TestClient(crear_app(construir_servicio(Configuracion()), MonitorFijo(True), "9.9.9"))


@pytest.mark.parametrize("sano, codigo, estado", [(True, 200, "healthy"), (False, 500, "unhealthy")])
def test_health(sano, codigo, estado):
    app = crear_app(construir_servicio(Configuracion()), MonitorFijo(sano), "9.9.9")
    respuesta = TestClient(app).get("/health")
    assert respuesta.status_code == codigo
    assert respuesta.json() == {"status": estado, "version": "9.9.9", "service": "crediucc-api"}


def test_radicar_consultar_y_listar(cliente):
    creada = cliente.post("/api/v1/solicitudes", json=SOLICITUD)
    assert creada.status_code == 201
    cuerpo = creada.json()
    assert (cuerpo["decision"], cuerpo["tasa_mensual"]) == ("APROBADO", 1.2)
    assert cliente.get(f"/api/v1/solicitudes/{cuerpo['id']}").json() == cuerpo
    assert cliente.get("/api/v1/solicitudes").json() == [cuerpo]


@pytest.mark.parametrize("cambios, codigo", [({"score": 900}, 400), ({"monto": 50}, 400),
                                             ({"edad": "veinte"}, 422)])
def test_peticiones_invalidas(cliente, cambios, codigo):
    assert cliente.post("/api/v1/solicitudes", json={**SOLICITUD, **cambios}).status_code == codigo


def test_segunda_solicitud_del_mismo_correo_es_recurrente(cliente):
    primera = cliente.post("/api/v1/solicitudes", json=SOLICITUD).json()
    segunda = cliente.post("/api/v1/solicitudes", json={**SOLICITUD, "email": "LAURA@example.com"}).json()
    assert (primera["numero_cliente"], primera["es_recurrente"]) == (1, False)
    assert (segunda["numero_cliente"], segunda["es_recurrente"]) == (2, True)


def test_put_actualiza_la_misma_solicitud(cliente):
    creada = cliente.post("/api/v1/solicitudes", json=SOLICITUD).json()

    respuesta = cliente.put(f"/api/v1/solicitudes/{creada['id']}", json={**SOLICITUD, "monto": 3_000_000.0})

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert (cuerpo["id"], cuerpo["version"], cuerpo["monto"]) == (creada["id"], 2, 3_000_000.0)
    assert creada["actualizado_en"] is None
    assert cuerpo["actualizado_en"] is not None
    assert len(cliente.get("/api/v1/solicitudes").json()) == 1


@pytest.mark.parametrize("cambios, codigo", [({"email": "otra@example.com"}, 409), ({"score": 900}, 400),
                                             ({"edad": "veinte"}, 422)])
def test_put_invalido(cliente, cambios, codigo):
    creada = cliente.post("/api/v1/solicitudes", json=SOLICITUD).json()
    respuesta = cliente.put(f"/api/v1/solicitudes/{creada['id']}", json={**SOLICITUD, **cambios})
    assert respuesta.status_code == codigo


def test_put_inexistente_404(cliente):
    assert cliente.put("/api/v1/solicitudes/999", json=SOLICITUD).status_code == 404


def test_inexistente_404(cliente):
    assert cliente.get("/api/v1/solicitudes/999").status_code == 404


def test_punto_de_entrada_asgi_se_ensambla():
    from app.main import app
    assert TestClient(app).get("/health").status_code == 200
