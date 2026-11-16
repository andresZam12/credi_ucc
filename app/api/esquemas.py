"""DTOs de entrada/salida HTTP: separan el contrato público del modelo de dominio."""
from pydantic import BaseModel

from app.dominio.modelos import SolicitudCredito


class SolicitudEntrada(BaseModel):
    nombre: str
    email: str
    edad: int
    score: int
    ingresos: float
    monto: float
    es_estudiante: bool = False

    def a_dominio(self) -> SolicitudCredito:
        return SolicitudCredito(**self.model_dump())
