"""Adaptadores de servicios externos simulados."""
import os
import time
from collections.abc import Callable

from app.dominio.modelos import SolicitudCredito


class CentralRiesgoSimulada:
    """Emula la latencia de una central de riesgo (cuello de botella de la Semana 8)."""

    def __init__(self, latencia_ms: int = 0, dormir: Callable[[float], None] = time.sleep) -> None:
        self._latencia_s = latencia_ms / 1000
        self._dormir = dormir

    def consultar(self, solicitud: SolicitudCredito) -> None:
        if self._latencia_s > 0:
            self._dormir(self._latencia_s)


class MonitorSaludPorEntorno:
    """Lee la salud en cada llamada para poder simular fallos en caliente (Semana 9)."""

    def __init__(self, variable: str = "APP_HEALTHY") -> None:
        self._variable = variable

    def esta_sano(self) -> bool:
        return os.getenv(self._variable, "true").strip().lower() == "true"
