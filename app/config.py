"""Configuración inmutable leída del entorno (12-Factor: nada sensible en el código)."""
from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Configuracion:
    version: str = "1.0.0"
    nube_habilitada: bool = False
    aws_endpoint: str = "http://localhost:4566"
    aws_region: str = "us-east-1"
    bucket: str = "crediucc-expedientes"
    cola: str = "crediucc-notificaciones"
    latencia_central_ms: int = 0

    @classmethod
    def desde_entorno(cls, entorno: Mapping[str, str] = os.environ) -> Configuracion:
        return cls(
            version=entorno.get("APP_VERSION", cls.version),
            nube_habilitada=entorno.get("CLOUD_ENABLED", "false").lower() == "true",
            aws_endpoint=entorno.get("AWS_ENDPOINT_URL", cls.aws_endpoint),
            aws_region=entorno.get("AWS_DEFAULT_REGION", cls.aws_region),
            bucket=entorno.get("S3_BUCKET", cls.bucket),
            cola=entorno.get("SQS_QUEUE", cls.cola),
            latencia_central_ms=int(entorno.get("CENTRAL_RIESGO_LATENCIA_MS", "0")),
        )
