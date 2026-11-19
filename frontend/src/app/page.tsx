"use client";

import {
  useCallback, useEffect, useRef, useState, useSyncExternalStore,
  type ChangeEvent, type FocusEvent, type ReactNode, type SubmitEvent,
} from "react";
import {
  CAMPOS_VACIOS,
  LIMITES,
  ORDEN_CAMPOS,
  REQUISITOS,
  TASAS,
  aSolicitud,
  agruparMiles,
  formatearPesos,
  soloDigitos,
  validar,
  type CampoTexto,
  type Campos,
} from "../lib/credito";

type Application = {
  id: number;
  nombre: string;
  email: string;
  monto: number;
  decision: "APROBADO" | "RECHAZADO";
  motivo: string;
  tasa_mensual: number | null;
  notificado: boolean;
  creado_en: string;
  numero_cliente: number;
  es_recurrente: boolean;
  version: number;
  actualizado_en: string | null;
};

type EstadoServicio = "conectando" | "activo" | "caido";

const MENSAJE_SIN_SERVICIO =
  "No hay conexión con el servicio de evaluación. Verifica que la API esté encendida e inténtalo de nuevo.";

/** Máximo de dígitos por campo numérico (evita números absurdos al escribir). */
const MAX_DIGITOS: Partial<Record<CampoTexto, number>> = { edad: 3, score: 3, ingresos: 10, monto: 8 };

const MOTIVOS_RECHAZO: Record<string, string> = {
  EDAD_FUERA_DE_RANGO: `Debes tener entre ${REQUISITOS.edadMin} y ${REQUISITOS.edadMax} años.`,
  SCORE_INSUFICIENTE: `Tu score crediticio debe ser de al menos ${REQUISITOS.scoreMin} puntos.`,
  INGRESOS_INSUFICIENTES: `Tus ingresos mensuales deben ser de al menos ${formatearPesos(REQUISITOS.ingresosMin)}.`,
};

const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

function formatearTasa(tasa: number): string {
  return `${tasa.toLocaleString("es-CO")} % mensual`;
}

function isApplication(value: unknown): value is Application {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "number" &&
    typeof record.nombre === "string" &&
    typeof record.email === "string" &&
    typeof record.monto === "number" &&
    (record.decision === "APROBADO" || record.decision === "RECHAZADO") &&
    typeof record.motivo === "string" &&
    (typeof record.tasa_mensual === "number" || record.tasa_mensual === null) &&
    typeof record.notificado === "boolean" &&
    typeof record.creado_en === "string" &&
    typeof record.numero_cliente === "number" &&
    typeof record.es_recurrente === "boolean" &&
    typeof record.version === "number" &&
    (typeof record.actualizado_en === "string" || record.actualizado_en === null)
  );
}

// ------------------------------------------------------------- clientes recurrentes
/** El correo identifica al cliente, sin importar mayúsculas ni espacios (igual que en el backend). */
function claveCliente(email: string): string {
  return email.trim().toLowerCase();
}

function solicitudesDelCliente(historial: Application[], email: string): Application[] {
  const clave = claveCliente(email);
  return historial.filter((s) => claveCliente(s.email) === clave);
}

function etiquetaCliente(s: Application): string {
  return s.es_recurrente ? `Recurrente · ${s.numero_cliente}.ª solicitud` : "Cliente nuevo";
}

function detalleSolicitud(s: Application): string {
  const partes = [etiquetaCliente(s)];
  if (s.version > 1) partes.push(`versión ${s.version} (actualizada)`);
  return partes.join(" · ");
}

/** Traduce el cuerpo de error de la API (400 de dominio o 422 de FastAPI) a un mensaje legible. */
function mensajeDeError(body: unknown): string {
  if (typeof body !== "object" || body === null || !("detail" in body)) {
    return "No pudimos procesar la solicitud. Inténtalo de nuevo.";
  }
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === "object" && item !== null && "msg" in item ? item.msg : ""))
      .filter((message): message is string => typeof message === "string")
      .join(" ");
  }
  return "Revisa los datos ingresados e inténtalo de nuevo.";
}

