"""Aplicación: el caso de uso se prueba con dobles gracias a la inversión de dependencias."""
import pytest

from app.aplicacion.servicio_solicitudes import ServicioSolicitudes, SolicitudNoEncontradaError
from app.dominio.evaluador import EvaluadorCredito
from app.infraestructura.repositorio_memoria import RepositorioEnMemoria
from tests.unit.conftest import nueva_solicitud


class PublicadorEspia:
    def __init__(self, respuesta: bool = True) -> None:
        self.publicados: list[int] = []
        self._respuesta = respuesta

    def publicar_aprobacion(self, registro) -> bool:
        self.publicados.append(registro.id)
        return self._respuesta


class CentralRiesgoEspia:
    def __init__(self) -> None:
        self.consultas = 0

    def consultar(self, solicitud) -> None:
        self.consultas += 1


def crear_servicio(publicador=None):
    publicador = publicador or PublicadorEspia()
    central = CentralRiesgoEspia()
    servicio = ServicioSolicitudes(EvaluadorCredito.por_defecto(), RepositorioEnMemoria(),
                                   publicador, central)
    return servicio, publicador, central


def test_aprobacion_se_publica_y_queda_notificada():
    servicio, publicador, central = crear_servicio()

    registro = servicio.radicar(nueva_solicitud())

    assert registro.resultado.es_aprobado and registro.notificado is True
    assert publicador.publicados == [registro.id]
    assert central.consultas == 1
    assert servicio.obtener(registro.id).notificado is True  # persistió la actualización


def test_rechazo_no_se_publica():
    servicio, publicador, _ = crear_servicio()
    registro = servicio.radicar(nueva_solicitud(score=599))
    assert registro.notificado is False and publicador.publicados == []


def test_fallo_de_publicacion_no_impide_radicar():
    servicio, _, _ = crear_servicio(PublicadorEspia(respuesta=False))
    registro = servicio.radicar(nueva_solicitud())
    assert registro.resultado.es_aprobado and registro.notificado is False


def test_listar_y_obtener():
    servicio, _, _ = crear_servicio()
    primero, segundo = servicio.radicar(nueva_solicitud()), servicio.radicar(nueva_solicitud())
    assert [r.id for r in servicio.listar()] == [primero.id, segundo.id]


def test_obtener_inexistente_lanza_error():
    servicio, _, _ = crear_servicio()
    with pytest.raises(SolicitudNoEncontradaError):
        servicio.obtener(42)
