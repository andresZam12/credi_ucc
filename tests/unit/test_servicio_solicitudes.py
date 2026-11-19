"""Aplicación: el caso de uso se prueba con dobles gracias a la inversión de dependencias."""
import pytest

from app.aplicacion.servicio_solicitudes import (
    CorreoNoCoincideError,
    ServicioSolicitudes,
    SolicitudNoEncontradaError,
)
from app.dominio.errores import ValorFueraDeDominioError
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

    assert registro.resultado.es_aprobado
    assert registro.notificado is True
    assert publicador.publicados == [registro.id]
    assert central.consultas == 1
    assert servicio.obtener(registro.id).notificado is True  # persistió la actualización


def test_rechazo_no_se_publica():
    servicio, publicador, _ = crear_servicio()
    registro = servicio.radicar(nueva_solicitud(score=599))
    assert registro.notificado is False
    assert publicador.publicados == []


def test_fallo_de_publicacion_no_impide_radicar():
    servicio, _, _ = crear_servicio(PublicadorEspia(respuesta=False))
    registro = servicio.radicar(nueva_solicitud())
    assert registro.resultado.es_aprobado
    assert registro.notificado is False


def test_listar_y_obtener():
    servicio, _, _ = crear_servicio()
    primero, segundo = servicio.radicar(nueva_solicitud()), servicio.radicar(nueva_solicitud())
    assert [r.id for r in servicio.listar()] == [primero.id, segundo.id]


def test_obtener_inexistente_lanza_error():
    servicio, _, _ = crear_servicio()
    with pytest.raises(SolicitudNoEncontradaError):
        servicio.obtener(42)


# ------------------------------------------------- clientes recurrentes y actualización
def test_numera_las_solicitudes_por_cliente_sin_importar_mayusculas_ni_espacios():
    servicio, _, _ = crear_servicio()

    primera = servicio.radicar(nueva_solicitud(email="ana@ucc.edu.co"))
    otra_persona = servicio.radicar(nueva_solicitud(email="juan@ucc.edu.co"))
    segunda = servicio.radicar(nueva_solicitud(email="  ANA@ucc.edu.co "))

    assert (primera.numero_cliente, primera.es_recurrente) == (1, False)
    assert (otra_persona.numero_cliente, otra_persona.es_recurrente) == (1, False)
    assert (segunda.numero_cliente, segunda.es_recurrente) == (2, True)


def test_actualizar_reevalua_conserva_el_numero_y_sube_la_version():
    servicio, publicador, central = crear_servicio()
    original = servicio.radicar(nueva_solicitud(score=599))  # rechazada por score

    actualizada = servicio.actualizar(original.id, nueva_solicitud(score=700, monto=3_000_000.0))

    assert actualizada.id == original.id
    assert (actualizada.version, actualizada.numero_cliente) == (2, 1)
    assert actualizada.resultado.es_aprobado
    assert actualizada.notificado is True
    assert publicador.publicados == [original.id]
    assert central.consultas == 2
    assert actualizada.creado_en == original.creado_en
    assert actualizada.actualizado_en is not None
    assert servicio.obtener(original.id) == actualizada
    assert len(servicio.listar()) == 1  # se modificó, no se duplicó


def test_actualizar_de_aprobada_a_rechazada_quita_la_notificacion():
    servicio, publicador, _ = crear_servicio()
    original = servicio.radicar(nueva_solicitud())

    actualizada = servicio.actualizar(original.id, nueva_solicitud(ingresos=1_000_000.0))

    assert actualizada.resultado.es_aprobado is False
    assert actualizada.notificado is False
    assert publicador.publicados == [original.id]  # solo la aprobación original


def test_actualizar_con_otro_correo_se_rechaza_y_no_modifica():
    servicio, _, _ = crear_servicio()
    original = servicio.radicar(nueva_solicitud(email="ana@ucc.edu.co"))

    with pytest.raises(CorreoNoCoincideError):
        servicio.actualizar(original.id, nueva_solicitud(email="otra@ucc.edu.co"))
    assert servicio.obtener(original.id).version == 1


def test_actualizar_con_datos_destructivos_no_modifica():
    servicio, _, _ = crear_servicio()
    original = servicio.radicar(nueva_solicitud())

    with pytest.raises(ValorFueraDeDominioError):
        servicio.actualizar(original.id, nueva_solicitud(score=900))
    assert servicio.obtener(original.id) == original


def test_actualizar_inexistente_lanza_error():
    servicio, _, _ = crear_servicio()
    with pytest.raises(SolicitudNoEncontradaError):
        servicio.actualizar(42, nueva_solicitud())
