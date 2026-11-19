import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const aprobada = {
  id: 17,
  nombre: "Laura Rojas",
  email: "laura@example.com",
  monto: 3_000_000,
  decision: "APROBADO",
  motivo: "CUMPLE_POLITICA",
  tasa_mensual: 1.5,
  notificado: true,
  creado_en: "2026-01-15T12:00:00Z",
  numero_cliente: 1,
  es_recurrente: false,
  version: 1,
  actualizado_en: null,
};

const rechazada = {
  ...aprobada,
  id: 18,
  decision: "RECHAZADO",
  motivo: "INGRESOS_INSUFICIENTES",
  tasa_mensual: null,
  creado_en: "fecha-inválida",
};

// ------------------------------------------------------------ doble de la API (fetch falso)
type Respuesta = (() => Response) | "sin-red";
type Rutas = { health?: Respuesta[]; historial?: Respuesta[]; post?: Respuesta[]; put?: Respuesta[] };

const json = (body: unknown, status = 200): Respuesta => () => new Response(JSON.stringify(body), { status });
const texto = (body: string, status: number): Respuesta => () => new Response(body, { status });

function rutaDe(url: string, init?: RequestInit): keyof Rutas {
  if (url === "/health") return "health";
  if (init?.method === "POST") return "post";
  if (init?.method === "PUT") return "put";
  return "historial";
}

