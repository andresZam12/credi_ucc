"""Entidades y objetos de valor del dominio de microcréditos (inmutables)."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
from datetime import UTC, datetime
from enum import StrEnum


class Decision(StrEnum):
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"


class Motivo(StrEnum):
    CUMPLE_POLITICA = "CUMPLE_POLITICA"
    EDAD_FUERA_DE_RANGO = "EDAD_FUERA_DE_RANGO"
    SCORE_INSUFICIENTE = "SCORE_INSUFICIENTE"
    INGRESOS_INSUFICIENTES = "INGRESOS_INSUFICIENTES"


@dataclass(frozen=True)
class Rango:
    """Intervalo cerrado [minimo, maximo]; base del Análisis de Valores Límite."""

    minimo: float
    maximo: float

    def contiene(self, valor: float) -> bool:
        return self.minimo <= valor <= self.maximo


@dataclass(frozen=True)
class SolicitudCredito:
    nombre: str
    email: str
    edad: int
    score: int
    ingresos: float
    monto: float
    es_estudiante: bool = False


@dataclass(frozen=True)
class ResultadoEvaluacion:
    decision: Decision
    motivo: Motivo
    tasa_mensual: float | None = None

    @classmethod
    def aprobado(cls, tasa_mensual: float) -> ResultadoEvaluacion:
        return cls(Decision.APROBADO, Motivo.CUMPLE_POLITICA, tasa_mensual)

    @classmethod
    def rechazado(cls, motivo: Motivo) -> ResultadoEvaluacion:
        return cls(Decision.RECHAZADO, motivo)

    @property
    def es_aprobado(self) -> bool:
        return self.decision is Decision.APROBADO


def _ahora_utc() -> datetime:
    return datetime.now(UTC)


def clave_cliente(email: str) -> str:
    """Identidad del cliente: el correo sin espacios y en minúsculas ("Ana@UCC.co " == "ana@ucc.co")."""
    return email.strip().lower()


@dataclass(frozen=True)
class SolicitudRegistrada:
    """Solicitud ya evaluada y persistida (entidad con identidad).

    numero_cliente: qué número de solicitud es para ese correo (1 = cliente nuevo, 2+ = recurrente).
    version: cuántas veces se ha evaluado; sube cada vez que el cliente actualiza sus datos.
    """

    id: int
    solicitud: SolicitudCredito
    resultado: ResultadoEvaluacion
    notificado: bool = False
    creado_en: datetime = field(default_factory=_ahora_utc)
    numero_cliente: int = 1
    version: int = 1
    actualizado_en: datetime | None = None

    @property
    def es_recurrente(self) -> bool:
        return self.numero_cliente > 1

    def con_notificacion(self, notificado: bool) -> SolicitudRegistrada:
        return replace(self, notificado=notificado)

    def reevaluada(self, solicitud: SolicitudCredito, resultado: ResultadoEvaluacion) -> SolicitudRegistrada:
        """Misma solicitud (mismo id y número de cliente) con datos nuevos: sube la versión."""
        return replace(self, solicitud=solicitud, resultado=resultado, notificado=False,
                       version=self.version + 1, actualizado_en=_ahora_utc())

    def a_dict(self) -> dict:
        """Representación plana y estable: es el contrato JSON de la API."""
        datos = asdict(self.solicitud)
        return {
            "id": self.id,
            "nombre": datos["nombre"],
            "email": datos["email"],
            "monto": datos["monto"],
            "decision": self.resultado.decision.value,
            "motivo": self.resultado.motivo.value,
            "tasa_mensual": self.resultado.tasa_mensual,
            "notificado": self.notificado,
            "creado_en": self.creado_en.isoformat(),
            "numero_cliente": self.numero_cliente,
            "es_recurrente": self.es_recurrente,
            "version": self.version,
            "actualizado_en": self.actualizado_en.isoformat() if self.actualizado_en else None,
        }
