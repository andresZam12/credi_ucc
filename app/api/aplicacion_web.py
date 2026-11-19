"""Adaptador HTTP (FastAPI). Solo traduce HTTP <-> caso de uso; no tiene lógica de negocio."""
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.esquemas import SolicitudEntrada
from app.aplicacion.puertos import MonitorSalud
from app.aplicacion.servicio_solicitudes import (
    CorreoNoCoincideError,
    ServicioSolicitudes,
    SolicitudNoEncontradaError,
)
from app.dominio.errores import DominioError

NOMBRE_SERVICIO = "crediucc-api"
rutas = APIRouter()


def obtener_servicio(request: Request) -> ServicioSolicitudes:
    return request.app.state.servicio


Servicio = Annotated[ServicioSolicitudes, Depends(obtener_servicio)]


@rutas.get("/health")
def salud(request: Request, response: Response) -> dict:
    sano = request.app.state.monitor_salud.esta_sano()
    if not sano:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    return {"status": "healthy" if sano else "unhealthy",
            "version": request.app.version, "service": NOMBRE_SERVICIO}


@rutas.post("/api/v1/solicitudes", status_code=status.HTTP_201_CREATED)
def radicar_solicitud(entrada: SolicitudEntrada,
                      servicio: Servicio) -> dict:
    return servicio.radicar(entrada.a_dominio()).a_dict()


@rutas.put("/api/v1/solicitudes/{solicitud_id}")
def actualizar_solicitud(solicitud_id: int, entrada: SolicitudEntrada,
                         servicio: Servicio) -> dict:
    """Reevalúa una solicitud existente del mismo cliente: conserva el número y sube la versión."""
    return servicio.actualizar(solicitud_id, entrada.a_dominio()).a_dict()


@rutas.get("/api/v1/solicitudes")
def listar_solicitudes(servicio: Servicio) -> list[dict]:
    return [registro.a_dict() for registro in servicio.listar()]


@rutas.get("/api/v1/solicitudes/{solicitud_id}")
def obtener_solicitud(solicitud_id: int,
                      servicio: Servicio) -> dict:
    return servicio.obtener(solicitud_id).a_dict()


def _error_dominio(_: Request, exc: DominioError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)})


def _no_encontrada(_: Request, exc: SolicitudNoEncontradaError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})


def _correo_no_coincide(_: Request, exc: CorreoNoCoincideError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)})


def crear_app(servicio: ServicioSolicitudes, monitor_salud: MonitorSalud,
              version: str = "1.0.0") -> FastAPI:
    """Fábrica: las dependencias llegan desde fuera (fácil de probar con dobles)."""
    app = FastAPI(title="CrediUCC API", version=version)
    app.state.servicio = servicio
    app.state.monitor_salud = monitor_salud
    app.include_router(rutas)
    app.add_exception_handler(DominioError, _error_dominio)
    app.add_exception_handler(SolicitudNoEncontradaError, _no_encontrada)
    app.add_exception_handler(CorreoNoCoincideError, _correo_no_coincide)
    return app
