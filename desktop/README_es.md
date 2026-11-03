# Api2Data · Escritorio

Versión de escritorio de Api2Data: Python + PySide6.

Hace lo mismo que la versión web, en tu ordenador y sin navegador, así que **CORS no se aplica**: una API que solo responde a su propia web o a servidores también responde aquí. El núcleo pasa los mismos casos de prueba de [`shared/test-cases/`](../shared/README.md) que la versión web, así que las peticiones se preparan, comprueban, formatean y guardan igual.

Qué hace la herramienta y su filosofía están en el [README principal](../README_es.md).

## Descargar

| Sistema | Archivo |
|---|---|
| macOS (Apple Silicon) | [Api2Data-macOS.dmg](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-macOS.dmg) |
| Windows (x64) | [Api2Data-Windows.zip](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Windows.zip) |
| Windows (ARM64) | [Api2Data-Windows-ARM64.zip](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Windows-ARM64.zip) |
| Linux (x64) | [Api2Data-Linux.tar.gz](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Linux.tar.gz) |
| Linux (ARM64, Ubuntu 24.04 o posterior) | [Api2Data-Linux-ARM64.tar.gz](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Linux-ARM64.tar.gz) |

Todas las versiones están en [Releases](https://github.com/RaulEstevezA/Api2Data/releases).

> [!NOTE]
> La aplicación empaquetada se ha compilado y comprobado en **macOS** (Apple Silicon). Las versiones de Windows y Linux las compila GitHub Actions y pasan los tests y una comprobación automática de arranque, pero todavía nadie las ha usado en un ordenador real. Si encuentras un problema, escribe a [contact.raulesteveza@gmail.com](mailto:contact.raulesteveza@gmail.com).

- **macOS:** abre el `.dmg` y arrastra Api2Data a Aplicaciones.
- **Windows:** descomprime el `.zip` y ejecuta `Api2Data.exe` dentro de la carpeta `Api2Data`.
- **Linux:** extrae con `tar -xzf Api2Data-Linux.tar.gz` (o `Api2Data-Linux-ARM64.tar.gz`) y ejecuta `Api2Data/Api2Data`. Algunas distribuciones necesitan `libxcb-cursor0`. La versión ARM64 necesita una distribución de 2024 o posterior (glibc 2.39, como Ubuntu 24.04).

### Abrirla la primera vez

La aplicación no está firmada (firmarla requiere cuentas de pago de Apple y Microsoft), así que el sistema avisa la primera vez que se abre:

- **macOS** dice que no ha podido verificar que la app esté libre de software malicioso. Pulsa **Hecho**, ve a **Ajustes del Sistema → Privacidad y seguridad**, baja hasta **Seguridad** y pulsa **Abrir igualmente**. Solo hay que hacerlo una vez.
- **Windows** muestra "Windows protegió su PC". Pulsa **Más información** y después **Ejecutar de todas formas**.

El código es el de este repositorio y los archivos los compila GitHub Actions ([workflow](../.github/workflows/release-desktop.yml)).

## Ejecutar en local

Requisitos: Python 3.11 o posterior.

```bash
cd desktop
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
python -m pytest                   # tests (casos compartidos de shared/test-cases/)
ruff check .                       # análisis estático
python -m api2data                 # abrir la aplicación
```

## Crear el ejecutable

```bash
pip install -e ".[build]"
pyinstaller packaging/api2data.spec
dist/Api2Data.app/Contents/MacOS/Api2Data --smoke-test   # macOS; dist/Api2Data/Api2Data en los demás
```

El resultado queda en `dist/`: `Api2Data.app` en macOS y una carpeta `Api2Data` con el ejecutable en Windows y Linux. PyInstaller no compila para otros sistemas: cada uno se compila en su propio sistema operativo. `--smoke-test` abre la ventana, carga todos los ejemplos, escribe el código de cada lenguaje, envía una petición real a un servidor del mismo ordenador (comprimida y con tildes) y guarda y abre un archivo de petición, para comprobar que no falta nada en el paquete.

## Estructura

```
api2data/
  core/            Lógica sin interfaz: cada módulo es la contraparte de uno de web/src/core/
    request/       URL y params, cabeceras, preparación, credenciales, borradores guardados
    auth/, body/   Tipos de autorización y de body
    response/      Content type y charset, vistas, estado, procesado
    history/       Entradas del historial y su almacenamiento
    importing/     Comandos cURL y archivos de petición
    codegen/       cURL, JavaScript y Python
    execute/       Envío con la biblioteca estándar (solo escritorio)
  app/             La petición que se edita (contraparte de web/src/app/draft.ts)
  ui/              Interfaz con PySide6
  assets/          Icono y marca de las casillas
packaging/         Configuración de PyInstaller, iconos de la app y prueba de arranque
tests/             Tests con pytest, que leen los casos de shared/test-cases/
pyproject.toml     Dependencias y configuración
```

## Tests

El núcleo se comprueba con [`shared/test-cases/`](../shared/README.md), los mismos archivos que leen los tests de la versión web: 221 llamadas al núcleo (URL y params, cabeceras, autorización, bodies, preparación de la petición, credenciales, formato de JSON y XML, charsets, procesado de respuestas, comandos cURL, archivos de petición, historial y código generado). Todas dan el mismo resultado que la versión web. El envío se prueba contra un servidor HTTP del mismo ordenador (método, cabeceras y body tal como se escriben, estados de error, redirecciones, compresión, servidor inalcanzable, tiempo de espera, cancelación) y los tests de interfaz abren la ventana sin mostrarla (`QT_QPA_PLATFORM=offscreen`).

## Diferencias con la versión web

- **Sin CORS ni contenido mixto**: las peticiones no pasan por un navegador. Todas las cabeceras se envían tal como se escriben (`Cookie`, `Host`, `User-Agent`…), y los fallos son los de una red: no se puede llegar al servidor, tarda más de 60 segundos o su certificado no es válido.
- **El historial** se guarda en este ordenador, en los ajustes del sistema, en lugar del almacenamiento del navegador. Tiene las mismas opciones: se puede desactivar o borrar, y las credenciales se omiten salvo que se elija guardarlas.
- **Los archivos de petición** se abren y guardan con los diálogos del sistema; el formato es el mismo, así que una petición guardada en una versión se abre en la otra.
- **Sin enlaces**: la aplicación funciona sola. El crédito abre la web en el navegador.

## Privacidad

Las peticiones van de este ordenador a la API, sin servidores en medio. No se envía nada más a ningún sitio. El historial se guarda en los ajustes del sistema, sin tokens, contraseñas ni claves salvo que se elija; las preferencias (idioma, opciones del historial, lenguaje del código) también se guardan ahí.

[Volver al README principal](../README_es.md)
