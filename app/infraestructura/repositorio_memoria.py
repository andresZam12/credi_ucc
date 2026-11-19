"""Adaptador de persistencia en memoria (seguro para hilos: Uvicorn atiende en paralelo)."""
from itertools import count
from threading import Lock

from app.dominio.modelos import ResultadoEvaluacion, SolicitudCredito, SolicitudRegistrada, clave_cliente


class RepositorioEnMemoria:
    def __init__(self) -> None:
        self._registros: dict[int, SolicitudRegistrada] = {}
        self._secuencia = count(1)
        self._candado = Lock()

    def agregar(self, solicitud: SolicitudCredito,
                resultado: ResultadoEvaluacion) -> SolicitudRegistrada:
        with self._candado:
            # Se cuenta dentro del candado: dos peticiones simultáneas del mismo correo
            # no pueden recibir el mismo número de solicitud.
            clave = clave_cliente(solicitud.email)
            previas = sum(1 for r in self._registros.values() if clave_cliente(r.solicitud.email) == clave)
            registro = SolicitudRegistrada(next(self._secuencia), solicitud, resultado,
                                           numero_cliente=previas + 1)
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
