"""Raíz de composición: único lugar que conoce las clases concretas y las ensambla."""
import boto3

from app.aplicacion.puertos import PublicadorEventos
from app.aplicacion.servicio_solicitudes import ServicioSolicitudes
from app.config import Configuracion
from app.dominio.evaluador import EvaluadorCredito
from app.infraestructura.publicadores import PublicadorAWS, PublicadorNulo
from app.infraestructura.repositorio_memoria import RepositorioEnMemoria
from app.infraestructura.servicios_externos import CentralRiesgoSimulada


def construir_publicador(config: Configuracion) -> PublicadorEventos:
    if not config.nube_habilitada:
        return PublicadorNulo()
    # Credenciales: boto3 las toma del entorno (GitHub Secrets / LocalStack usa "test").
    sesion = boto3.session.Session(region_name=config.aws_region)
    cliente = {"endpoint_url": config.aws_endpoint}
    return PublicadorAWS(sesion.client("s3", **cliente), sesion.client("sqs", **cliente),
                         config.bucket, config.cola)


def construir_servicio(config: Configuracion) -> ServicioSolicitudes:
    return ServicioSolicitudes(
        evaluador=EvaluadorCredito.por_defecto(),
        repositorio=RepositorioEnMemoria(),
        publicador=construir_publicador(config),
        central_riesgo=CentralRiesgoSimulada(config.latencia_central_ms),
    )
