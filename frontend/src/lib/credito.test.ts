import { describe, expect, it } from "vitest";
import { CAMPOS_VACIOS, aSolicitud, agruparMiles, formatearPesos, soloDigitos, validar, type Campos } from "./credito";

const VALIDOS: Campos = {
  nombre: "Ana Pérez",
  email: "ana@example.com",
  edad: "22",
  score: "720",
  ingresos: "2500000",
  monto: "3000000",
  esEstudiante: true,
};

describe("formato de pesos", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["500", "500"],
    ["1500", "1.500"],
    ["500000", "500.000"],
    ["20000000", "20.000.000"],
  ])("agrupa %s como %s", (entrada, esperado) => {
    expect(agruparMiles(entrada)).toBe(esperado);
  });

  it("formatea montos con signo de pesos y redondea", () => {
    expect(formatearPesos(1_500_000)).toBe("$1.500.000");
    expect(formatearPesos(999.6)).toBe("$1.000");
  });
});

describe("corrección de entradas numéricas", () => {
  it.each([
    ["1.500.000", 10, "1500000"],   // el usuario escribe con puntos de miles
    ["2a5", 3, "25"],               // letras mezcladas
    ["$ 3,000,000", 10, "3000000"], // símbolos, comas y espacios
    ["0007", 3, "7"],               // ceros a la izquierda
    ["0", 3, "0"],                  // un cero solo se conserva
    ["123456", 3, "123"],           // límite de dígitos
    ["abc", 3, ""],
  ])("convierte %j en %j", (entrada, maximo, esperado) => {
    expect(soloDigitos(entrada, maximo)).toBe(esperado);
  });
});

describe("validación del formulario", () => {
  it("no reporta errores con datos válidos", () => {
    expect(validar(VALIDOS)).toEqual({});
  });

  it("reporta todos los campos vacíos con mensajes en español", () => {
    expect(validar(CAMPOS_VACIOS)).toEqual({
      nombre: "Escribe tu nombre completo.",
      email: "Escribe un correo válido, por ejemplo nombre@correo.com.",
      edad: "Escribe tu edad.",
      score: "Escribe tu score crediticio.",
      ingresos: "Escribe tus ingresos mensuales en pesos.",
      monto: "Escribe cuánto dinero necesitas.",
    });
  });

  it.each(["ana", "ana@", "@example.com", "ana@example", "ana@.com", "ana@example.", "a b@example.com", "a@b@c.com"])(
    "rechaza el correo inválido %j",
    (email) => {
      expect(validar({ ...VALIDOS, email }).email).toBeDefined();
    },
  );

  it("exige un nombre de al menos 3 letras sin contar espacios", () => {
    expect(validar({ ...VALIDOS, nombre: "  Al  " }).nombre).toBeDefined();
    expect(validar({ ...VALIDOS, nombre: "Ana" }).nombre).toBeUndefined();
  });

  // Valores límite: los mismos bordes de dominio que valida la API.
  it.each([
    ["edad", "0", false], ["edad", "120", false], ["edad", "121", true],
    ["score", "299", true], ["score", "300", false], ["score", "850", false], ["score", "851", true],
    ["monto", "499999", true], ["monto", "500000", false], ["monto", "20000000", false], ["monto", "20000001", true],
  ] as const)("%s = %s -> ¿error? %s", (campo, valor, hayError) => {
    expect(validar({ ...VALIDOS, [campo]: valor })[campo] !== undefined).toBe(hayError);
  });

  it("acepta ingresos bajos: no aprobar es decisión del evaluador, no un error de datos", () => {
    expect(validar({ ...VALIDOS, ingresos: "0" }).ingresos).toBeUndefined();
  });
});

describe("cuerpo para la API", () => {
  it("convierte los textos en números y recorta espacios", () => {
    expect(aSolicitud({ ...VALIDOS, nombre: "  Ana Pérez ", esEstudiante: false })).toEqual({
      nombre: "Ana Pérez",
      email: "ana@example.com",
      edad: 22,
      score: 720,
      ingresos: 2_500_000,
      monto: 3_000_000,
      es_estudiante: false,
    });
  });
});