/** Si el servidor responde algo que no es JSON (p. ej. "Internal Server Error"), devuelve null. */
async function leerJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function pedirHistorial(): Promise<Application[]> {
  const response = await fetch("/api/v1/solicitudes", { cache: "no-store" });
  if (!response.ok) throw new Error("historial no disponible");
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isApplication)) throw new Error("formato inesperado");
  return data;
}

const sinSuscripcion = () => () => {};

/**
 * false en el HTML que envía el servidor y true cuando el JavaScript ya tomó control de la página.
 * Sin JavaScript, un formulario HTML se envía "a la antigua": recarga la página y borra lo escrito.
 * Mientras esto sea false, el botón queda deshabilitado y dice "Cargando…".
 */
function useInteractivo(): boolean {
  return useSyncExternalStore(sinSuscripcion, () => true, () => false);
}

function textoBotonEvaluar(interactivo: boolean, enviando: boolean): string {
  if (!interactivo) return "Cargando…";
  return enviando ? "Evaluando…" : "Evaluar solicitud";
}

// ------------------------------------------------------------------------------- iconos y logo
type NombreIcono = "usuario" | "resultado" | "lista" | "dinero" | "check" | "cruz" | "rayo" | "escudo" | "historial" | "estudiante";

const TRAZOS: Record<NombreIcono, ReactNode> = {
  usuario: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  resultado: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  lista: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" /></>,
  dinero: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9.5v5M18 9.5v5" /></>,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  cruz: <path d="M6 6l12 12M18 6 6 18" />,
  rayo: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  escudo: <><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  historial: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4v4.5H8M12 8v4.5l3 2" /></>,
  estudiante: <><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" /><path d="M6.5 11v4.5c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2V11M21.5 9v5" /></>,
};

function Icono({ nombre, className = "h-5 w-5" }: Readonly<{ nombre: NombreIcono; className?: string }>) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round"
      strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {TRAZOS[nombre]}
    </svg>
  );
}

/** Logo CrediUCC: un brote que crece desde una moneda (el crédito como impulso para crecer). */
function Logo({ className = "h-11 w-11" }: Readonly<{ className?: string }>) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 48 48">
      <rect fill="#faf4e8" height="48" rx="12" width="48" />
      <circle cx="24" cy="34" fill="#c9a35a" r="8" />
      <circle cx="24" cy="34" fill="none" r="5.2" stroke="#f3dfae" strokeWidth="1.4" />
      <path d="M24 30V16" stroke="#2f6b3f" strokeLinecap="round" strokeWidth="2.6" />
      <path d="M24 21c0-5.2 3.8-8.4 9.4-8.4 0 5.2-3.8 8.4-9.4 8.4Z" fill="#2f6b3f" />
      <path d="M24 25.5c0-4.4-3.2-7.2-8-7.2 0 4.4 3.2 7.2 8 7.2Z" fill="#5f9a62" />
    </svg>
  );
}

