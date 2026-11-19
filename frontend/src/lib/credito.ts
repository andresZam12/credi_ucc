/**
 * Lógica pura del formulario: formato de pesos, limpieza de entradas y validación.
 * No depende de React, así que se prueba con pruebas unitarias rápidas (credito.test.ts).
 *
 * Los límites reflejan los del dominio en el backend (app/dominio/validacion.py y reglas.py).
 * El frontend valida para dar mensajes claros; la API vuelve a validar porque nunca se confía en el cliente.
 */

/** Rangos de datos válidos: fuera de ellos la API responde 400. */
export const LIMITES = {
  edad: { min: 0, max: 120 },
  score: { min: 300, max: 850 },
  monto: { min: 500_000, max: 20_000_000 },
} as const;

/** Reglas de aprobación: los datos son válidos, pero la solicitud se rechaza si no se cumplen. */
export const REQUISITOS = {
  edadMin: 18,
  edadMax: 65,
  scoreMin: 600,
  ingresosMin: 1_500_000,
} as const;

export const TASAS = {
  preferencial: 1.2,
  estudiante: 1.5,
  general: 1.9,
  scorePreferencial: 750,
} as const;

export type CampoTexto = "nombre" | "email" | "edad" | "score" | "ingresos" | "monto";

export type Campos = Record<CampoTexto, string> & { esEstudiante: boolean };

export type Errores = Partial<Record<CampoTexto, string>>;

/** Orden visual del formulario: se usa para enfocar el primer campo con error. */
export const ORDEN_CAMPOS: readonly CampoTexto[] = ["nombre", "email", "edad", "score", "ingresos", "monto"];

export const CAMPOS_VACIOS: Campos = {
  nombre: "",
  email: "",
  edad: "",
  score: "",
  ingresos: "",
  monto: "",
  esEstudiante: true,
};

/** Agrupa los miles con punto, como se escribe en Colombia: "1500000" -> "1.500.000". */
export function agruparMiles(digitos: string): string {
  let resultado = "";
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) resultado += ".";
    resultado += digitos[i];
  }
  return resultado;
}

export function formatearPesos(valor: number): string {
  return `$${agruparMiles(String(Math.round(valor)))}`;
}

/**
 * Corrige lo que escribe el usuario en un campo numérico: quita letras, puntos, comas y espacios,
 * elimina ceros a la izquierda y limita la cantidad de dígitos. "1.500.000" -> "1500000", "2a5" -> "25".
 */
export function soloDigitos(texto: string, maxDigitos: number): string {
  return texto.replaceAll(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, maxDigitos);
}

function correoValido(correo: string): boolean {
  if (/\s/.test(correo)) return false;
  const partes = correo.split("@");
  if (partes.length !== 2) return false;
  const [usuario, dominio] = partes;
  return usuario.length > 0 && dominio.includes(".") && !dominio.startsWith(".") && !dominio.endsWith(".");
}

function errorDeRango(valor: string, min: number, max: number, vacio: string, fuera: string): string | undefined {
  if (valor === "") return vacio;
  const numero = Number(valor);
  return numero < min || numero > max ? fuera : undefined;
}

export function validar(campos: Campos): Errores {
  const errores: Errores = {};

  if (campos.nombre.trim().length < 3) errores.nombre = "Escribe tu nombre completo.";
  if (!correoValido(campos.email.trim())) errores.email = "Escribe un correo válido, por ejemplo nombre@correo.com.";

  errores.edad = errorDeRango(campos.edad, LIMITES.edad.min, LIMITES.edad.max,
    "Escribe tu edad.", "Escribe una edad válida, entre 0 y 120 años.");
  errores.score = errorDeRango(campos.score, LIMITES.score.min, LIMITES.score.max,
    "Escribe tu score crediticio.", "El score crediticio va de 300 a 850 puntos.");
  if (campos.ingresos === "") errores.ingresos = "Escribe tus ingresos mensuales en pesos.";
  errores.monto = errorDeRango(campos.monto, LIMITES.monto.min, LIMITES.monto.max,
    "Escribe cuánto dinero necesitas.",
    `El monto debe estar entre ${formatearPesos(LIMITES.monto.min)} y ${formatearPesos(LIMITES.monto.max)}.`);

  for (const campo of ORDEN_CAMPOS) {
    if (errores[campo] === undefined) delete errores[campo];
  }
  return errores;
}

/** Cuerpo JSON que espera la API (POST /api/v1/solicitudes). */
export function aSolicitud(campos: Campos) {
  return {
    nombre: campos.nombre.trim(),
    email: campos.email.trim(),
    edad: Number(campos.edad),
    score: Number(campos.score),
    ingresos: Number(campos.ingresos),
    monto: Number(campos.monto),
    es_estudiante: campos.esEstudiante,
  };
}
