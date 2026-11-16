"""Excepciones del dominio. Heredan de las nativas para no romper a quien ya las captura."""


class DominioError(Exception):
    """Raíz de los errores de negocio."""


class TipoInvalidoError(DominioError, TypeError):
    """Dato con tipo incorrecto (texto, nulo, booleano disfrazado de entero...)."""


class ValorFueraDeDominioError(DominioError, ValueError):
    """Dato con tipo correcto pero fuera del dominio permitido."""
