# CrediUCC — Proyecto integrador de Pruebas y Mantenimiento de Software

Sistema de **solicitud y aprobación de microcréditos estudiantiles** que integra lo que se vio en las semanas 1 a 10:
Pytest (AAA, BVA, parametrización), cobertura con Quality Gate, Docker y Docker Compose, pruebas de API con JSON Schema,
CI con GitHub Actions, análisis estático (Ruff y SonarCloud), pruebas de carga con Locust, CD con smoke test y
rollback automático, e IaC con LocalStack (S3 + SQS).

## Arquitectura (capas + SOLID)

```
app/
├── dominio/            Reglas de negocio puras (sin frameworks)
│   ├── modelos.py        Entidades y objetos de valor inmutables (dataclass frozen, StrEnum)
│   ├── errores.py        DominioError → TipoInvalidoError / ValorFueraDeDominioError
│   ├── validacion.py     ValidadorSolicitud (entradas destructivas)
│   ├── reglas.py         ReglaElegibilidad (ABC) → ReglaEdad, ReglaScoreMinimo, ReglaIngresoMinimo
│   ├── tasas.py          PoliticaTasa (ABC) → PoliticaTasaUCC
│   └── evaluador.py      EvaluadorCredito (recibe reglas y política por constructor)
├── aplicacion/
│   ├── puertos.py        Interfaces (Protocol): Repositorio, Publicador, CentralRiesgo, MonitorSalud
│   └── servicio_solicitudes.py   Caso de uso: radicar / obtener / listar
├── infraestructura/    Adaptadores: RepositorioEnMemoria, PublicadorAWS, PublicadorNulo,
│                       CentralRiesgoSimulada, MonitorSaludPorEntorno
├── api/                Adaptador HTTP FastAPI (crear_app = fábrica con dependencias inyectadas)
├── config.py           Configuracion inmutable desde variables de entorno
├── contenedor.py       Raíz de composición (único lugar que conoce las clases concretas)
└── main.py             Punto de entrada ASGI
deploy/deploy.py        PipelineDespliegue, ClienteStaging, RegistroReleases, Notificador (Consola)
infra/init_infra.py     AprovisionadorIaC + EstadoDeseado (idempotente)
load/                   locustfile.py (enjambre) + verificar_slo.py (Quality Gate de rendimiento)
tests/unit/             93 pruebas (incluye test_antipatrones.py), ~95 % de cobertura de líneas y ramas (Quality Gate ≥ 80 %)
tests/api/              15 pruebas de caja negra en el contenedor test-runner (JSON Schema + S3/SQS)
frontend/src/           67 pruebas Vitest: lib/credito.test.ts (lógica, 38) y app/page.test.tsx (interfaz, 29)
.github/workflows/      sonarcloud.yml (CI) → cd.yml (contrato → carga → despliegue)
```

| Principio | Dónde se aplica |
|---|---|
| **S** — Responsabilidad única | El validador solo valida, cada regla evalúa una condición, el servicio solo orquesta y la API solo traduce HTTP. |
| **O** — Abierto/cerrado | Para crear una regla o política de tasa nueva se agrega una subclase y el evaluador no se toca (ver `test_evaluador_acepta_reglas_nuevas_sin_modificarse`). |
| **L** — Sustitución de Liskov | `PublicadorNulo` ↔ `PublicadorAWS` y `NotificadorConsola` ↔ `NotificadorEspia` (doble de prueba) son intercambiables. |
| **I** — Segregación de interfaces | Hay cuatro puertos pequeños en lugar de una interfaz "Dios". |
| **D** — Inversión de dependencias | El dominio y la aplicación dependen de abstracciones. Las implementaciones concretas se inyectan desde `contenedor.py`. |

## Ejecución local (sin Docker)

```bash
python -m venv venv && source venv/bin/activate      # Windows: .\venv\Scripts\activate
python -m pip install -r requirements-dev.txt
pre-commit install                                   # shift-left: Ruff + pytest antes de cada commit
python -m pytest                                     # unitarias + Quality Gate de cobertura (≥ 80 %)
python -m ruff check .                               # linter
python -m uvicorn app.main:app --port 8000 --reload  # terminal 1: API
```

En otra terminal, inicia el frontend Next.js:

```bash
cd frontend
npm ci
npm run dev
```

La interfaz web queda disponible en **http://localhost:3000/** y la documentación de la API en **http://localhost:8000/docs**. Next.js reenvía las peticiones del frontend a la API; por defecto, esta debe estar en `http://localhost:8000` (se puede cambiar con `API_URL`).

## Entorno completo con Docker Compose (QA y staging)

```bash
docker compose --profile qa up --build --exit-code-from test-runner   # LocalStack + IaC + API + frontend + test-runner
docker compose up -d --build frontend                                  # frontend + API + LocalStack
docker compose down -v                                                 # destruir todo
```

