"""Caso de uso principal: radicar y consultar solicitudes de microcrédito."""
from app.aplicacion.puertos import CentralRiesgo, PublicadorEventos, RepositorioSolicitudes
from app.dominio.evaluador import EvaluadorCredito
from app.dominio.modelos import SolicitudCredito, SolicitudRegistrada, clave_cliente


class SolicitudNoEncontradaError(LookupError):
    def __init__(self, solicitud_id: int) -> None:
        super().__init__(f"Solicitud {solicitud_id} no encontrada")
        self.solicitud_id = solicitud_id


class CorreoNoCoincideError(PermissionError):
    """Una solicitud solo la puede actualizar el mismo cliente (mismo correo)."""

    def __init__(self, solicitud_id: int) -> None:
        super().__init__(f"La solicitud #{solicitud_id} pertenece a otro correo; no se puede actualizar.")
        self.solicitud_id = solicitud_id


class ServicioSolicitudes:
    """SRP: coordina el flujo; las decisiones de negocio viven en el dominio."""

    def __init__(
        self,
        evaluador: EvaluadorCredito,
        repositorio: RepositorioSolicitudes,
        publicador: PublicadorEventos,
        central_riesgo: CentralRiesgo,
    ) -> None:
        self._evaluador = evaluador
        self._repositorio = repositorio
        self._publicador = publicador
        self._central_riesgo = central_riesgo

    def radicar(self, solicitud: SolicitudCredito) -> SolicitudRegistrada:
        resultado = self._evaluador.evaluar(solicitud)
        self._central_riesgo.consultar(solicitud)
        registro = self._repositorio.agregar(solicitud, resultado)
        return self._notificar_si_aprobada(registro)

    def actualizar(self, solicitud_id: int, solicitud: SolicitudCredito) -> SolicitudRegistrada:
        """Reevalúa una solicitud existente con datos nuevos: conserva el id y sube la versión."""
        existente = self.obtener(solicitud_id)
        if clave_cliente(existente.solicitud.email) != clave_cliente(solicitud.email):
            raise CorreoNoCoincideError(solicitud_id)
        resultado = self._evaluador.evaluar(solicitud)
        self._central_riesgo.consultar(solicitud)
        registro = existente.reevaluada(solicitud, resultado)
        self._repositorio.actualizar(registro)
        return self._notificar_si_aprobada(registro)

    def _notificar_si_aprobada(self, registro: SolicitudRegistrada) -> SolicitudRegistrada:
        if registro.resultado.es_aprobado:
            registro = registro.con_notificacion(self._publicador.publicar_aprobacion(registro))
            self._repositorio.actualizar(registro)
        return registro

    def obtener(self, solicitud_id: int) -> SolicitudRegistrada:
        registro = self._repositorio.obtener(solicitud_id)
        if registro is None:
            raise SolicitudNoEncontradaError(solicitud_id)
        return registro

    def listar(self) -> list[SolicitudRegistrada]:
        return self._repositorio.listar()
