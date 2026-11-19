"""Fixtures y fábricas compartidas (DRY en la suite)."""
from dataclasses import replace

import pytest

from app.dominio.modelos import SolicitudCredito

SOLICITUD_BASE = SolicitudCredito(nombre="Laura Rojas", email="laura@example.com", edad=30,
                                  score=700, ingresos=2_500_000.0, monto=2_000_000.0, es_estudiante=False)


def nueva_solicitud(**cambios) -> SolicitudCredito:
    """Solicitud válida por defecto; cada prueba cambia solo la variable que estudia."""
    return replace(SOLICITUD_BASE, **cambios)


@pytest.fixture(autouse=True)
def credenciales_aws_falsas(monkeypatch):
    """Nunca usar credenciales reales en pruebas unitarias."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
