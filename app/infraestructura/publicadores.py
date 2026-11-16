"""Adaptadores de PublicadorEventos (Semana 10: S3 + SQS en LocalStack).

LSP: PublicadorNulo y PublicadorAWS son intercambiables; el servicio no distingue
entre ellos (patrón Null Object, sin "if nube_habilitada" disperso en el código).
"""
import json
import logging

from botocore.exceptions import BotoCoreError, ClientError

from app.dominio.modelos import SolicitudRegistrada

logger = logging.getLogger(__name__)

EVENTO_APROBACION = "CREDITO_APROBADO"


class PublicadorNulo:
    def publicar_aprobacion(self, registro: SolicitudRegistrada) -> bool:
        return False


class PublicadorAWS:
    def __init__(self, cliente_s3, cliente_sqs, bucket: str, cola: str) -> None:
        self._s3 = cliente_s3
        self._sqs = cliente_sqs
        self._bucket = bucket
        self._cola = cola

    def publicar_aprobacion(self, registro: SolicitudRegistrada) -> bool:
        try:
            self._guardar_expediente(registro)
            self._encolar_notificacion(registro)
            return True
        except (BotoCoreError, ClientError):
            # La caída de la nube no debe tumbar la API: se registra y se reporta False.
            logger.exception("No se pudo publicar la solicitud %s", registro.id)
            return False

    def _guardar_expediente(self, registro: SolicitudRegistrada) -> None:
        self._s3.put_object(Bucket=self._bucket, Key=f"solicitudes/{registro.id}.json",
                            Body=json.dumps(registro.a_dict()).encode())

    def _encolar_notificacion(self, registro: SolicitudRegistrada) -> None:
        url_cola = self._sqs.get_queue_url(QueueName=self._cola)["QueueUrl"]
        evento = {"evento": EVENTO_APROBACION, "id": registro.id,
                  "email": registro.solicitud.email}
        self._sqs.send_message(QueueUrl=url_cola, MessageBody=json.dumps(evento))
