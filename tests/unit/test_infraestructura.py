"""Adaptadores de infraestructura. S3/SQS se emulan en memoria con moto."""
import json

import boto3
import pytest
from moto import mock_aws

from app.config import Configuracion
from app.contenedor import construir_publicador, construir_servicio
from app.dominio.modelos import ResultadoEvaluacion, SolicitudRegistrada
from app.infraestructura.publicadores import PublicadorAWS, PublicadorNulo
from app.infraestructura.servicios_externos import CentralRiesgoSimulada, MonitorSaludPorEntorno
from tests.unit.conftest import nueva_solicitud

BUCKET, COLA = "crediucc-expedientes", "crediucc-notificaciones"
REGISTRO = SolicitudRegistrada(7, nueva_solicitud(), ResultadoEvaluacion.aprobado(1.9))


@pytest.fixture
def aws():
    with mock_aws():
        s3, sqs = boto3.client("s3"), boto3.client("sqs")
        yield s3, sqs


def test_publicador_aws_guarda_expediente_y_encola_evento(aws):
    s3, sqs = aws
    s3.create_bucket(Bucket=BUCKET)
    url = sqs.create_queue(QueueName=COLA)["QueueUrl"]

    assert PublicadorAWS(s3, sqs, BUCKET, COLA).publicar_aprobacion(REGISTRO) is True

    expediente = json.loads(s3.get_object(Bucket=BUCKET, Key="solicitudes/7.json")["Body"].read())
    assert expediente["decision"] == "APROBADO"
    mensaje = json.loads(sqs.receive_message(QueueUrl=url)["Messages"][0]["Body"])
    assert mensaje == {"evento": "CREDITO_APROBADO", "id": 7, "email": "laura@example.com"}


def test_publicador_aws_tolera_infraestructura_ausente(aws):
    s3, sqs = aws  # ni bucket ni cola existen
    assert PublicadorAWS(s3, sqs, BUCKET, COLA).publicar_aprobacion(REGISTRO) is False


def test_publicador_nulo_es_sustituible():
    assert PublicadorNulo().publicar_aprobacion(REGISTRO) is False


def test_central_riesgo_aplica_latencia_configurada():
    pausas = []
    CentralRiesgoSimulada(250, dormir=pausas.append).consultar(nueva_solicitud())
    CentralRiesgoSimulada(0, dormir=pausas.append).consultar(nueva_solicitud())
    assert pausas == [0.25]


@pytest.mark.parametrize("valor, sano", [("true", True), ("TRUE ", True), ("false", False)])
def test_monitor_salud_lee_el_entorno_en_caliente(monkeypatch, valor, sano):
    monkeypatch.setenv("APP_HEALTHY", valor)
    assert MonitorSaludPorEntorno().esta_sano() is sano


def test_configuracion_desde_entorno():
    config = Configuracion.desde_entorno({"APP_VERSION": "2.0.0", "CLOUD_ENABLED": "TRUE",
                                          "CENTRAL_RIESGO_LATENCIA_MS": "150"})
    assert (config.version, config.nube_habilitada, config.latencia_central_ms) == ("2.0.0", True, 150)
    assert Configuracion.desde_entorno({}) == Configuracion()


@pytest.mark.parametrize("nube, tipo", [(False, PublicadorNulo), (True, PublicadorAWS)])
def test_contenedor_elige_publicador_segun_configuracion(nube, tipo):
    assert isinstance(construir_publicador(Configuracion(nube_habilitada=nube)), tipo)


def test_contenedor_construye_servicio_funcional():
    servicio = construir_servicio(Configuracion())
    assert servicio.radicar(nueva_solicitud()).resultado.es_aprobado
