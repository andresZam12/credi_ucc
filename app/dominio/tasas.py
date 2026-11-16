"""Políticas de tasa de interés (Strategy). OCP: nuevas campañas = nuevas clases."""
from abc import ABC, abstractmethod

from app.dominio.modelos import SolicitudCredito


class PoliticaTasa(ABC):
    @abstractmethod
    def tasa_para(self, solicitud: SolicitudCredito) -> float:
        """Tasa mensual (%) aplicable a una solicitud ya aprobada."""


class PoliticaTasaUCC(PoliticaTasa):
    TASA_PREFERENCIAL = 1.2
    TASA_ESTUDIANTE = 1.5
    TASA_GENERAL = 1.9
    SCORE_PREFERENCIAL = 750

    def tasa_para(self, solicitud: SolicitudCredito) -> float:
        if not solicitud.es_estudiante:
            return self.TASA_GENERAL
        if solicitud.score >= self.SCORE_PREFERENCIAL:
            return self.TASA_PREFERENCIAL
        return self.TASA_ESTUDIANTE
