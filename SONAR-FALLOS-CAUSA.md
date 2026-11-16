# Diagnóstico de los fallos de SonarCloud

## Causas identificadas

Hubo dos fallos consecutivos, con causas distintas:

1. En la ejecución #5, SonarCloud rechazó el análisis de CI porque **Automatic Analysis** seguía activo. El workflow se autenticaba correctamente; el conflicto era tener habilitados ambos modos de análisis.
2. Después de desactivar Automatic Analysis, la ejecución #6 (`fb9d3be`) sí llegó al escáner, pero no pudo importar `coverage.xml`: el reporte usaba varios directorios `<source>` y nombres ambiguos como `__init__.py`. Además, el Quality Gate midió solo 16,53 % de cobertura nueva: el frontend aún no generaba un reporte LCOV y sus líneas nuevas quedaban sin cubrir.

## Correcciones aplicadas

- Se conservó el análisis de CI y se eliminaron `sonar.sources` y `sonar.tests`, que el escáner actual no aplicaba.
- Se configuró Coverage.py para emitir rutas relativas desde una sola raíz. `coverage.xml` ahora incluye nombres como `app/__init__.py`, evitando la ambigüedad entre archivos con el mismo nombre.
- Se añadieron pruebas de interacción para la página de solicitudes y cobertura V8/LCOV para el frontend. El workflow genera `frontend/coverage/lcov.info` antes del análisis y SonarCloud ya tiene configurada esa ruta.
- Se excluyeron del cálculo de cobertura los artefactos generados y archivos de configuración estática, no el código de la página.

## Validación local

- `python -m pytest`: 77 pruebas aprobadas; cobertura total Python de 94,67 %.
- `npm run test:coverage`: 10 pruebas aprobadas; cobertura de líneas de `page.tsx` de 100 % y de ramas de 86,04 %.
- `npm run lint`, `npm run typecheck` y `npm run build`: aprobados.

Estas verificaciones confirman las pruebas y el formato de los reportes localmente. El Quality Gate de SonarCloud todavía requiere una nueva ejecución en GitHub Actions; no se debe considerar resuelto hasta que esa ejecución termine en verde.

## Acción necesaria en SonarCloud

Para usar el análisis de CI:

1. En `estebanMns_crediucc`, abre **Administration → Analysis Method**.
2. Desactiva **Automatic Analysis** y conserva el análisis de CI.
3. Ejecuta el workflow **SonarQube** desde **Actions → Run workflow**, o espera la ejecución del próximo push.

La selección de modo de análisis es un ajuste del proyecto en SonarCloud y no se cambia con un commit.

## Por qué tomó más trabajo

El primer error ocurría al final del workflow y parecía relacionado con código, autenticación o configuración. Al resolver el conflicto de Automatic Analysis apareció el siguiente problema, esta vez en la importación de cobertura Python; después, el Quality Gate mostró que también faltaba cobertura automatizada para el frontend. Cada problema se hacía visible solo al superar el anterior. Por eso fue necesario revisar por separado el mensaje final del escáner, la estructura de `coverage.xml`, las métricas de código nuevo y finalmente generar y enlazar reportes de cobertura para ambos lenguajes. La validación local ya pasa, pero solo el próximo análisis remoto puede confirmar el Quality Gate completo.
