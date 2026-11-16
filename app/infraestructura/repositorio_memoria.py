"""Adaptador de persistencia en memoria (seguro para hilos: Uvicorn atiende en paralelo)."""
from itertools import count
from threading import Lock

from app.dominio.modelos import ResultadoEvaluacion, SolicitudCredito, SolicitudRegistrada


class RepositorioEnMemoria:
    def __init__(self) -> None:
        self._registros: dict[int, SolicitudRegistrada] = {}
        self._secuencia = count(1)
        self._candado = Lock()

    def agregar(self, solicitud: SolicitudCredito,
                resultado: ResultadoEvaluacion) -> SolicitudRegistrada:
        with self._candado:
            registro = SolicitudRegistrada(next(self._secuencia), solicitud, resultado)
            self._registros[registro.id] = registro
        return registro

    def actualizar(self, registro: SolicitudRegistrada) -> None:
        with self._candado:
            self._registros[registro.id] = registro

    def obtener(self, solicitud_id: int) -> SolicitudRegistrada | None:
        return self._registros.get(solicitud_id)

    def listar(self) -> list[SolicitudRegistrada]:
        with self._candado:
            return list(self._registros.values())
