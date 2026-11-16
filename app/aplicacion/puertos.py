"""Puertos (interfaces) que necesita el caso de uso.

ISP: interfaces pequeñas y específicas; ningún adaptador implementa métodos que no usa.
DIP: la capa de aplicación define estas abstracciones y la infraestructura las implementa.
"""
from typing import Protocol

from app.dominio.modelos import ResultadoEvaluacion, SolicitudCredito, SolicitudRegistrada


class RepositorioSolicitudes(Protocol):
    def agregar(self, solicitud: SolicitudCredito,
                resultado: ResultadoEvaluacion) -> SolicitudRegistrada: ...

    def actualizar(self, registro: SolicitudRegistrada) -> None: ...

    def obtener(self, solicitud_id: int) -> SolicitudRegistrada | None: ...

    def listar(self) -> list[SolicitudRegistrada]: ...


class PublicadorEventos(Protocol):
    def publicar_aprobacion(self, registro: SolicitudRegistrada) -> bool: ...


class CentralRiesgo(Protocol):
    def consultar(self, solicitud: SolicitudCredito) -> None: ...


class MonitorSalud(Protocol):
    def esta_sano(self) -> bool: ...
