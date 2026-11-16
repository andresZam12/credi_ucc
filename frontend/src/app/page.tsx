"use client";

import { useCallback, useEffect, useState, type SubmitEvent, type ReactNode } from "react";

type IconName = "grid" | "plus" | "file" | "user" | "mail" | "check" | "money" | "arrow" | "sparkle" | "refresh" | "lock" | "clock";

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
};

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
    typeof record.creado_en === "string"
  );
}

const iconContent: Record<IconName, ReactNode> = {
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="4" rx="1.5" /><rect x="13.5" y="10.5" width="7" height="10" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></>,
  file: <><path d="M7 3.8h7l4 4V20a1.2 1.2 0 0 1-1.2 1.2H7A1.2 1.2 0 0 1 5.8 20V5A1.2 1.2 0 0 1 7 3.8Z" /><path d="M14 4v4h4M9 13h6M9 16.5h6" /></>,
  user: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7 7.5 5.5L19.5 7" /></>,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  money: <path d="M12 3.5v17M16.5 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  sparkle: <><path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

function Icon({ name, className = "" }: Readonly<{ name: IconName; className?: string }>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {iconContent[name]}
    </svg>
  );
}

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const rejectionReasons: Record<string, string> = {
  EDAD_FUERA_DE_RANGO: "La edad debe estar entre 18 y 65 años.",
  SCORE_INSUFICIENTE: "El score mínimo requerido es 600.",
  INGRESOS_INSUFICIENTES: "Los ingresos mensuales no alcanzan el mínimo requerido.",
};

