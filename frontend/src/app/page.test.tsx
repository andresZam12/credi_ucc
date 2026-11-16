import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const approvedApplication = {
  id: 17,
  nombre: "Laura Rojas",
  email: "laura@example.com",
  monto: 1500,
  decision: "APROBADO",
  motivo: "APROBADO",
  tasa_mensual: 1.2,
  notificado: true,
  creado_en: "2026-01-15T12:00:00Z",
};

const rejectedApplication = {
  ...approvedApplication,
  id: 18,
  decision: "RECHAZADO",
  motivo: "EDAD_FUERA_DE_RANGO",
  tasa_mensual: null,
  creado_en: "fecha-inválida",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fillApplicationForm() {
  fireEvent.change(screen.getByPlaceholderText("Ej. Laura Rojas"), { target: { value: "  Ana Pérez  " } });
  fireEvent.change(screen.getByPlaceholderText("nombre@correo.com"), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("22"), { target: { value: "22" } });
  fireEvent.change(screen.getByPlaceholderText("720"), { target: { value: "720" } });
  fireEvent.change(screen.getByPlaceholderText("2.500"), { target: { value: "3000" } });
  fireEvent.change(screen.getByPlaceholderText("1.500"), { target: { value: "1500" } });
}

async function submitApplication() {
  const button = screen.getByRole("button", { name: /Evaluar mi solicitud/ });
  const form = button.closest("form");
  if (!form) throw new Error("No se encontró el formulario de solicitud.");
  fireEvent.submit(form);
}

describe("CrediUCC home", () => {
  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra historial, métricas y estado cuando el servicio responde", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([approvedApplication, rejectedApplication]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse([approvedApplication, rejectedApplication]));

    render(<Home />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Solicitud #17")).toBeTruthy();
    expect(within(table).getByText("Solicitud #18")).toBeTruthy();
    expect(within(table).getByText("Aprobada")).toBeTruthy();
    expect(within(table).getByText("Rechazada")).toBeTruthy();
    expect(within(table).getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("Servicio activo")).toBeTruthy();

    const summary = screen.getByRole("region", { name: "Resumen de solicitudes" });
    expect(within(summary).getByText("2")).toBeTruthy();
    expect(within(summary).getByText("1")).toBeTruthy();
  });

  it("presenta un estado vacío cuando no hay solicitudes", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse({}));

    render(<Home />);

    expect(await screen.findByText("Aún no tienes solicitudes")).toBeTruthy();
    expect(screen.getByText("Servicio activo")).toBeTruthy();
  });

  it("envía la solicitud normalizada, muestra aprobación y actualiza historial", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(approvedApplication, 201))
      .mockResolvedValueOnce(jsonResponse([approvedApplication]));

    render(<Home />);
    await screen.findByText("Aún no tienes solicitudes");
    fillApplicationForm();
    await submitApplication();

    expect(await screen.findByText(/Tu solicitud #17 fue aprobada/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/solicitudes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          nombre: "Ana Pérez",
          email: "ana@example.com",
          edad: 22,
          score: 720,
          ingresos: 3000,
          monto: 1500,
          es_estudiante: true,
        }),
      }),
    );
    expect(await screen.findByText("Solicitud #17")).toBeTruthy();
  });

  it("explica el motivo de rechazo devuelto por la evaluación", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(rejectedApplication))
      .mockResolvedValueOnce(jsonResponse([rejectedApplication]));

    render(<Home />);
    await screen.findByText("Aún no tienes solicitudes");
    fillApplicationForm();
    await submitApplication();

    expect(await screen.findByText(/La edad debe estar entre 18 y 65 años/)).toBeTruthy();
  });

  it("muestra errores de validación devueltos por la API", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ detail: [{ msg: "El correo no es válido" }] }, 422));

    render(<Home />);
    await screen.findByText("Aún no tienes solicitudes");
    fillApplicationForm();
    await submitApplication();

    expect(await screen.findByText("El correo no es válido")).toBeTruthy();
  });

  it("muestra un mensaje general cuando la API no envía detalles del error", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}, 400));

    render(<Home />);
    await screen.findByText("Aún no tienes solicitudes");
    fillApplicationForm();
    await submitApplication();

    expect(await screen.findByText(/No pudimos procesar la solicitud/)).toBeTruthy();
  });

  it("usa una respuesta segura cuando el detalle del error tiene un formato desconocido", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ detail: { code: "invalid" } }, 400));

    render(<Home />);
    await screen.findByText("Aún no tienes solicitudes");
    fillApplicationForm();
    await submitApplication();

    expect(await screen.findByText(/Revisa los datos ingresados/)).toBeTruthy();
  });

  it("muestra el mensaje alternativo si el envío falla con un valor no estándar", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockRejectedValueOnce("error");

    render(<Home />);
    await screen.findByText("Aún no tienes solicitudes");
    fillApplicationForm();
    await submitApplication();

    expect(await screen.findByText(/No pudimos enviar tu solicitud/)).toBeTruthy();
  });

  it("permite recuperar el historial después de un error al cargar", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{}]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockRejectedValueOnce(new Error("Conexión interrumpida"))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<Home />);
    expect(await screen.findByText(/No pudimos cargar tus solicitudes/)).toBeTruthy();
    expect(screen.getByText("Sin conexión")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar solicitudes" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Actualizar solicitudes" }).hasAttribute("disabled")).toBe(false);
    });
    expect(screen.getByText(/No pudimos cargar tus solicitudes/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar solicitudes" }));
    await waitFor(() => {
      expect(screen.queryByText(/No pudimos cargar tus solicitudes/)).toBeNull();
    });
    expect(screen.getByText("Aún no tienes solicitudes")).toBeTruthy();
  });

  it("rechaza respuestas de historial con formato inválido", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse({}));

    render(<Home />);

    expect(await screen.findByText(/No pudimos cargar tus solicitudes/)).toBeTruthy();
    expect(screen.getByText("Sin conexión")).toBeTruthy();
  });
});
