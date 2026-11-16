"""Semana 10: aprovisionamiento IaC declarativo e idempotente en LocalStack.

Se declara el *estado deseado* y el aprovisionador solo crea lo que falta:
ejecutarlo 1 o 100 veces deja la infraestructura igual.
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError


@dataclass(frozen=True)
class EstadoDeseado:
    buckets: tuple[str, ...]
    colas: tuple[str, ...]

    @classmethod
    def desde_entorno(cls) -> EstadoDeseado:
        return cls(buckets=(os.getenv("S3_BUCKET", "crediucc-expedientes"),),
                   colas=(os.getenv("SQS_QUEUE", "crediucc-notificaciones"),))


class AprovisionadorIaC:
    def __init__(self, cliente_s3, cliente_sqs,
                 informar: Callable[[str], None] = print,
                 dormir: Callable[[float], None] = time.sleep) -> None:
        self._s3 = cliente_s3
        self._sqs = cliente_sqs
        self._informar = informar
        self._dormir = dormir

    def esperar_disponibilidad(self, intentos: int = 20, pausa_s: float = 1.0) -> bool:
        for _ in range(intentos):
            try:
                self._s3.list_buckets()
                return True
            except EndpointConnectionError:
                self._dormir(pausa_s)
        return False

    def aplicar(self, estado: EstadoDeseado) -> list[str]:
        """Converge al estado deseado y devuelve la lista de recursos creados."""
        creados = [*self._asegurar_buckets(estado.buckets), *self._asegurar_colas(estado.colas)]
        if not creados:
            self._informar(" -> [=] Sin cambios: la infraestructura ya estaba en el estado deseado.")
        return creados

    def _asegurar_buckets(self, buckets: tuple[str, ...]) -> list[str]:
        existentes = {b["Name"] for b in self._s3.list_buckets().get("Buckets", [])}
        creados = []
        for bucket in buckets:
            if bucket not in existentes:
                self._s3.create_bucket(Bucket=bucket)
                self._informar(f" -> [OK] Bucket S3 '{bucket}' creado.")
                creados.append(f"s3:{bucket}")
        return creados

    def _asegurar_colas(self, colas: tuple[str, ...]) -> list[str]:
        creados = []
        for cola in colas:
            try:
                self._sqs.get_queue_url(QueueName=cola)
            except ClientError:
                self._sqs.create_queue(QueueName=cola)
                self._informar(f" -> [OK] Cola SQS '{cola}' creada.")
                creados.append(f"sqs:{cola}")
        return creados


def main() -> int:
    endpoint = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    sesion = boto3.session.Session(region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
                                   aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
                                   aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"))
    aprovisionador = AprovisionadorIaC(sesion.client("s3", endpoint_url=endpoint),
                                       sesion.client("sqs", endpoint_url=endpoint))
    print(f"=== APROVISIONANDO INFRAESTRUCTURA IaC EN {endpoint} ===")
    if not aprovisionador.esperar_disponibilidad():
        print("[ERROR] La nube emulada no respondió.")
        return 1
    aprovisionador.aplicar(EstadoDeseado.desde_entorno())
    print("[ÉXITO] Infraestructura lista.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