function errorMessage(body: unknown) {
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

type Feedback = { message: string; tone: "success" | "error" };

function formText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function feedbackFor(result: Application): Feedback {
  if (result.decision === "APROBADO") {
    const rate = result.tasa_mensual == null ? "" : ` Tasa mensual: ${result.tasa_mensual}%.`;
    return { message: `¡Listo, ${result.nombre}! Tu solicitud #${result.id} fue aprobada.${rate}`, tone: "success" };
  }
  const reason = rejectionReasons[result.motivo] ?? "No cumple los criterios de aprobación.";
  return { message: `Solicitud #${result.id}: ${reason}`, tone: "error" };
}

function serviceStatus(serviceOnline: boolean | null): { dot: string; label: string } {
  if (serviceOnline === null) return { dot: "animate-pulse bg-[#d1b76a]", label: "Conectando..." };
  if (serviceOnline) return { dot: "bg-[#71b584]", label: "Servicio activo" };
  return { dot: "bg-[#db796a]", label: "Sin conexión" };
}

function HistoryStatus({ isLoading, error, isEmpty }: Readonly<{ isLoading: boolean; error: string; isEmpty: boolean }>) {
  if (isLoading) {
    return <p className="py-8 text-center text-[10px] text-[#89948d]">Cargando tus solicitudes...</p>;
  }
  if (error) {
    return <output className="block py-7 text-center text-[10px] text-[#a95948]">{error}</output>;
  }
  if (!isEmpty) return null;
  return (
    <div className="grid justify-items-center px-3 py-7 text-center">
      <span className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-[#f0f5ef] text-[#7a9a7b]"><Icon className="h-5 w-5" name="file" /></span>
      <strong className="font-display text-[11px] text-[#58675d]">Aún no tienes solicitudes</strong>
      <span className="mt-1 text-[9px] text-[#9ca69e]">Cuando envíes una, podrás consultar aquí su estado.</span>
      <a className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-[#477553]" href="#nueva-solicitud">Crear mi primera solicitud <Icon className="h-3 w-3" name="arrow" /></a>
    </div>
  );
}

async function requestApplications(): Promise<Application[]> {
  const response = await fetch("/api/v1/solicitudes", { cache: "no-store" });
  if (!response.ok) throw new Error("No pudimos cargar tus solicitudes.");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("La respuesta del servicio no tiene el formato esperado.");
  const records = data.filter(isApplication);
  if (records.length !== data.length) throw new Error("La respuesta del servicio no tiene el formato esperado.");
  return records;
}

export default function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadApplications = useCallback(async () => {
    setApplications(await requestApplications());
    setHistoryError("");
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const [records, health] = await Promise.all([
          requestApplications(),
          fetch("/health", { cache: "no-store" }),
        ]);
        if (!active) return;
        setApplications(records);
        setServiceOnline(health.ok);
      } catch {
        if (active) {
          setHistoryError("No pudimos cargar tus solicitudes. Verifica tu conexión e inténtalo de nuevo.");
          setServiceOnline(false);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const payload = {
      nombre: formText(formData, "nombre"),
      email: formText(formData, "email"),
      edad: Number(formData.get("edad")),
      score: Number(formData.get("score")),
      ingresos: Number(formData.get("ingresos")),
      monto: Number(formData.get("monto")),
      es_estudiante: formData.has("es_estudiante"),
    };

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/v1/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(body));
      if (!isApplication(body)) throw new Error("La respuesta del servicio no tiene el formato esperado.");

      setFeedback(feedbackFor(body));

      form.reset();
      await loadApplications();
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "No pudimos enviar tu solicitud. Inténtalo de nuevo.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadApplications();
    } catch {
      setHistoryError("No pudimos cargar tus solicitudes. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setIsRefreshing(false);
    }
  }

  const approvedCount = applications.filter((application) => application.decision === "APROBADO").length;
  const requestedAmount = applications.reduce((sum, application) => sum + Number(application.monto), 0);
  const status = serviceStatus(serviceOnline);

  return (
    <div className="min-h-screen md:flex">
      <aside className="z-30 flex h-[68px] items-center justify-between bg-[#193b32] px-4 text-white md:fixed md:inset-y-0 md:left-0 md:h-screen md:w-64 md:flex-col md:items-stretch md:px-[18px] md:py-7">
        <a aria-label="CrediUCC, inicio" className="flex items-center gap-3 md:px-2" href="#inicio">
          <span className="grid h-9 w-9 grid-cols-2 place-content-center gap-[3px] rounded-xl border border-[#6f9e84] p-[7px]">
            <i className="rounded-[2px] border border-[#b1d0b9]" />
            <i className="rounded-[2px] bg-[#acc9ae]" />
            <i className="rounded-[2px] bg-[#5e9d7b]" />
            <i className="rounded-[2px] border border-[#b1d0b9]" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-[-1px]">
            credi<span className="text-[#a8c9a7]">ucc</span>
            <small className="mt-1 block text-[8px] font-semibold tracking-[1.2px] text-[#9db5a8]">FINANCIACIÓN ESTUDIANTIL</small>
          </span>
        </a>

        <nav aria-label="Navegación principal" className="flex items-center gap-1 md:mt-14 md:flex-col md:items-stretch">
          <a className="flex h-10 items-center justify-center gap-3 rounded-lg bg-[#2b5145] px-3 text-[#fff] md:justify-start" href="#inicio" title="Resumen">
            <Icon className="h-[18px] w-[18px]" name="grid" />
            <span className="hidden text-xs font-medium sm:inline">Resumen</span>
          </a>
          <a className="flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-[#bbcbc2] transition hover:bg-[#2b5145] hover:text-white md:justify-start" href="#nueva-solicitud" title="Nueva solicitud">
            <Icon className="h-[18px] w-[18px]" name="plus" />
            <span className="hidden text-xs font-medium sm:inline">Nueva solicitud</span>
          </a>
          <a className="flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-[#bbcbc2] transition hover:bg-[#2b5145] hover:text-white md:justify-start" href="#mis-solicitudes" title="Mis solicitudes">
            <Icon className="h-[18px] w-[18px]" name="file" />
            <span className="hidden text-xs font-medium sm:inline">Mis solicitudes</span>
          </a>
        </nav>

        <div className="hidden md:mt-auto md:block">
          <div className="grid gap-2 rounded-xl border border-[#436456] bg-[#21463a] p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#62836f] text-[#c8dbb8]">
              <span className="text-base">?</span>
            </span>
            <strong className="text-xs">¿Necesitas ayuda?</strong>
            <span className="text-[10px] text-[#b0c5ba]">Acércate a tu campus UCC para recibir orientación.</span>
          </div>
          <div className="mt-5 flex items-center gap-2 px-1 text-[10px] text-[#a8beb2]">
            <span className="h-2 w-2 rounded-full bg-[#71b584]" />
            <span>Portal CrediUCC</span>
            <span className="ml-auto text-[#819e90]">v1.0</span>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 md:ml-64" id="inicio">
        <header className="flex h-14 items-center justify-between border-b border-[#e8ece6] bg-[#fbfcfa] px-4 sm:px-7 lg:px-11">
          <div className="flex items-center gap-2 text-[11px] text-[#9aa39d]">
            Portal <span className="text-[#c4cbc6]">/</span> <strong className="font-semibold text-[#43544b]">Resumen</strong>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 text-[10px] text-[#738078]" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              <span className="hidden sm:inline">{status.label}</span>
            </div>
            <span className="h-6 w-px bg-[#e9ede8]" />
            <span className="grid h-8 w-8 place-items-center rounded-full border border-[#dfe9df] bg-[#edf4ed] text-[10px] font-bold text-[#426c52]" aria-label="Comunidad UCC">UC</span>
          </div>
        </header>

        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 sm:py-8 lg:px-11">
          <section className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[9px] font-bold tracking-[1.1px] text-[#758c7e]">
                <span className="h-px w-4 bg-[#8eaf91]" /> FINANCIACIÓN PARA TUS METAS
              </p>
              <h1 className="font-display text-[25px] font-extrabold tracking-[-1px] text-[#1c302c] sm:text-[29px]">
                Hola, <span className="text-[#317452]">estudiante.</span>
              </h1>
              <p className="mt-1 text-[11px] text-[#818b85] sm:text-xs">Un impulso para eso que quieres lograr. ¿Qué tienes en mente?</p>
            </div>
            <a className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#dbe5db] bg-white px-2.5 py-2 text-[10px] font-bold text-[#345b44] transition hover:border-[#9fbea4] sm:px-3.5 sm:text-[11px]" href="#nueva-solicitud">
              <Icon className="h-4 w-4" name="plus" /> <span className="sm:hidden">Solicitar</span><span className="hidden sm:inline">Solicitar crédito</span>
            </a>
          </section>

          <section aria-label="Información de CrediUCC" className="relative isolate flex min-h-[190px] overflow-hidden rounded-2xl bg-[#174b3d] px-5 py-6 text-white sm:px-8">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_68%_115%,#72a27955_0,transparent_34%)]" />
            <div className="relative z-10 max-w-[58%] sm:max-w-[56%]">
              <span className="inline-flex items-center gap-2 text-[8px] font-bold tracking-[1.15px] text-[#bed4bd]">
                <Icon className="h-3.5 w-3.5 text-[#d1dba0]" name="sparkle" /> TU FUTURO, A TU RITMO
              </span>
              <h2 className="mt-2 font-display text-[21px] font-bold leading-tight tracking-[-.7px] sm:text-2xl">
                Las grandes ideas<br />merecen <em className="not-italic text-[#c6d9a8]">un comienzo.</em>
              </h2>
              <p className="mt-2 max-w-[340px] text-[9px] leading-relaxed text-[#c0d3ca] sm:text-[10px]">
                Financiación pensada para acompañar tus proyectos y tu vida universitaria.
              </p>
              <a className="mt-2 inline-flex items-center gap-2 text-[10px] font-bold text-[#e1edcc]" href="#nueva-solicitud">
                Conoce tu opción <Icon className="h-3.5 w-3.5" name="arrow" />
              </a>
              <p className="mt-1 text-[8px] font-semibold text-[#d5e4c2] sm:hidden">Tasas desde 1,2% mensual*</p>
            </div>
            <div aria-hidden="true" className="absolute -right-7 top-0 h-full w-[46%] sm:right-[2%] sm:w-[40%]">
              <div className="absolute right-[15%] top-12 h-24 w-52 rotate-[-25deg] rounded-[50%] border border-[#c5d6a64a]" />
              <div className="absolute right-[15%] top-12 h-24 w-52 rotate-[25deg] rounded-[50%] border border-[#c5d6a64a]" />
              <div className="absolute right-[28%] top-5 grid h-36 w-36 place-items-center rounded-full border border-[#b5c98938] bg-[radial-gradient(circle_at_44%_34%,#408468_0,#276b53_45%,#1b5140_78%)] shadow-[0_0_0_18px_#98b98b0a,0_0_0_38px_#98b98b08]">
                <span className="absolute left-9 top-8 grid h-14 w-14 place-items-center rounded-full border border-[#c6aa67] bg-[linear-gradient(145deg,#d7c27f,#aa8540)] text-xl text-[#876e34]">$</span>
                <span className="absolute left-14 top-14 grid h-[68px] w-[68px] place-items-center rounded-full border border-[#e6d98d] bg-[linear-gradient(145deg,#f8edbd,#c99f4e)] font-display text-3xl text-[#826633] shadow-[inset_0_0_0_4px_#f4e5ac,inset_0_0_0_5px_#c79d4c]">
                  $<small className="absolute bottom-3 text-[7px] font-bold tracking-[1.5px]">UCC</small>
                </span>
                <span className="absolute left-5 top-3 text-base text-[#d6dfa9]">✳</span>
                <span className="absolute bottom-5 right-4 text-sm text-[#98c7a8]">✦</span>
              </div>
              <div className="absolute bottom-5 right-[1%] hidden items-center gap-2 rounded-lg border border-[#e3e7d74d] bg-[#285d49] px-3 py-2 shadow-lg sm:flex">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#dce8c2] text-sm text-[#376747] sm:h-7 sm:w-7 sm:text-lg">↘</span>
                <span><small className="block text-[7px] font-bold tracking-[1px] text-[#bad0bd]">TASAS DESDE</small><strong className="font-display text-sm">1,2% <i className="text-[8px] font-normal text-[#c4d6c3]">mensual</i></strong></span>
              </div>
            </div>
            <p className="absolute bottom-2 right-3 text-right text-[7px] text-[#b5cdbd]">*La tasa final depende de tu perfil y resultado de evaluación.</p>
          </section>

          <section aria-label="Resumen de solicitudes" className="my-4 grid gap-2.5 sm:grid-cols-3">
            <article className="relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-xl border border-[#e9ede8] bg-white px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e7f3eb] text-[#477954]"><Icon className="h-5 w-5" name="file" /></span>
              <div className="grid min-w-0 gap-0.5"><span className="text-[9px] text-[#7d8981]">Solicitudes registradas</span><strong className="font-display text-xl font-extrabold text-[#20372d]">{applications.length}</strong><small className="text-[8px] text-[#a1aaa4]">En este dispositivo</small></div>
              <span className="absolute -right-4 -top-5 h-16 w-16 rounded-full bg-[#e7f3eb] opacity-50" />
            </article>
            <article className="relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-xl border border-[#e9ede8] bg-white px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0edf8] text-[#7866a5]"><Icon className="h-5 w-5" name="check" /></span>
              <div className="grid min-w-0 gap-0.5"><span className="text-[9px] text-[#7d8981]">Aprobadas</span><strong className="font-display text-xl font-extrabold text-[#20372d]">{approvedCount}</strong><small className="text-[8px] text-[#a1aaa4]">¡Un paso más cerca!</small></div>
              <span className="absolute -right-4 -top-5 h-16 w-16 rounded-full bg-[#f0edf8] opacity-50" />
            </article>
            <article className="relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-xl border border-[#e9ede8] bg-white px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff0e3] text-[#bd8054]"><Icon className="h-5 w-5" name="money" /></span>
              <div className="grid min-w-0 gap-0.5"><span className="text-[9px] text-[#7d8981]">Valor solicitado</span><strong className="truncate font-display text-lg font-extrabold text-[#20372d]">{currency.format(requestedAmount)}</strong><small className="text-[8px] text-[#a1aaa4]">Total acumulado</small></div>
              <span className="absolute -right-4 -top-5 h-16 w-16 rounded-full bg-[#fff0e3] opacity-50" />
            </article>
          </section>

          <section className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.8fr)_minmax(245px,.82fr)]">
            <article className="scroll-mt-5 rounded-xl border border-[#e8ece7] bg-white p-4 sm:p-6" id="nueva-solicitud">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[8px] font-bold tracking-[1.1px] text-[#82958a]">EMPECEMOS</p>
                  <h2 className="mt-1 font-display text-base font-extrabold tracking-[-.4px] text-[#1c302c] sm:text-lg">Cuéntanos sobre ti</h2>
                  <p className="mt-1 text-[10px] text-[#8a948e]">Completa tus datos y evaluaremos tu solicitud.</p>
                </div>
                <span className="mt-1 rounded-md border border-[#e7ece7] px-2 py-1 text-[8px] text-[#a4ada7]"><strong className="text-[#3f7352]">01</strong> / 01</span>
              </div>

              <div className="my-4 flex items-center gap-2 rounded-lg border border-[#e8eee6] bg-[#f7faf6] px-3 py-2.5 text-[9px] leading-relaxed text-[#7a887f]" role="note">
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-[#a6bda8] font-display text-[10px] font-bold text-[#63866d]">i</span>
                <span>La evaluación es inmediata. Completa tus datos para consultar el resultado.</span>
              </div>

              <form className="grid gap-x-3 gap-y-3.5 sm:grid-cols-2" onSubmit={handleSubmit}>
                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-[9px] font-bold text-[#4a5e52]">Nombre completo <b className="text-[#c7795f]">*</b></span>
                  <span className="flex h-[38px] items-center rounded-lg border border-[#e5eae4] bg-[#fdfefd] px-2.5 transition focus-within:border-[#80a78a] focus-within:ring-4 focus-within:ring-[#39775112]">
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-[#9aa79d]" name="user" />
                    <input autoComplete="name" className="h-full w-full bg-transparent text-[10px] text-[#354c3e] outline-none placeholder:text-[#b1bbb4]" maxLength={120} name="nombre" placeholder="Ej. Laura Rojas" required />
                  </span>
                </label>

                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-[9px] font-bold text-[#4a5e52]">Correo electrónico <b className="text-[#c7795f]">*</b></span>
                  <span className="flex h-[38px] items-center rounded-lg border border-[#e5eae4] bg-[#fdfefd] px-2.5 transition focus-within:border-[#80a78a] focus-within:ring-4 focus-within:ring-[#39775112]">
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-[#9aa79d]" name="mail" />
                    <input autoComplete="email" className="h-full w-full bg-transparent text-[10px] text-[#354c3e] outline-none placeholder:text-[#b1bbb4]" maxLength={254} name="email" placeholder="nombre@correo.com" required type="email" />
                  </span>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[9px] font-bold text-[#4a5e52]">Edad <b className="text-[#c7795f]">*</b></span>
                  <span className="flex h-[38px] items-center rounded-lg border border-[#e5eae4] bg-[#fdfefd] px-2.5 transition focus-within:border-[#80a78a] focus-within:ring-4 focus-within:ring-[#39775112]">
                    <input className="h-full w-full bg-transparent text-[10px] text-[#354c3e] outline-none placeholder:text-[#b1bbb4]" max={120} min={0} name="edad" placeholder="22" required type="number" />
                    <span className="text-[9px] text-[#a1aaa4]">años</span>
                  </span>
                  <small className="text-[8px] text-[#9aa49c]">Elegibilidad: entre 18 y 65 años</small>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[9px] font-bold text-[#4a5e52]">Score crediticio <b className="text-[#c7795f]">*</b></span>
                  <span className="flex h-[38px] items-center rounded-lg border border-[#e5eae4] bg-[#fdfefd] px-2.5 transition focus-within:border-[#80a78a] focus-within:ring-4 focus-within:ring-[#39775112]">
                    <input className="h-full w-full bg-transparent text-[10px] text-[#354c3e] outline-none placeholder:text-[#b1bbb4]" max={850} min={300} name="score" placeholder="720" required type="number" />
                    <span className="text-[9px] text-[#a1aaa4]">/ 850</span>
                  </span>
                  <small className="text-[8px] text-[#9aa49c]">Mínimo para aprobación: 600</small>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[9px] font-bold text-[#4a5e52]">Ingresos mensuales <b className="text-[#c7795f]">*</b></span>
                  <span className="flex h-[38px] items-center rounded-lg border border-[#e5eae4] bg-[#fdfefd] px-2.5 transition focus-within:border-[#80a78a] focus-within:ring-4 focus-within:ring-[#39775112]">
                    <span className="mr-2 text-[10px] font-semibold text-[#718577]">$</span>
                    <input className="h-full w-full bg-transparent text-[10px] text-[#354c3e] outline-none placeholder:text-[#b1bbb4]" min={0} name="ingresos" placeholder="2.500" required step="any" type="number" />
                  </span>
                  <small className="text-[8px] text-[#9aa49c]">Mínimo para aprobación: $2.000</small>
                </label>

                <label className="flex min-h-[51px] cursor-pointer items-center rounded-lg border border-[#e5eae4] bg-[#fdfefd] px-2.5 py-2">
                  <span className="grid gap-1 text-[9px] font-bold text-[#506356]">Beneficio estudiante<small className="text-[8px] font-normal text-[#99a39b]">Cuéntanos si estudias en la UCC</small></span>
                  <input className="peer sr-only" defaultChecked name="es_estudiante" type="checkbox" />
                  <span aria-hidden="true" className="relative ml-auto h-[18px] w-8 rounded-full bg-[#d4dcd5] transition peer-checked:bg-[#4f8d63] after:absolute after:left-[3px] after:top-[3px] after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-3.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#39775155]" />
                </label>

                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-[9px] font-bold text-[#4a5e52]">¿Cuánto necesitas? <b className="text-[#c7795f]">*</b></span>
                  <span className="flex h-[38px] items-center rounded-lg border border-[#e5eae4] bg-[#fdfefd] px-2.5 transition focus-within:border-[#80a78a] focus-within:ring-4 focus-within:ring-[#39775112]">
                    <span className="mr-2 text-[10px] font-semibold text-[#718577]">$</span>
                    <input className="h-full w-full bg-transparent text-[10px] text-[#354c3e] outline-none placeholder:text-[#b1bbb4]" max={5000} min={100} name="monto" placeholder="1.500" required step={100} type="number" />
                  </span>
                  <small className="text-[8px] text-[#9aa49c]">Puedes solicitar entre $100 y $5.000</small>
                </label>

                <div className="mt-1 flex flex-col gap-3 border-t border-[#edf0ec] pt-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="m-0 flex items-center gap-1.5 text-[8px] text-[#97a199]">
                    <Icon className="h-3.5 w-3.5 text-[#6a9271]" name="clock" /> Evaluación inmediata <span className="text-[#c5ccc6]">·</span> Sin compromiso
                  </p>
                  <button className="inline-flex min-h-[39px] items-center justify-center gap-2 rounded-lg bg-[#286649] px-4 text-[10px] font-bold text-white transition hover:bg-[#1e573c] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Evaluando..." : "Evaluar mi solicitud"}
                    <Icon className="h-4 w-4" name="arrow" />
                  </button>
                </div>
                {feedback && (
                  <output
                    aria-live="polite"
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[10px] leading-relaxed sm:col-span-2 ${feedback.tone === "success" ? "border-[#d9e8dc] bg-[#f2f8f2] text-[#3e6e4b]" : "border-[#eedbd4] bg-[#fff7f4] text-[#a95948]"}`}
                  >
                    <span className="font-extrabold">{feedback.tone === "success" ? "✓" : "!"}</span>
                    <span>{feedback.message}</span>
                  </output>
                )}
              </form>
            </article>

            <aside className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
              <article className="rounded-xl border border-[#e8ece7] bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf4e9] text-[#6c9666]"><Icon className="h-4 w-4" name="sparkle" /></span>
                  <div><p className="text-[7px] font-bold tracking-[1px] text-[#82958a]">ANTES DE EMPEZAR</p><h2 className="mt-0.5 font-display text-sm font-extrabold text-[#1c302c]">¿Cómo funciona?</h2></div>
                </div>
                <p className="mb-2 mt-3 text-[9px] leading-relaxed text-[#89948d]">Revisamos tres criterios para darte una respuesta al instante.</p>
                <ol className="m-0 list-none p-0">
                  {[["01", "Edad", "Entre 18 y 65 años"], ["02", "Score crediticio", "600 puntos o más"], ["03", "Ingresos mensuales", "Desde $2.000"]].map(([number, title, description]) => (
                    <li className="flex min-h-[51px] items-center gap-2.5 border-t border-[#edf0ec]" key={number}>
                      <span className="font-display text-[8px] font-bold text-[#acb7ac]">{number}</span>
                      <span className="grid gap-1"><strong className="text-[9px] text-[#46584c]">{title}</strong><small className="text-[8px] text-[#9aa49d]">{description}</small></span>
                      <span className="ml-auto grid h-[17px] w-[17px] place-items-center rounded-full bg-[#edf5ec] text-[9px] text-[#5c8c62]">✓</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-2 flex items-center gap-2 rounded-md bg-[#f5f8f3] px-2 py-2 text-[8px] text-[#718575]">
                  <Icon className="h-3.5 w-3.5 text-[#4f8561]" name="arrow" /> La evaluación toma solo unos segundos
                </div>
              </article>

              <article className="relative isolate min-h-[170px] overflow-hidden rounded-xl bg-[#e9efe1] p-4 sm:p-5">
                <div aria-hidden="true" className="absolute -right-12 -top-14 -z-10 h-48 w-48 rounded-full border border-[#91a9814d] shadow-[0_0_0_16px_#91a9810b,0_0_0_32px_#91a9810b]" />
                <div className="flex items-center gap-1.5 text-[7px] font-bold tracking-[.9px] text-[#718671]">
                  <Icon className="h-3.5 w-3.5 text-[#7c9a63]" name="sparkle" /> UN BENEFICIO PARA TI
                </div>
                <h3 className="mt-3 font-display text-lg font-extrabold leading-tight tracking-[-.5px] text-[#284736]">Tu esfuerzo<br />tiene <em className="not-italic text-[#5c8458]">recompensa.</em></h3>
                <p className="relative mt-1.5 max-w-[190px] text-[8px] leading-relaxed text-[#718273]">Si eres estudiante, podrías acceder a una tasa preferencial.</p>
                <a className="mt-2 inline-flex items-center gap-1 text-[8px] font-bold text-[#3a6e4b]" href="#nueva-solicitud">Descubre tu tasa <Icon className="h-3 w-3" name="arrow" /></a>
                <span aria-hidden="true" className="absolute bottom-5 right-5 grid h-14 w-14 rotate-12 place-items-center rounded-full border border-[#c5bf82] bg-[linear-gradient(145deg,#efe4ad,#c6af65)] font-display text-2xl text-[#8a7540] shadow-[inset_0_0_0_4px_#f1e7be,inset_0_0_0_5px_#bd9f4e]">$</span>
              </article>
            </aside>
          </section>

          <section className="mt-4 scroll-mt-5 rounded-xl border border-[#e8ece7] bg-white p-4 sm:p-5" id="mis-solicitudes">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <div><p className="text-[8px] font-bold tracking-[1.1px] text-[#82958a]">TU ACTIVIDAD</p><h2 className="mt-1 font-display text-base font-extrabold text-[#1c302c]">Mis solicitudes</h2></div>
              <button aria-label="Actualizar solicitudes" className="inline-flex items-center gap-1.5 rounded-md border border-[#e5eae4] px-2.5 py-2 text-[9px] text-[#64746a] transition hover:border-[#b8cdbb] disabled:opacity-50" disabled={isRefreshing} onClick={handleRefresh} type="button">
                <Icon className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} name="refresh" /> <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[610px] border-collapse text-left">
                <thead className="bg-[#f7f9f6] text-[8px] text-[#929e95]">
                  <tr><th className="px-3 py-2.5 font-semibold">Solicitud</th><th className="px-3 py-2.5 font-semibold">Fecha</th><th className="px-3 py-2.5 font-semibold">Monto</th><th className="px-3 py-2.5 font-semibold">Estado</th><th className="px-3 py-2.5 font-semibold">Tasa mensual</th></tr>
                </thead>
                <tbody>
                  {applications.map((application) => {
                    const approved = application.decision === "APROBADO";
                    const createdAt = new Date(application.creado_en);
                    return (
                      <tr className="border-b border-[#eff1ee] text-[9px] text-[#6f7d73] last:border-0" key={application.id}>
                        <td className="px-3 py-3"><strong className="block text-[#405649]">Solicitud #{application.id}</strong><small className="mt-1 block text-[8px] text-[#a0aaa2]">{application.nombre} · {application.email}</small></td>
                        <td className="px-3 py-3">{Number.isNaN(createdAt.getTime()) ? "—" : dateTime.format(createdAt)}</td>
                        <td className="px-3 py-3">{currency.format(application.monto)}</td>
                        <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-semibold ${approved ? "bg-[#eaf5ec] text-[#54845c]" : "bg-[#fff0eb] text-[#b56e5b]"}`}><i className="h-[5px] w-[5px] rounded-full bg-current" />{approved ? "Aprobada" : "Rechazada"}</span></td>
                        <td className="px-3 py-3 font-bold text-[#4e7656]">{application.tasa_mensual == null ? "—" : `${application.tasa_mensual.toLocaleString("es-CO")}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <HistoryStatus error={historyError} isEmpty={applications.length === 0} isLoading={isLoading} />
            <p className="mt-2 flex items-center gap-2 border-t border-[#eff1ee] pt-3 text-[8px] text-[#a0aaa2]">
              <span className="h-[5px] w-[5px] rounded-full bg-[#71b584]" /> Tus solicitudes se guardan mientras la sesión de la aplicación esté activa.
            </p>
          </section>

          <footer className="mt-4 flex items-center gap-1 text-[8px] text-[#a3aca5]">
            <strong className="text-[#65796c]">CrediUCC</strong>
            <span>· Una iniciativa para impulsar tus metas</span>
            <span className="ml-auto">2026</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
