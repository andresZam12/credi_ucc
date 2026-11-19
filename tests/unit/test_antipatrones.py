"""Anti-patrones de pruebas y su solución.

Cada caso tiene tres piezas:
  * antipatron_*  -> la prueba MAL escrita. No empieza por test_, así que pytest no la ejecuta sola.
  * solucion_*    -> la misma prueba BIEN escrita.
  * test_*        -> la demostración: con un MUTANTE (una copia del código con un bug inyectado)
                     se comprueba que el anti-patrón deja pasar el bug y la solución lo detecta.
                     Al final, la solución corre sobre el código real y pasa.

Idea clave para la exposición: una prueba que nunca puede fallar no prueba nada.
"""
import pytest

import tests.unit.test_antipatrones as este_modulo
from app.dominio.errores import TipoInvalidoError
from app.dominio.evaluador import EvaluadorCredito
from app.dominio.modelos import Motivo, ResultadoEvaluacion
from app.dominio.reglas import ReglaEdad, ReglaIngresoMinimo, ReglaScoreMinimo
from app.dominio.tasas import PoliticaTasaUCC
from app.dominio.validacion import ValidadorSolicitud
from app.infraestructura.repositorio_memoria import RepositorioEnMemoria
from tests.unit.conftest import nueva_solicitud


# ------------------------------------------------------------------ mutantes (bugs inyectados)
class ReglaScoreMinimoConBug(ReglaScoreMinimo):
    """Bug off-by-one: usa > en lugar de >=, así que un score de 600 queda rechazado."""

    def motivo_rechazo(self, solicitud):
        return None if solicitud.score > self._minimo else Motivo.SCORE_INSUFICIENTE


class ValidadorQueNoValida(ValidadorSolicitud):
    """Bug: alguien "simplificó" el validador y ya no revisa nada."""

    def validar(self, solicitud) -> None:
        return None


def evaluador_con(regla_score=None, validador=None) -> EvaluadorCredito:
    reglas = (ReglaEdad(), regla_score or ReglaScoreMinimo(), ReglaIngresoMinimo())
    return EvaluadorCredito(reglas, PoliticaTasaUCC(), validador or ValidadorSolicitud())


# ======================================================== 1. Prueba sin aserción
def antipatron_sin_asercion(evaluador: EvaluadorCredito) -> None:
    # "Si no explota, funciona": ejecuta el código pero nunca revisa el resultado.
    evaluador.evaluar(nueva_solicitud(score=600))


def solucion_con_asercion(evaluador: EvaluadorCredito) -> None:
    # Arrange / Act / Assert: el valor límite 600 DEBE aprobarse.
    resultado = evaluador.evaluar(nueva_solicitud(score=600))
    assert resultado.motivo is Motivo.CUMPLE_POLITICA


def test_prueba_sin_asercion_no_detecta_el_bug_off_by_one():
    mutante = evaluador_con(regla_score=ReglaScoreMinimoConBug())

    antipatron_sin_asercion(mutante)            # pasa en verde aunque el código está roto
    with pytest.raises(AssertionError):
        solucion_con_asercion(mutante)          # la solución sí descubre el bug
    solucion_con_asercion(EvaluadorCredito.por_defecto())  # y pasa con el código correcto


# ================================================ 2. try/except que se traga los errores
def antipatron_except_generico(evaluador: EvaluadorCredito) -> None:
    # Se espera un error, pero si NO ocurre ninguno la prueba igual pasa.
    # El análisis estático lo detecta solo: Ruff (SIM105) y SonarCloud marcan este bloque.
    # Aquí se silencian A PROPÓSITO porque el código malo es el ejemplo.
    try:  # noqa: SIM105
        evaluador.evaluar(nueva_solicitud(score=True))  # bool es subclase de int: entrada trampa
    except Exception:  # NOSONAR
        pass


def solucion_pytest_raises(evaluador: EvaluadorCredito) -> None:
    # pytest.raises falla si la excepción NO se lanza, y exige el tipo exacto.
    with pytest.raises(TipoInvalidoError):
        evaluador.evaluar(nueva_solicitud(score=True))


def test_except_generico_no_detecta_un_validador_roto():
    mutante = evaluador_con(validador=ValidadorQueNoValida())

    antipatron_except_generico(mutante)          # pasa en verde aunque ya no se valida nada
    with pytest.raises(pytest.fail.Exception):
        solucion_pytest_raises(mutante)          # "DID NOT RAISE": el bug queda expuesto
    solucion_pytest_raises(EvaluadorCredito.por_defecto())


# ============================================= 3. Estado compartido entre pruebas
REPOSITORIO_GLOBAL = RepositorioEnMemoria()      # vive durante TODA la ejecución de la suite


def antipatron_estado_compartido() -> None:
    # Depende de que nadie haya escrito antes en el repositorio global:
    # el resultado cambia según el orden y la cantidad de pruebas que corran.
    REPOSITORIO_GLOBAL.agregar(nueva_solicitud(), ResultadoEvaluacion.aprobado(1.5))
    assert len(REPOSITORIO_GLOBAL.listar()) == 1


def test_estado_compartido_hace_que_la_misma_prueba_pase_y_luego_falle(monkeypatch):
    # Se aísla el global solo para esta demostración (así esta suite sigue siendo determinista).
    monkeypatch.setattr(este_modulo, "REPOSITORIO_GLOBAL", RepositorioEnMemoria())

    antipatron_estado_compartido()               # 1.ª ejecución: pasa
    with pytest.raises(AssertionError):
        antipatron_estado_compartido()           # 2.ª ejecución, mismo código: falla (prueba frágil)


@pytest.fixture
def repositorio() -> RepositorioEnMemoria:
    """Solución: cada prueba recibe un repositorio nuevo y vacío (aislamiento)."""
    return RepositorioEnMemoria()


@pytest.mark.parametrize("ejecucion", [1, 2, 3])
def test_solucion_estado_aislado_es_repetible(repositorio, ejecucion):
    repositorio.agregar(nueva_solicitud(), ResultadoEvaluacion.aprobado(1.5))
    assert len(repositorio.listar()) == 1        # pasa siempre, sin importar el orden
