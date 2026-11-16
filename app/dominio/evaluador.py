"""Evaluador de crédito: orquesta validación, reglas y tasa.

DIP: depende de las abstracciones ReglaElegibilidad y PoliticaTasa, que se
inyectan por constructor; no conoce ninguna implementación concreta.
"""
from __future__ import annotations

from collections.abc import Sequence

from app.dominio.modelos import ResultadoEvaluacion, SolicitudCredito
from app.dominio.reglas import ReglaElegibilidad, reglas_por_defecto
from app.dominio.tasas import PoliticaTasa, PoliticaTasaUCC
from app.dominio.validacion import ValidadorSolicitud


class EvaluadorCredito:
    def __init__(
        self,
        reglas: Sequence[ReglaElegibilidad],
        politica_tasa: PoliticaTasa,
        validador: ValidadorSolicitud,
    ) -> None:
        self._reglas = tuple(reglas)
        self._politica_tasa = politica_tasa
        self._validador = validador

    @classmethod
    def por_defecto(cls) -> EvaluadorCredito:
        return cls(reglas_por_defecto(), PoliticaTasaUCC(), ValidadorSolicitud())

    def evaluar(self, solicitud: SolicitudCredito) -> ResultadoEvaluacion:
        self._validador.validar(solicitud)
        for regla in self._reglas:
            motivo = regla.motivo_rechazo(solicitud)
            if motivo is not None:
                return ResultadoEvaluacion.rechazado(motivo)
        return ResultadoEvaluacion.aprobado(self._politica_tasa.tasa_para(solicitud))