// ------------------------------------------------------------------ componentes de presentación
function IndicadorServicio({ estado }: Readonly<{ estado: EstadoServicio }>) {
  const estilos: Record<EstadoServicio, { punto: string; texto: string }> = {
    conectando: { punto: "bg-oro animate-pulse", texto: "Conectando…" },
    activo: { punto: "bg-[#7fd18f]", texto: "Servicio disponible" },
    caido: { punto: "bg-[#ff8a75]", texto: "Servicio no disponible" },
  };
  const { punto, texto } = estilos[estado];
  return (
    <span aria-live="polite" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${punto}`} />
      {texto}
    </span>
  );
}

function Tarjeta({ titulo, icono, children, className = "" }: Readonly<{
  titulo: string; icono: NombreIcono; children: ReactNode; className?: string;
}>) {
  return (
    <section aria-label={titulo} className={`rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cafe-soft text-cafe">
          <Icono nombre={icono} />
        </span>
        <h2 className="text-lg font-bold text-cafe">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

type PropsCampo = Readonly<{
  campo: CampoTexto;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  valor: string;
  prefijo?: string;
  sufijo?: string;
  numerico?: boolean;
  tipo?: "text" | "email";
  autoComplete?: string;
  placeholder?: string;
  className?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
}>;

function CampoFormulario({
  campo, etiqueta, ayuda, error, valor, prefijo, sufijo, numerico = false, tipo = "text",
  autoComplete, placeholder, className = "", onChange, onBlur,
}: PropsCampo) {
  const idMensaje = `${campo}-mensaje`;
  const borde = error
    ? "border-danger bg-danger-soft/40 ring-2 ring-danger/15"
    : "border-line bg-cream focus-within:border-brand focus-within:bg-surface focus-within:ring-4 focus-within:ring-brand/15";
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="text-sm font-semibold text-ink" htmlFor={campo}>{etiqueta}</label>
      <div className={`flex h-12 items-center gap-2 rounded-xl border px-3.5 transition ${borde}`}>
        {prefijo && <span aria-hidden="true" className="text-base font-bold text-cafe">{prefijo}</span>}
        <input
          aria-describedby={error || ayuda ? idMensaje : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className="h-full w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted/60"
          id={campo}
          inputMode={numerico ? "numeric" : undefined}
          name={campo}
          onBlur={onBlur}
          onChange={onChange}
          placeholder={placeholder}
          type={tipo}
          value={valor}
        />
        {sufijo && <span aria-hidden="true" className="shrink-0 rounded-md bg-cafe-soft px-2 py-0.5 text-xs font-semibold text-cafe">{sufijo}</span>}
      </div>
      {error && <p className="text-sm font-medium text-danger" id={idMensaje}>{error}</p>}
      {!error && ayuda && <p className="text-sm text-muted" id={idMensaje}>{ayuda}</p>}
    </div>
  );
}

function Fila({ etiqueta, valor }: Readonly<{ etiqueta: string; valor: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line/80 py-2.5 first:border-t-0">
      <dt className="text-sm text-muted">{etiqueta}</dt>
      <dd className="m-0 text-right text-base font-semibold text-ink">{valor}</dd>
    </div>
  );
}

function PanelResultado({ resultado }: Readonly<{ resultado: Application | null }>) {
  if (!resultado) {
    return (
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-dashed border-line bg-cream p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <Icono className="h-6 w-6" nombre="rayo" />
        </span>
        <p className="text-base text-muted">
          Completa el formulario y pulsa <strong className="text-ink">Evaluar solicitud</strong>. El resultado aparecerá aquí.
        </p>
      </div>
    );
  }
  if (resultado.decision === "APROBADO") {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-ok/25 bg-ok-soft">
        <div className="flex items-center gap-3 bg-linear-to-r from-brand to-brand-dark px-4 py-3 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-cream text-brand"><Icono nombre="check" /></span>
          <p className="text-xl font-bold">✓ Crédito aprobado</p>
        </div>
        <dl className="px-4 py-2">
          <Fila etiqueta="Solicitud" valor={`#${resultado.id}`} />
          <Fila etiqueta="Cliente" valor={etiquetaCliente(resultado)} />
          {resultado.version > 1 && <Fila etiqueta="Versión" valor={`${resultado.version} (actualizada)`} />}
          <Fila etiqueta="Monto" valor={formatearPesos(resultado.monto)} />
          <Fila etiqueta="Tasa" valor={resultado.tasa_mensual == null ? "—" : formatearTasa(resultado.tasa_mensual)} />
        </dl>
      </div>
    );
  }
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-danger/25 bg-danger-soft">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger text-white"><Icono nombre="cruz" /></span>
        <p className="text-xl font-bold text-danger">✕ Solicitud no aprobada</p>
      </div>
      <p className="px-4 pt-3 text-base text-ink">{MOTIVOS_RECHAZO[resultado.motivo] ?? "La solicitud no cumple los criterios de aprobación."}</p>
      <p className="px-4 pb-4 pt-2 text-sm text-muted">
        Solicitud #{resultado.id} · {detalleSolicitud(resultado)}. Puedes ajustar los datos y evaluar de nuevo.
      </p>
    </div>
  );
}