/** Responde según la ruta. Cada cola entrega sus respuestas en orden y repite la última. */
function simularApi({ health = [json({})], historial = [json([])], post = [], put = [] }: Rutas = {}) {
  const colas: Required<Rutas> = { health: [...health], historial: [...historial], post: [...post], put: [...put] };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const cola = colas[rutaDe(url, init)];
    const respuesta = cola.length > 1 ? cola.shift() : cola[0];
    if (respuesta === undefined) throw new Error(`Sin respuesta simulada para ${url}`);
    if (respuesta === "sin-red") throw new TypeError("Failed to fetch");
    return respuesta();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function escribir(etiqueta: string | RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function llenarFormulario() {
  escribir("Nombre completo", "  Ana Pérez  ");
  escribir("Correo electrónico", "ana@example.com");
  escribir("Edad", "22");
  escribir("Score crediticio", "720");
  escribir("Ingresos mensuales", "2.500.000");
  escribir("¿Cuánto necesitas?", "3000000");
}

function evaluar() {
  fireEvent.click(screen.getByRole("button", { name: "Evaluar solicitud" }));
}

async function renderizarListo() {
  render(<Home />);
  await screen.findByText("Servicio disponible");
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("estado del servicio e historial", () => {
  it("muestra el historial con montos en pesos cuando el servicio responde", async () => {
    simularApi({ historial: [json([aprobada, rechazada])] });
    await renderizarListo();

    const tabla = await screen.findByRole("table");
    expect(within(tabla).getByText("#17 · Laura Rojas")).toBeTruthy();
    expect(within(tabla).getAllByText("$3.000.000")).toHaveLength(2);
    expect(within(tabla).getByText("1,5 %")).toBeTruthy();
    expect(within(tabla).getByText("Aprobada")).toBeTruthy();
    expect(within(tabla).getByText("Rechazada")).toBeTruthy();
    expect(within(tabla).getAllByText("—")).toHaveLength(2); // fecha inválida y tasa nula

    const resumen = screen.getByRole("region", { name: "Resumen de solicitudes" });
    expect(within(resumen).getByText("Solicitudes evaluadas").nextElementSibling?.textContent).toBe("2");
    expect(within(resumen).getByText("Aprobadas").nextElementSibling?.textContent).toBe("1");
    expect(within(resumen).getByText("Monto aprobado").nextElementSibling?.textContent).toBe("$3.000.000"); // solo suma aprobadas
  });

  it("indica cuando todavía no hay solicitudes", async () => {
    simularApi();
    await renderizarListo();
    expect(await screen.findByText(/Todavía no hay solicitudes/)).toBeTruthy();
  });

  it("avisa claramente si la API está apagada y se recupera con Reintentar", async () => {
    const fetchMock = simularApi({ health: ["sin-red", json({})], historial: [json([aprobada])] });
    render(<Home />);

    const aviso = await screen.findByRole("alert");
    expect(within(aviso).getByText("No hay conexión con el servicio de evaluación")).toBeTruthy();
    expect(screen.getByText("Servicio no disponible")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin servicio no se pide el historial

    fireEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Servicio disponible")).toBeTruthy();
    expect(screen.queryByText("No hay conexión con el servicio de evaluación")).toBeNull();
    expect(await screen.findByText("#17 · Laura Rojas")).toBeTruthy();
  });

  it("mantiene el aviso si Reintentar vuelve a fallar", async () => {
    simularApi({ health: [json({}, 500)] });
    render(<Home />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" }).hasAttribute("disabled")).toBe(false));
    expect(screen.getByText("Servicio no disponible")).toBeTruthy();
  });

  it("informa un historial con formato inválido y se recupera con Actualizar", async () => {
    simularApi({ historial: [json([{ id: "x" }]), json([aprobada])] });
    await renderizarListo();
    expect(await screen.findByText("No pudimos cargar el historial de solicitudes.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByText("#17 · Laura Rojas")).toBeTruthy();
    expect(screen.queryByText("No pudimos cargar el historial de solicitudes.")).toBeNull();
  });

  it("informa si el historial responde con error HTTP", async () => {
    simularApi({ historial: [json({}, 503)] });
    await renderizarListo();
    expect(await screen.findByText("No pudimos cargar el historial de solicitudes.")).toBeTruthy();
  });
});

describe("antes de que cargue el JavaScript", () => {
  // Bug real reportado: con el JavaScript sin cargar, el formulario se enviaba como HTML clásico,
  // recargaba la página y borraba los datos. Ahora el HTML del servidor trae el botón deshabilitado.
  it("el HTML del servidor muestra el botón deshabilitado con 'Cargando…'", () => {
    const html = renderToString(<Home />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"[^>]*>Cargando…<\/button>/);
    expect(html).not.toContain("Evaluar solicitud</button>");
  });

  it("al cargar el JavaScript el botón se habilita", async () => {
    simularApi();
    await renderizarListo();
    expect(screen.getByRole("button", { name: "Evaluar solicitud" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("corrección y validación de entradas", () => {
  it("formatea los pesos con puntos de miles y limpia letras mientras se escribe", async () => {
    simularApi();
    await renderizarListo();

    escribir("Ingresos mensuales", "2500000abc");
    escribir("¿Cuánto necesitas?", "$ 3.000.000");
    escribir("Edad", "2a5");

    expect((screen.getByLabelText("Ingresos mensuales") as HTMLInputElement).value).toBe("2.500.000");
    expect((screen.getByLabelText("¿Cuánto necesitas?") as HTMLInputElement).value).toBe("3.000.000");
    expect((screen.getByLabelText("Edad") as HTMLInputElement).value).toBe("25");
  });

  it("al enviar vacío muestra qué corregir, enfoca el primer campo y no llama a la API", async () => {
    const fetchMock = simularApi();
    await renderizarListo();
    fetchMock.mockClear();

    evaluar();

    expect(await screen.findByText("Revisa los campos marcados en rojo antes de continuar.")).toBeTruthy();
    expect(screen.getByText("Escribe tu nombre completo.")).toBeTruthy();
    expect(screen.getByText("Escribe cuánto dinero necesitas.")).toBeTruthy();
    expect(screen.getByLabelText("Nombre completo").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra el error de un campo al salir de él, sin esperar al envío", async () => {
    simularApi();
    await renderizarListo();

    escribir("¿Cuánto necesitas?", "100");
    expect(screen.queryByText(/El monto debe estar entre/)).toBeNull();
    fireEvent.blur(screen.getByLabelText("¿Cuánto necesitas?"));

    expect(screen.getByText("El monto debe estar entre $500.000 y $20.000.000.")).toBeTruthy();
    expect(screen.queryByText("Escribe tu nombre completo.")).toBeNull(); // los demás no se tocaron
  });
});

describe("evaluación de la solicitud", () => {
  it("envía los datos en pesos y muestra la aprobación con su tasa", async () => {
    const fetchMock = simularApi({ historial: [json([]), json([aprobada])], post: [json(aprobada, 201)] });
    await renderizarListo();
    llenarFormulario();
    fireEvent.click(screen.getByRole("checkbox", { name: /Soy estudiante de la UCC/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Soy estudiante de la UCC/ }));
    evaluar();

    const resultado = await screen.findByRole("region", { name: "Resultado" });
    expect(await within(resultado).findByText("✓ Crédito aprobado")).toBeTruthy();
    expect(within(resultado).getByText("$3.000.000")).toBeTruthy();
    expect(within(resultado).getByText("1,5 % mensual")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/solicitudes", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        nombre: "Ana Pérez", email: "ana@example.com", edad: 22, score: 720,
        ingresos: 2_500_000, monto: 3_000_000, es_estudiante: true,
      }),
    }));
    expect(await screen.findByText("#17 · Laura Rojas")).toBeTruthy(); // historial actualizado
    expect((screen.getByLabelText("Nombre completo") as HTMLInputElement).value).toBe("  Ana Pérez  "); // conserva los datos
  });

  it("explica en pesos por qué se rechazó", async () => {
    simularApi({ post: [json(rechazada, 201)] });
    await renderizarListo();
    llenarFormulario();
    evaluar();

    expect(await screen.findByText("✕ Solicitud no aprobada")).toBeTruthy();
    expect(screen.getByText("Tus ingresos mensuales deben ser de al menos $1.500.000.")).toBeTruthy();
  });

  it("usa un texto general si el motivo de rechazo es desconocido", async () => {
    simularApi({ post: [json({ ...rechazada, motivo: "OTRO" }, 201)] });
    await renderizarListo();
    llenarFormulario();
    evaluar();
    expect(await screen.findByText("La solicitud no cumple los criterios de aprobación.")).toBeTruthy();
  });

  it("muestra la aprobación aunque la tasa venga vacía", async () => {
    simularApi({ post: [json({ ...aprobada, tasa_mensual: null }, 201)] });
    await renderizarListo();
    llenarFormulario();
    evaluar();
    const resultado = await screen.findByRole("region", { name: "Resultado" });
    expect(await within(resultado).findByText("—")).toBeTruthy();
  });

  it.each([
    ["400 con detalle de dominio", json({ detail: "Score fuera de rango financiero permitido (300-850)." }, 400),
      "Score fuera de rango financiero permitido (300-850)."],
    ["422 de FastAPI", json({ detail: [{ msg: "El correo no es válido" }, { otro: 1 }] }, 422), "El correo no es válido"],
    ["400 sin detalle", json({}, 400), "No pudimos procesar la solicitud. Inténtalo de nuevo."],
    ["400 con detalle desconocido", json({ detail: { code: "x" } }, 400), "Revisa los datos ingresados e inténtalo de nuevo."],
    ["201 con formato inesperado", json({ id: 1 }, 201), "La respuesta del servicio no tiene el formato esperado."],
  ])("traduce la respuesta %s a un mensaje claro", async (_caso, respuesta, mensaje) => {
    simularApi({ post: [respuesta] });
    await renderizarListo();
    llenarFormulario();
    evaluar();
    expect(await screen.findByText(mensaje)).toBeTruthy();
    expect(screen.getByText("Servicio disponible")).toBeTruthy();
  });

  it.each([
    ["la red falla", "sin-red" as const],
    ["el proxy responde 500 sin JSON", texto("Internal Server Error", 500)],
  ])("si %s explica que la API no está disponible", async (_caso, respuesta) => {
    simularApi({ post: [respuesta] });
    await renderizarListo();
    llenarFormulario();
    evaluar();

    expect(await screen.findByText(/No hay conexión con el servicio de evaluación. Verifica/)).toBeTruthy();
    expect(screen.getByText("Servicio no disponible")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});

describe("clientes recurrentes", () => {
  // Laura ya tiene la solicitud #17; vuelve con el mismo correo (en mayúsculas) y otros datos.
  const recurrente = { ...aprobada, id: 21, numero_cliente: 2, es_recurrente: true };
  const actualizada = { ...aprobada, monto: 5_000_000, version: 2, actualizado_en: "2026-01-16T09:00:00Z" };

  function llenarComoLaura() {
    llenarFormulario();
    escribir("Correo electrónico", "  LAURA@example.com ");
    escribir("¿Cuánto necesitas?", "5000000");
  }

  it("marca en el historial a los clientes nuevos, recurrentes y las solicitudes actualizadas", async () => {
    simularApi({ historial: [json([aprobada, recurrente, { ...rechazada, version: 3 }])] });
    await renderizarListo();
    const tabla = await screen.findByRole("table");

    expect(within(tabla).getAllByText("Cliente nuevo")).toHaveLength(2);
    expect(within(tabla).getByText("Recurrente · 2.ª solicitud")).toBeTruthy();
    expect(within(tabla).getByText("Actualizada · v3")).toBeTruthy();
  });

  it("si el correo ya existe pregunta antes de enviar y Cancelar no envía nada", async () => {
    const fetchMock = simularApi({ historial: [json([aprobada])] });
    await renderizarListo();
    await screen.findByText("#17 · Laura Rojas");
    llenarComoLaura();
    fetchMock.mockClear();

    evaluar();

    const dialogo = await screen.findByRole("dialog", { name: "Este cliente ya tiene solicitudes" });
    expect(within(dialogo).getByText(/tiene 1 solicitud\. La más reciente es la/)).toBeTruthy();
    expect(within(dialogo).getByText("#17")).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Escape también cierra el diálogo", async () => {
    simularApi({ historial: [json([aprobada, recurrente])] });
    await renderizarListo();
    await screen.findByText("#21 · Laura Rojas");
    llenarComoLaura();
    evaluar();

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/tiene 2 solicitudes/)).toBeTruthy();
    expect(within(dialogo).getByRole("button", { name: "Actualizar la solicitud #21" })).toBeTruthy(); // la más reciente
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Actualizar reevalúa la misma solicitud con PUT y muestra la nueva versión", async () => {
    const fetchMock = simularApi({ historial: [json([aprobada]), json([actualizada])], put: [json(actualizada)] });
    await renderizarListo();
    await screen.findByText("#17 · Laura Rojas");
    llenarComoLaura();
    evaluar();
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar la solicitud #17" }));

    const resultado = await screen.findByRole("region", { name: "Resultado" });
    expect(await within(resultado).findByText("2 (actualizada)")).toBeTruthy();
    expect(within(resultado).getByText("$5.000.000")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/solicitudes/17", expect.objectContaining({ method: "PUT" }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/v1/solicitudes", expect.objectContaining({ method: "POST" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Crear una nueva solicitud usa POST y la identifica como recurrente", async () => {
    const fetchMock = simularApi({ historial: [json([aprobada])], post: [json(recurrente, 201)] });
    await renderizarListo();
    await screen.findByText("#17 · Laura Rojas");
    llenarComoLaura();
    evaluar();
    fireEvent.click(await screen.findByRole("button", { name: "Crear una nueva solicitud" }));

    const resultado = await screen.findByRole("region", { name: "Resultado" });
    expect(await within(resultado).findByText("Recurrente · 2.ª solicitud")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/solicitudes", expect.objectContaining({ method: "POST" }));
  });

  it("explica el rechazo de una solicitud actualizada con su versión", async () => {
    simularApi({ historial: [json([aprobada])], put: [json({ ...rechazada, id: 17, version: 2 })] });
    await renderizarListo();
    await screen.findByText("#17 · Laura Rojas");
    llenarComoLaura();
    evaluar();
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar la solicitud #17" }));

    expect(await screen.findByText(/Solicitud #17 · Cliente nuevo · versión 2 \(actualizada\)/)).toBeTruthy();
  });

  it("muestra el error 409 si la API rechaza la actualización", async () => {
    simularApi({
      historial: [json([aprobada])],
      put: [json({ detail: "La solicitud #17 pertenece a otro correo; no se puede actualizar." }, 409)],
    });
    await renderizarListo();
    await screen.findByText("#17 · Laura Rojas");
    llenarComoLaura();
    evaluar();
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar la solicitud #17" }));

    expect(await screen.findByText("La solicitud #17 pertenece a otro correo; no se puede actualizar.")).toBeTruthy();
  });
});
