"""Punto de entrada ASGI: `uvicorn app.main:app`."""
from app.api.aplicacion_web import crear_app
from app.config import Configuracion
from app.contenedor import construir_servicio
from app.infraestructura.servicios_externos import MonitorSaludPorEntorno

configuracion = Configuracion.desde_entorno()
app = crear_app(construir_servicio(configuracion), MonitorSaludPorEntorno(), configuracion.version)
