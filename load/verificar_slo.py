"""Semanas 8 + 3: Quality Gate de rendimiento sobre el CSV que genera Locust.

Uso: python load/verificar_slo.py reporte_carga_stats.csv [p95_max_ms] [fallos_max_pct]
Termina con exit code 1 si se viola el SLO, para que el pipeline de CD se detenga.
El CSV debe estar dentro del directorio de trabajo (se rechaza cualquier ruta fuera de él).
"""
from __future__ import annotations

import csv
import sys
from dataclasses import dataclass
from pathlib import Path

FILA_AGREGADA = "Aggregated"


@dataclass(frozen=True)
class MetricaEndpoint:
    nombre: str
    peticiones: int
    fallos: int
    p50_ms: float
    p95_ms: float
    rps: float

    @property
    def porcentaje_fallos(self) -> float:
        return 100 * self.fallos / self.peticiones if self.peticiones else 0.0

    @classmethod
    def desde_fila(cls, fila: dict[str, str]) -> MetricaEndpoint:
        return cls(nombre=f"{fila['Type']} {fila['Name']}".strip(),
                   peticiones=int(fila["Request Count"]), fallos=int(fila["Failure Count"]),
                   p50_ms=float(fila["50%"]), p95_ms=float(fila["95%"]),
                   rps=float(fila["Requests/s"]))


@dataclass(frozen=True)
class ReporteCarga:
    endpoints: tuple[MetricaEndpoint, ...]
    agregado: MetricaEndpoint

    @classmethod
    def desde_csv(cls, ruta: Path) -> ReporteCarga:
        with ruta.open(newline="", encoding="utf-8") as archivo:
            filas = list(csv.DictReader(archivo))
        agregado = next(f for f in filas if f["Name"] == FILA_AGREGADA)
        endpoints = tuple(MetricaEndpoint.desde_fila(f) for f in filas if f is not agregado)
        return cls(endpoints, MetricaEndpoint.desde_fila(agregado))


@dataclass(frozen=True)
class AcuerdoNivelServicio:
    p95_max_ms: float = 1000.0
    fallos_max_pct: float = 1.0

    def se_cumple(self, metrica: MetricaEndpoint) -> bool:
        return metrica.p95_ms <= self.p95_max_ms and metrica.porcentaje_fallos <= self.fallos_max_pct

    def resumen(self, reporte: ReporteCarga) -> str:
        lineas = [f"  {m.nombre:<34} p50={m.p50_ms:>6.0f} ms  p95={m.p95_ms:>6.0f} ms  "
                  f"RPS={m.rps:6.1f}" for m in reporte.endpoints]
        total = reporte.agregado
        lineas.append(f"\nAgregado: {total.peticiones} peticiones | p95={total.p95_ms:.0f} ms "
                      f"(SLO {self.p95_max_ms:.0f}) | fallos={total.porcentaje_fallos:.2f} % "
                      f"(SLO {self.fallos_max_pct:.2f} %)")
        return "\n".join(lineas)


def resolver_ruta_segura(ruta: str, directorio_base: Path) -> Path | None:
    """Evita Path Traversal: solo acepta archivos dentro de ``directorio_base``."""
    base = directorio_base.resolve()
    candidata = (base / ruta).resolve()
    return candidata if candidata.is_relative_to(base) else None


def main(argumentos: list[str], directorio_base: Path | None = None) -> int:
    if not argumentos:
        print(__doc__)
        return 2
    ruta = resolver_ruta_segura(argumentos[0], directorio_base or Path.cwd())
    if ruta is None:
        print(f"[ERROR] El reporte debe estar dentro del directorio de trabajo: {argumentos[0]}")
        return 2
    slo = AcuerdoNivelServicio(*(float(a) for a in argumentos[1:3]))
    reporte = ReporteCarga.desde_csv(ruta)
    print(slo.resumen(reporte))
    if slo.se_cumple(reporte.agregado):
        print("[OK] SLO de rendimiento cumplido")
        return 0
    print("[FALLA] SLO de rendimiento violado")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
