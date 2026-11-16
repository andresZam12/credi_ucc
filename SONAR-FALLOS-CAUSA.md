# Diagnóstico de los fallos de SonarCloud

## Causas identificadas

Hubo dos fallos consecutivos, con causas distintas:

1. En la ejecución #5, SonarCloud rechazó el análisis de CI porque **Automatic Analysis** seguía activo. El workflow se autenticaba correctamente; el conflicto era tener habilitados ambos modos de análisis.
2. Después de desactivar Automatic Analysis, la ejecución #6 (`fb9d3be`) sí llegó al escáner, pero no pudo importar `coverage.xml`: el reporte usaba varios directorios `<source>` y nombres ambiguos como `__init__.py`. Además, el frontend aún no generaba un reporte LCOV.
3. La ejecución #7 (`cf9bd08`) importó los dos reportes de cobertura correctamente, pero el Quality Gate siguió en 0 % de cobertura nueva. La API de SonarCloud confirmó que clasificó `frontend/src/app/page.test.tsx` como código de producción (`FIL`), contando sus 112 líneas de pruebas como líneas sin cobertura, aunque la página de producción sí tenía cobertura.

## Correcciones aplicadas

- Se conservó el análisis de CI y se eliminaron `sonar.sources` y `sonar.tests`, que el escáner actual no aplicaba.
- Se configuró Coverage.py para emitir rutas relativas desde una sola raíz. `coverage.xml` ahora incluye nombres como `app/__init__.py`, evitando la ambigüedad entre archivos con el mismo nombre.
- Se añadieron pruebas de interacción para la página de solicitudes y cobertura V8/LCOV para el frontend. El workflow genera `frontend/coverage/lcov.info` antes del análisis y SonarCloud ya tiene configurada esa ruta.
- Se excluyeron del cálculo de cobertura los artefactos generados y archivos de configuración estática, no el código de la página.
- Se excluyeron los archivos `*.test.tsx` del alcance de código de Sonar: el workflow ya los ejecuta como pruebas, pero SonarCloud no los reconocía como archivos de prueba en este proyecto.

## Validación local

- `python -m pytest`: 77 pruebas aprobadas; cobertura total Python de 94,67 %.
- `npm run test:coverage`: 10 pruebas aprobadas; cobertura de líneas de `page.tsx` de 100 % y de ramas de 86,04 %.
- `npm run lint`, `npm run typecheck` y `npm run build`: aprobados.

La ejecución #7 confirmó que Sonar importa ambos reportes, pero falló el Quality Gate por la clasificación del archivo de pruebas. La exclusión recién añadida requiere otra ejecución de GitHub Actions para confirmar el resultado remoto; no se debe considerar resuelto hasta que termine en verde.

## Acción necesaria en SonarCloud

Para usar el análisis de CI:

1. En `estebanMns_crediucc`, abre **Administration → Analysis Method**.
2. Desactiva **Automatic Analysis** y conserva el análisis de CI.
3. Ejecuta el workflow **SonarQube** desde **Actions → Run workflow**, o espera la ejecución del próximo push.

La selección de modo de análisis es un ajuste del proyecto en SonarCloud y no se cambia con un commit.

## Por qué tomó más trabajo

El primer error ocurría al final del workflow y parecía relacionado con código, autenticación o configuración. Al resolver el conflicto de Automatic Analysis aparecieron problemas sucesivos: rutas ambiguas en `coverage.xml`, falta de reporte LCOV y, finalmente, la clasificación errónea del archivo de pruebas como código de producción. Cada problema solo se hizo visible al superar el anterior; por eso fue necesario comparar los logs del escáner con las métricas y el árbol de componentes que publica SonarCloud. La validación local ya pasa; el siguiente análisis remoto debe confirmar que la exclusión del archivo de pruebas lleva el Quality Gate a verde.