En Docker Compose, el frontend se publica en **http://localhost:3000/**.

## Prueba de carga y SLO

```bash
python -m locust -f load/locustfile.py --headless -u 100 -r 10 -t 60s \
  --host http://localhost:8000 --csv reporte_carga --exit-code-on-error 0
python load/verificar_slo.py reporte_carga_stats.csv 1000 1      # p95 ≤ 1000 ms y fallos ≤ 1 %
```

## Despliegue continuo

```bash
API_SECRET_KEY=xxx VERSION_CANDIDATA=2.0.0 python deploy/deploy.py   # exit 0 = promovido, 1 = rollback
```

## Pirámide de pruebas

```
                     /\          E2E / sistema: 2
                    /  \         Smoke test en staging + escenario de carga con Locust
                   /----\
                  /      \       Integración: 44
                 /        \      15 de API en Docker (contrato, BVA, PUT, S3/SQS) + 29 de interfaz con API simulada
                /----------\
               /            \    Unitarias: 131
              /              \   93 de pytest (dominio, servicio, infraestructura) + 38 de Vitest (lógica del formulario)
             /________________\
```

| Nivel | Cantidad | Herramienta | Qué necesita para correr | Tiempo real en CI |
|---|---|---|---|---|
| Unitarias | 93 + 38 | pytest, Vitest | Nada: todo en memoria, AWS simulado con `moto` | ~5 s |
| Integración: interfaz | 29 | Vitest + Testing Library | Navegador simulado (jsdom) y `fetch` falso | ~5 s |
| Integración: API | 15 | pytest + requests + jsonschema | Docker Compose: API, LocalStack e IaC | ~1 min |
| E2E / sistema | 2 escenarios | Locust, `deploy.py` | Entorno completo levantado | ~1 a 2 min |

La forma de pirámide es intencional. Abajo hay muchas pruebas rápidas y baratas que localizan el bug con precisión;
arriba hay pocas, lentas y caras, que confirman que todo funciona junto. Por eso el pipeline corre los niveles de
abajo hacia arriba: si una prueba unitaria falla, no tiene sentido gastar minutos levantando Docker.

## Shift-left: el bug se detecta lo antes posible

```
 Máquina del desarrollador     Pull Request               main
 ─────────────────────────     ───────────────────────    ─────────────────────────────────
 pre-commit (Ruff + pytest) →  CI obligatorio para     →  CD automático: contrato → carga
 bloquea el commit             hacer merge (branch        → despliegue con smoke test
                               protection)                  o rollback
 segundos                      ~5 min                     ~5 min
```

- **`pre-commit`** ([.pre-commit-config.yaml](.pre-commit-config.yaml)): ejecuta Ruff y pytest antes de cada
  commit. Si se cambia `>=` por `>` en `ReglaScoreMinimo`, el commit se rechaza en ~4 s y el bug nunca sale de la máquina.
- **Branch protection en `main`:** el check *Build and analyze*, que incluye el Quality Gate de SonarCloud, es
  obligatorio y la rama debe estar al día con `main`. Tampoco se permiten force push ni borrar la rama.

## Pipeline completo en GitHub Actions

```
push a main
  └─ CI  (sonarcloud.yml)  Ruff → pytest + cobertura ≥ 80 % → frontend (lint, tipos, pruebas, build) → SonarCloud
       └─ CD (cd.yml, solo si el CI quedó en verde)
            ├─ Gate 3   Docker Compose + test-runner: contrato JSON Schema, BVA de punta a punta, S3/SQS
            ├─ Carga    Locust (50 usuarios, 30 s) + verificar_slo.py: p95 ≤ 1000 ms y fallos ≤ 1 %
            └─ Deploy   staging con la versión 1.0.<run> → smoke test → promoción, o rollback + alerta
```

Cada etapa depende de la anterior (`needs`): si un gate falla, lo que sigue no se ejecuta. Los reportes de
carga y el `releases.json` se publican como *artifacts* de la ejecución, no se guardan en el repositorio.

Para demostrar los gates en vivo, ejecuta **Actions → CD → Run workflow** y elige:

| Entrada | Valor | Resultado esperado |
|---|---|---|
| `app_healthy` | `false` | El smoke test recibe HTTP 500 → **rollback automático** (el job de despliegue termina en rojo) |
| `latencia_ms` | `1200` | El p95 supera 1000 ms → el **gate de carga** falla y el despliegue no se ejecuta |

## Análisis con SonarCloud

El workflow `.github/workflows/sonarcloud.yml` ejecuta Ruff, las pruebas Python con cobertura, y lint, type-check y build del frontend en `windows-latest`. Después envía el análisis a SonarCloud en cada push o pull request a `main`, usando la autenticación OIDC de SonarSource. También se puede iniciar manualmente desde **Actions → SonarQube → Run workflow**.

