# Diagnóstico de las ejecuciones de SonarCloud

## Causa del fallo

La ejecución más reciente (`9cdccb8`, 16 de noviembre de 2026) completó correctamente Ruff, las 76 pruebas Python (94,67 % de cobertura), el lint, el type-check y el build de Next.js. También se autenticó correctamente con SonarSource. El único paso fallido fue el escáner de SonarCloud, que terminó con:

> You are running CI analysis while Automatic Analysis is enabled. Please consider disabling one or the other.

El proyecto tiene activado **Automatic Analysis** en SonarCloud al mismo tiempo que `.github/workflows/sonarcloud.yml` inicia el análisis de CI. SonarCloud rechaza esa combinación. La clave de organización y el token OIDC no son la causa: la autenticación funciona y el escáner llega a crear el análisis antes de detenerse.

## Correcciones en el repositorio

- Se quitaron `sonar.sources` y `sonar.tests` de `sonar-project.properties`: los logs del escáner confirman que la configuración actual de alcance de SonarCloud no les da efecto.
- Se documentó en el README el requisito de usar un único modo de análisis.

## Acción necesaria en SonarCloud

Para conservar el escaneo de CI y el Quality Gate en GitHub Actions:

1. Abre el proyecto `estebanMns_crediucc` en SonarCloud.
2. Ve a **Administration → Analysis Method**.
3. Desactiva **Automatic Analysis** y conserva el análisis de CI.
4. En GitHub Actions, vuelve a ejecutar el workflow **SonarQube** fallido.

Esta opción es un ajuste del proyecto en SonarCloud; no se puede cambiar mediante un commit del repositorio. El navegador disponible no tiene una sesión iniciada en SonarCloud, por lo que el ajuste no se pudo aplicar desde aquí.

## Por qué tomó más trabajo

El error ocurre al final del workflow, después de que todas las pruebas y validaciones hayan pasado. Eso hacía parecer que el problema podía estar en el código, la cobertura, las claves del proyecto o la autenticación. Los intentos anteriores corrigieron problemas distintos (como la clave de organización), pero no podían resolver el conflicto entre dos modos de análisis configurados en SonarCloud. La causa solo quedó clara al revisar el log del paso **SonarQube Scan** en varias ejecuciones y comparar su error final.