function Requisitos() {
  const tasas = [
    { etiqueta: `Estudiante con score ≥ ${TASAS.scorePreferencial}`, tasa: TASAS.preferencial, destacada: true },
    { etiqueta: "Estudiante", tasa: TASAS.estudiante, destacada: false },
    { etiqueta: "No estudiante", tasa: TASAS.general, destacada: false },
  ];
  return (
    <Tarjeta icono="lista" titulo="Requisitos para aprobar">
      <dl className="mt-3">
        <Fila etiqueta="Edad" valor={`${REQUISITOS.edadMin} a ${REQUISITOS.edadMax} años`} />
        <Fila etiqueta="Score crediticio" valor={`${REQUISITOS.scoreMin} puntos o más`} />
        <Fila etiqueta="Ingresos mensuales" valor={`${formatearPesos(REQUISITOS.ingresosMin)} o más`} />
        <Fila etiqueta="Monto" valor={`${formatearPesos(LIMITES.monto.min)} a ${formatearPesos(LIMITES.monto.max)}`} />
      </dl>
      <h3 className="mt-5 text-base font-bold text-cafe">Tasa si se aprueba</h3>
      <dl className="mt-2 grid gap-2">
        {tasas.map(({ etiqueta, tasa, destacada }) => (
          <div className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 ${destacada ? "bg-brand text-white" : "bg-cream text-ink"}`} key={etiqueta}>
            <dt className={`text-sm ${destacada ? "text-white" : "text-muted"}`}>{etiqueta}</dt>
            <dd className="m-0 text-base font-bold">{formatearTasa(tasa)}</dd>
          </div>
        ))}
      </dl>
    </Tarjeta>
  );
}

function Resumen({ solicitudes }: Readonly<{ solicitudes: Application[] }>) {
  const aprobadas = solicitudes.filter((s) => s.decision === "APROBADO");
  const montoAprobado = aprobadas.reduce((total, s) => total + s.monto, 0);
  const datos: { etiqueta: string; valor: string; icono: NombreIcono; color: string }[] = [
    { etiqueta: "Solicitudes evaluadas", valor: String(solicitudes.length), icono: "historial", color: "bg-cafe-soft text-cafe" },
    { etiqueta: "Aprobadas", valor: String(aprobadas.length), icono: "check", color: "bg-brand-soft text-brand" },
    { etiqueta: "Monto aprobado", valor: formatearPesos(montoAprobado), icono: "dinero", color: "bg-[#f6ead0] text-[#8a6420]" },
  ];
  return (
    <section aria-label="Resumen de solicitudes" className="mt-6 grid gap-4 sm:grid-cols-3">
      {datos.map(({ etiqueta, valor, icono, color }) => (
        <article className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card" key={etiqueta}>
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${color}`}><Icono className="h-6 w-6" nombre={icono} /></span>
          <div className="min-w-0">
            <p className="text-sm text-muted">{etiqueta}</p>
            <p className="truncate text-2xl font-extrabold text-ink">{valor}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function Insignias({ solicitud }: Readonly<{ solicitud: Application }>) {
  const color = solicitud.es_recurrente ? "bg-[#f1dca8] text-[#5f3f00]" : "bg-cafe-soft text-cafe";
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{etiquetaCliente(solicitud)}</span>
      {solicitud.version > 1 && (
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">
          Actualizada · v{solicitud.version}
        </span>
      )}
    </span>
  );
}

function DialogoClienteExistente({ ultima, total, onActualizar, onNueva, onCancelar }: Readonly<{
  ultima: Application; total: number; onActualizar: () => void; onNueva: () => void; onCancelar: () => void;
}>) {
  const estado = ultima.decision === "APROBADO" ? "aprobada" : "rechazada";
  const cantidad = total === 1 ? "1 solicitud" : `${total} solicitudes`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm">
      <div aria-describedby="dialogo-texto" aria-labelledby="dialogo-titulo" aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-oro/40 bg-surface p-6 shadow-card" role="dialog">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f1dca8] text-[#5f3f00]">
            <Icono nombre="historial" />
          </span>
          <h2 className="text-xl font-bold text-cafe" id="dialogo-titulo">Este cliente ya tiene solicitudes</h2>
        </div>
        <div className="mt-3 grid gap-2 text-base text-ink" id="dialogo-texto">
          <p>
            <strong>{ultima.email}</strong> tiene {cantidad}. La más reciente es la <strong>#{ultima.id}</strong>{" "}
            ({estado}, {formatearPesos(ultima.monto)}).
          </p>
          <p className="text-muted">¿Quieres actualizar esa solicitud con los datos nuevos o registrar una solicitud nueva?</p>
        </div>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <button
            autoFocus
            className="rounded-xl bg-linear-to-r from-brand to-brand-dark px-4 py-3 text-base font-semibold text-white shadow-boton transition hover:brightness-110"
            onClick={onActualizar}
            type="button"
          >
            Actualizar la solicitud #{ultima.id}
          </button>
          <button
            className="rounded-xl border border-cafe/40 bg-cafe-soft px-4 py-3 text-base font-semibold text-cafe transition hover:brightness-95"
            onClick={onNueva}
            type="button"
          >
            Crear una nueva solicitud
          </button>
          <button
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted underline-offset-4 transition hover:underline sm:col-span-2"
            onClick={onCancelar}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function Historial({ solicitudes, cargando, error, actualizando, onActualizar }: Readonly<{
  solicitudes: Application[]; cargando: boolean; error: string; actualizando: boolean; onActualizar: () => void;
}>) {
  return (
    <section aria-label="Historial de solicitudes" className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cafe-soft text-cafe"><Icono nombre="historial" /></span>
          <h2 className="text-lg font-bold text-cafe">Historial de solicitudes</h2>
        </div>
        <button
          className="rounded-xl border border-line bg-cream px-4 py-2 text-sm font-semibold text-cafe transition hover:border-cafe/50 hover:bg-cafe-soft disabled:opacity-50"
          disabled={actualizando}
          onClick={onActualizar}
          type="button"
        >
          {actualizando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {cargando && <p className="mt-4 text-base text-muted">Cargando solicitudes…</p>}
      {!cargando && error && <p className="mt-4 rounded-xl bg-danger-soft p-3 text-base text-danger" role="alert">{error}</p>}
      {!cargando && !error && solicitudes.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-cream p-4 text-base text-muted">
          Todavía no hay solicitudes. Las que evalúes aparecerán aquí.
        </p>
      )}

      {solicitudes.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-cream text-cafe">
              <tr>
                <th className="px-4 py-3 font-semibold">Solicitud</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
                <th className="px-4 py-3 font-semibold">Resultado</th>
                <th className="px-4 py-3 text-right font-semibold">Tasa mensual</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => {
                const aprobada = s.decision === "APROBADO";
                const fecha = new Date(s.creado_en);
                return (
                  <tr className="border-t border-line transition hover:bg-cream/60" key={s.id}>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-ink">#{s.id} · {s.nombre}</span>
                      <span className="block text-muted">{s.email}</span>
                      <Insignias solicitud={s} />
                    </td>
                    <td className="px-4 py-3 text-ink">{Number.isNaN(fecha.getTime()) ? "—" : fechaHora.format(fecha)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{formatearPesos(s.monto)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${aprobada ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                        {aprobada ? "Aprobada" : "Rechazada"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink">
                      {s.tasa_mensual == null ? "—" : `${s.tasa_mensual.toLocaleString("es-CO")} %`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Bienvenida() {
  const beneficios: { texto: string; icono: NombreIcono }[] = [
    { texto: "Respuesta inmediata", icono: "rayo" },
    { texto: `Tasas desde ${formatearTasa(TASAS.preferencial)}`, icono: "estudiante" },
    { texto: "Sin compromiso", icono: "escudo" },
  ];
  return (
    <section className="relative overflow-hidden rounded-3xl border border-oro/30 bg-linear-to-br from-brand via-brand-dark to-[#3b2a17] p-6 shadow-card sm:p-8">
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-oro/15" />
      <div aria-hidden="true" className="absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-[#fbf3e4]/10" />
      <div className="relative">
        <p className="text-sm font-bold uppercase tracking-wider text-oro">Microcrédito estudiantil</p>
        <h1 className="mt-1 text-3xl font-extrabold text-white sm:text-4xl">Simula tu crédito</h1>
        <p className="mt-2 max-w-2xl text-base text-white/90 sm:text-lg">
          Ingresa tus datos y te diremos al instante si tu solicitud se aprueba y con qué tasa. Los valores están en pesos colombianos (COP).
        </p>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {beneficios.map(({ texto, icono }) => (
            <li className="inline-flex items-center gap-2 rounded-full bg-[#fbf3e4] px-3.5 py-2 text-sm font-semibold text-brand-dark shadow-card" key={texto}>
              <Icono className="h-4 w-4 text-brand" nombre={icono} /> {texto}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------------- página
export default function Home() {
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  const [tocados, setTocados] = useState<Partial<Record<CampoTexto, boolean>>>({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [resultado, setResultado] = useState<Application | null>(null);

  const [servicio, setServicio] = useState<EstadoServicio>("conectando");
  const [reintentando, setReintentando] = useState(false);

  const [historial, setHistorial] = useState<Application[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState("");
  const [actualizando, setActualizando] = useState(false);

  const [confirmacion, setConfirmacion] = useState<{ ultima: Application; total: number } | null>(null);

  useEffect(() => {
    if (!confirmacion) return;
    const alPresionar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmacion(null);
    };
    globalThis.addEventListener("keydown", alPresionar);
    return () => globalThis.removeEventListener("keydown", alPresionar);
  }, [confirmacion]);

  const panelResultado = useRef<HTMLDivElement>(null);
  const interactivo = useInteractivo();
  const errores = validar(campos);

  const verificarServicio = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/health", { cache: "no-store" });
      setServicio(response.ok ? "activo" : "caido");
      return response.ok;
    } catch {
      setServicio("caido");
      return false;
    }
  }, []);

  const cargarHistorial = useCallback(async () => {
    try {
      setHistorial(await pedirHistorial());
      setErrorHistorial("");
    } catch {
      setErrorHistorial("No pudimos cargar el historial de solicitudes.");
    }
  }, []);

  useEffect(() => {
    let activo = true;
    async function iniciar() {
      const disponible = await verificarServicio();
      if (disponible && activo) await cargarHistorial();
      if (activo) setCargandoHistorial(false);
    }
    void iniciar();
    return () => {
      activo = false;
    };
  }, [verificarServicio, cargarHistorial]);

  function alCambiar(event: ChangeEvent<HTMLInputElement>) {
    const campo = event.target.name as CampoTexto;
    const maximo = MAX_DIGITOS[campo];
    const valor = maximo === undefined ? event.target.value : soloDigitos(event.target.value, maximo);
    setCampos((previos) => ({ ...previos, [campo]: valor }));
  }

  function alSalir(event: FocusEvent<HTMLInputElement>) {
    const campo = event.target.name as CampoTexto;
    setTocados((previos) => ({ ...previos, [campo]: true }));
  }

  function errorVisible(campo: CampoTexto): string | undefined {
    return intentoEnvio || tocados[campo] ? errores[campo] : undefined;
  }

  async function enviar(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIntentoEnvio(true);
    const primeroConError = ORDEN_CAMPOS.find((campo) => errores[campo]);
    if (primeroConError) {
      document.getElementById(primeroConError)?.focus();
      return;
    }

    // Cliente recurrente: se pregunta si actualizar su última solicitud o crear una nueva.
    const delCliente = solicitudesDelCliente(historial, campos.email);
    if (delCliente.length > 0) {
      setConfirmacion({ ultima: delCliente.at(-1) as Application, total: delCliente.length });
      return;
    }
    await enviarSolicitud(null);
  }

  /** idActualizar = null crea una solicitud nueva (POST); con un id, la reevalúa (PUT). */
  async function enviarSolicitud(idActualizar: number | null) {
    setConfirmacion(null);
    setEnviando(true);
    setErrorEnvio("");
    const url = idActualizar === null ? "/api/v1/solicitudes" : `/api/v1/solicitudes/${idActualizar}`;
    try {
      let response: Response;
      try {
        response = await fetch(url, {
          method: idActualizar === null ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aSolicitud(campos)),
        });
      } catch {
        setServicio("caido");
        throw new Error(MENSAJE_SIN_SERVICIO);
      }
      const body = await leerJson(response);
      if (response.status >= 500 || body === null) {
        setServicio("caido");
        throw new Error(MENSAJE_SIN_SERVICIO);
      }
      if (!response.ok) throw new Error(mensajeDeError(body));
      if (!isApplication(body)) throw new Error("La respuesta del servicio no tiene el formato esperado.");

      setServicio("activo");
      setResultado(body);
      panelResultado.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      await cargarHistorial();
    } catch (error) {
      setErrorEnvio(error instanceof Error ? error.message : MENSAJE_SIN_SERVICIO);
    } finally {
      setEnviando(false);
    }
  }

  async function reintentar() {
    setReintentando(true);
    if (await verificarServicio()) {
      setErrorEnvio("");
      await cargarHistorial();
    }
    setReintentando(false);
  }

  async function actualizarHistorial() {
    setActualizando(true);
    await cargarHistorial();
    setActualizando(false);
  }

  const propsComunes = { onChange: alCambiar, onBlur: alSalir };

  return (
    <div className="min-h-screen">
      <header className="border-b border-oro/40 bg-[#0d2015]/90 shadow-card backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-white">
                Credi<span className="text-oro">UCC</span>
              </p>
              <p className="text-sm text-white/85">Simulador de microcrédito estudiantil</p>
            </div>
          </div>
          <IndicadorServicio estado={servicio} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {servicio === "caido" && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 shadow-card" role="alert">
            <div className="max-w-2xl">
              <p className="text-base font-bold text-warn">No hay conexión con el servicio de evaluación</p>
              <p className="mt-1 text-sm text-ink">
                Las solicitudes no se pueden evaluar mientras la API esté apagada. Si estás probando en tu equipo, iníciala con{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 text-[0.85em]">python -m uvicorn app.main:app --port 8000</code>.
              </p>
            </div>
            <button
              className="rounded-xl bg-cafe px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:brightness-110 disabled:opacity-60"
              disabled={reintentando}
              onClick={reintentar}
              type="button"
            >
              {reintentando ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        )}

        <Bienvenida />
        <Resumen solicitudes={historial} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Tarjeta icono="usuario" titulo="Tus datos">
            <form className="mt-5 grid gap-5 sm:grid-cols-2" noValidate onSubmit={enviar}>
              <CampoFormulario {...propsComunes} autoComplete="name" campo="nombre" className="sm:col-span-2"
                error={errorVisible("nombre")} etiqueta="Nombre completo" placeholder="Laura Rojas" valor={campos.nombre} />
              <CampoFormulario {...propsComunes} autoComplete="email" campo="email" className="sm:col-span-2"
                error={errorVisible("email")} etiqueta="Correo electrónico" placeholder="nombre@correo.com" tipo="email" valor={campos.email} />
              <CampoFormulario {...propsComunes} ayuda="Para aprobar: entre 18 y 65 años." campo="edad" error={errorVisible("edad")}
                etiqueta="Edad" numerico placeholder="22" sufijo="años" valor={campos.edad} />
              <CampoFormulario {...propsComunes} ayuda="De 300 a 850. Para aprobar: 600 o más." campo="score" error={errorVisible("score")}
                etiqueta="Score crediticio" numerico placeholder="720" sufijo="puntos" valor={campos.score} />
              <CampoFormulario {...propsComunes} ayuda={`Para aprobar: ${formatearPesos(REQUISITOS.ingresosMin)} o más.`} campo="ingresos"
                error={errorVisible("ingresos")} etiqueta="Ingresos mensuales" numerico placeholder="2.500.000" prefijo="$" sufijo="COP"
                valor={agruparMiles(campos.ingresos)} />
              <CampoFormulario {...propsComunes} ayuda={`Entre ${formatearPesos(LIMITES.monto.min)} y ${formatearPesos(LIMITES.monto.max)}.`}
                campo="monto" error={errorVisible("monto")} etiqueta="¿Cuánto necesitas?" numerico placeholder="3.000.000" prefijo="$"
                sufijo="COP" valor={agruparMiles(campos.monto)} />

              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition sm:col-span-2 ${campos.esEstudiante ? "border-brand/40 bg-brand-soft" : "border-line bg-cream"}`}>
                <input
                  checked={campos.esEstudiante}
                  className="h-5 w-5 accent-brand"
                  name="esEstudiante"
                  onChange={(event) => setCampos((previos) => ({ ...previos, esEstudiante: event.target.checked }))}
                  type="checkbox"
                />
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-brand"><Icono nombre="estudiante" /></span>
                <span>
                  <span className="block text-base font-semibold text-ink">Soy estudiante de la UCC</span>
                  <span className="block text-sm text-muted">Los estudiantes acceden a una tasa más baja.</span>
                </span>
              </label>

              {intentoEnvio && Object.keys(errores).length > 0 && (
                <p className="text-sm font-medium text-danger sm:col-span-2" role="alert">
                  Revisa los campos marcados en rojo antes de continuar.
                </p>
              )}
              {errorEnvio && (
                <p className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger sm:col-span-2" role="alert">
                  {errorEnvio}
                </p>
              )}

              <button
                className="h-12 rounded-xl bg-linear-to-r from-brand to-brand-dark px-7 text-base font-semibold text-white shadow-boton transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
                disabled={!interactivo || enviando}
                type="submit"
              >
                {textoBotonEvaluar(interactivo, enviando)}
              </button>
            </form>
          </Tarjeta>

          <div className="grid gap-6">
            <div aria-live="polite" ref={panelResultado}>
              <Tarjeta icono="resultado" titulo="Resultado">
                <PanelResultado resultado={resultado} />
              </Tarjeta>
            </div>
            <Requisitos />
          </div>
        </div>

        {confirmacion && (
          <DialogoClienteExistente
            onActualizar={() => void enviarSolicitud(confirmacion.ultima.id)}
            onCancelar={() => setConfirmacion(null)}
            onNueva={() => void enviarSolicitud(null)}
            total={confirmacion.total}
            ultima={confirmacion.ultima}
          />
        )}

        <Historial
          actualizando={actualizando}
          cargando={cargandoHistorial}
          error={errorHistorial}
          onActualizar={actualizarHistorial}
          solicitudes={historial}
        />
      </main>

      <footer className="mt-4 border-t border-oro/25">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-5 text-sm text-white/80 sm:px-6">
          <Logo className="h-7 w-7" />
          <span><strong className="text-oro">CrediUCC</strong> · Proyecto de Pruebas y Mantenimiento de Software</span>
        </div>
      </footer>
    </div>
  );
}