Para usar el análisis desde CI, abre el proyecto en SonarCloud y desactiva **Automatic Analysis** en **Administration → Analysis Method**. SonarCloud no permite combinar el análisis automático con el escaneo de GitHub Actions. Las claves del proyecto están configuradas en `sonar-project.properties` como `andreszam12` y `andresZam12_credi_ucc`.

## Secretos de GitHub requeridos

`API_SECRET_KEY` se usa en despliegues (opcional: si falta, el log lo muestra como "no configurado"). El análisis SonarCloud usa autenticación OIDC desde GitHub Actions. Si creas el entorno `produccion` con *Required reviewers*, el pipeline pasa de Continuous Deployment a Continuous Delivery.

## Inyección de fallas (demostración de los Quality Gates)

| Falla | Cómo inyectarla | Gate que la detiene |
|---|---|---|
| Off-by-one | En `reglas.py`, cambiar `>=` por `>` en `ReglaScoreMinimo` | Gate 1: la prueba BVA con score 600 falla |
| Contrato roto | En `modelos.a_dict`, renombrar `tasa_mensual` a `tasaMensual` | Gate 3 (`cd.yml`): `ValidationError` de JSON Schema |
| Pruebas eliminadas | Borrar archivos de `tests/unit` | Gate 1: la cobertura cae por debajo del 80 % |
| Secreto en el código | Escribir un token en cualquier `.py` | Gate 2: SonarCloud |
| Cuello de botella | `CENTRAL_RIESGO_LATENCIA_MS=1200` (o `latencia_ms` en el workflow) | Gate de carga: el p95 viola el SLO |
| Staging enfermo | `APP_HEALTHY=false` (o `app_healthy` en el workflow) | CD: el smoke test falla, hay rollback y alerta en el log |

## Clientes recurrentes y actualización de solicitudes

El **correo** identifica al cliente, sin importar mayúsculas ni espacios (`clave_cliente` en `modelos.py`).

| Endpoint | Qué hace |
|---|---|
| `POST /api/v1/solicitudes` | Crea una solicitud nueva. `numero_cliente` dice cuál es para ese correo (1 = nuevo, 2+ = recurrente). |
| `PUT /api/v1/solicitudes/{id}` | Reevalúa la misma solicitud con datos nuevos: conserva el id, sube `version` y fija `actualizado_en`. Responde **409** si el correo es de otro cliente y **404** si no existe. |

En la interfaz, si el correo ya tiene solicitudes, antes de enviar aparece un diálogo con tres opciones:
**Actualizar la solicitud #N**, **Crear una nueva solicitud** o **Cancelar**. El historial marca cada fila como
*Cliente nuevo* o *Recurrente · 2.ª solicitud*, y agrega *Actualizada · v2* cuando corresponde.

## Anti-patrones de pruebas y su solución

En [tests/unit/test_antipatrones.py](tests/unit/test_antipatrones.py) hay tres anti-patrones. Para cada uno se
inyecta un **mutante** (una copia del código con un bug) y se demuestra que la prueba mal escrita sigue en verde,
mientras que la versión corregida detecta el bug.

| Anti-patrón | Por qué es malo | Bug que deja pasar | Solución |
|---|---|---|---|
| Prueba sin aserción | Solo comprueba que el código "no explota" | Off-by-one en el score (`>` en vez de `>=`) | Assert sobre el resultado esperado (patrón AAA) |
| `try/except Exception: pass` | Si la excepción esperada no ocurre, la prueba igual pasa | Un validador que ya no valida nada | `pytest.raises(TipoInvalidoError)`, que exige el tipo exacto |
| Estado compartido entre pruebas | La misma prueba pasa o falla según el orden de ejecución | Prueba frágil (*flaky*) | Fixture que entrega un repositorio nuevo a cada prueba |

Ruff detecta el segundo anti-patrón por sí solo (regla `SIM105`). En el ejemplo se silencia a propósito con `noqa`.

## Bug real encontrado durante las pruebas (anatomía del bug)

| Fase | Qué pasó |
|---|---|
| **Error** (humano) | Los mensajes de `deploy.py` usan emojis (🚀, 🚨) y se asumió que la consola siempre es UTF-8. |
| **Defecto** (código) | `print()` usa la codificación de la consola, y en Windows esa codificación es cp1252. |
| **Falla** (síntoma) | Al ejecutar el despliegue en Windows: `UnicodeEncodeError` *después* de promover la versión. El script devolvía `exit 1`, un falso rollback, aunque `releases.json` ya marcaba la versión nueva. |
| **Por qué no lo vio CI** | Los runners de GitHub son Linux con UTF-8: el bug depende del entorno. |
| **Corrección** | `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` en el punto de entrada de `deploy/deploy.py`. |
