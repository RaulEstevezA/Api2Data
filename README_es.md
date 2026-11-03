# Api2Data

Api2Data envía peticiones HTTP a una API y muestra la respuesta, desde el navegador. Las peticiones van directamente de tu navegador a la API: no hay proxy ni servidor propio, y nada de lo que escribes se envía a ningún otro sitio.

```text
Escribe la URL  →  Configura la petición (si hace falta)  →  Enviar  →  Revisa la respuesta
```

## Qué hace

1. **Construye la petición.** Método (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS), dirección y, una sección cada vez:
   - **Params**: filas clave / valor sincronizadas con la URL; una fila se puede desactivar sin borrarla.
   - **Headers**: las mismas filas, y las cabeceras que se añaden solas (Content-Type del body, Authorization de su sección), para que no se envíe nada sin verlo.
   - **Autorización**: sin autenticación, Bearer Token, Basic Auth o API Key (como cabecera o como parámetro). Solo se muestran los campos del tipo elegido; los secretos quedan ocultos hasta pulsar «Mostrar».
   - **Body**, en los métodos que lo llevan: JSON (con validación que indica línea, columna y causa), Texto, XML o Form URL Encoded.
   - **Código**: la misma petición en cURL, JavaScript (fetch) o Python (requests), lista para copiar.
2. **La comprueba antes de enviar.** Una dirección no válida, un body JSON con un error o una cabecera que el navegador no puede enviar detienen la petición con una explicación. Si falta el protocolo se completa con `https://`, y se indica.
3. **Muestra la respuesta**: estado con su texto, tiempo, tamaño y Content-Type, y la redirección si la hubo. Después:
   - **Body**: JSON y XML formateados y resaltados (los números conservan sus cifras exactas), HTML y texto tal como llegan, y el contenido binario se ofrece para descargar.
   - **Headers**: las cabeceras de la respuesta que expone el navegador.
   - **Raw**: línea de estado, cabeceras y body como texto.
   - Buscar (Ctrl/Cmd+F), Copiar y Descargar.
4. **Explica los fallos.** Cuando no hay respuesta, dice qué ha pasado probablemente en lugar de «Failed to fetch»: CORS, sin conexión, una dirección http desde una página https o una petición cancelada.

## CORS

Api2Data se ejecuta en tu navegador y envía las peticiones con `fetch`, así que el navegador aplica sus reglas: la API tiene que permitir peticiones desde otras webs (cabecera `Access-Control-Allow-Origin`). Muchas APIs públicas lo hacen; otras solo aceptan peticiones desde su propia web o desde servidores.

Cuando una petición se bloquea, el navegador no da detalles a la página, así que Api2Data enumera las causas probables: la API no permite otras webs (o no con este método o estas cabeceras), la dirección no existe o no se puede alcanzar, o una extensión o la red la bloquean. **Que una petición se bloquee no significa que la API esté caída.**

Cuando el navegador bloquea una petición, el error ofrece dos formas de obtener la respuesta igualmente:

- **curl**: «Copiar como cURL» copia el comando (con `-i`, para que muestre el estado y las cabeceras). Ejecútalo en una terminal y pega lo que devuelva con «Pegar respuesta»: se muestra como cualquier otra respuesta (estado, cabeceras, body formateado), salvo el tiempo, que Api2Data no ha medido.
- **La [versión de escritorio](./desktop/README_es.md)**: envía las peticiones ella misma, no a través de un navegador, así que CORS no se aplica. El botón de descarga corresponde a tu sistema y tu procesador.

Api2Data no usa un proxy a propósito: vería tus peticiones, tokens y respuestas.

## Privacidad

- Las peticiones van de tu navegador a la API, sin servidores en medio. Nunca se añaden las cookies ni las credenciales guardadas en el navegador (`credentials: 'omit'`).
- Los tokens, contraseñas y API keys se mantienen en memoria, en la pestaña abierta.
- El **historial** se guarda solo en este navegador, y se puede desactivar o borrar. Omite tokens, contraseñas, valores de API keys y los valores de cabeceras y parámetros que parecen secretos (`Authorization`, `X-API-Key`, `token`, `api_key`, `password`…). Guardarlos es una opción aparte, desactivada de inicio; las entradas guardadas así llevan la etiqueta «con credenciales», y al desactivar la opción se quitan.
- Los **archivos de petición** nunca incluyen credenciales.
- Se recuerdan las preferencias (idioma, opciones del historial, lenguaje del código); lo que escribes no, salvo el historial.

## Historial, archivos y cURL

- **Historial**: cada petición enviada (salvo las canceladas) se añade arriba, con su resultado; volver a enviar la última la actualiza en lugar de repetirla. Hasta 50 entradas. Pulsa una para cargarla.
- **Pega un comando cURL** en la barra de URL, tal como lo copian las herramientas de desarrollo del navegador («Copy as cURL») o la documentación de una API: se rellenan método, dirección, cabeceras, autorización y body. Lo que no se puede traer (un body leído de un archivo, formularios multipart) se indica.
- **Guardar / Abrir**: una petición guardada como `.api2data.json` se reabre más tarde o en otro ordenador; Abrir también lee un archivo de texto con un comando cURL.

## Trabajar con otras herramientas

Api2Data es el primer paso de la familia:

```text
Api2Data  →  Api2Class  →  Mapper  →  Model2DB
```

El JSON que devuelve una API aquí es lo que [Api2Class](https://github.com/RaulEstevezA/Api2Class) convierte en modelos tipados. Api2Class ya acepta una respuesta enviada desde Api2Data; la acción «Abrir en Api2Class» aparecerá aquí cuando esa versión esté publicada. El contrato está en [docs/interoperability.md](docs/interoperability.md).

## Versiones

| | Web | Escritorio |
|---|---|---|
| Tecnología | React + TypeScript + Vite | Python + PySide6 |
| Se ejecuta en | El navegador | Aplicación instalable (Windows, macOS, Linux) |
| CORS | Se aplica: la API tiene que permitir otras webs | No se aplica |
| Documentación | Este README y [docs/](./docs) | [desktop/README_es.md](./desktop/README_es.md) |

La aplicación de escritorio hace lo mismo que la versión web, con el mismo aspecto, los mismos ejemplos y en inglés o español.

## Comportamiento compartido

Las dos versiones están escritas por separado (TypeScript y Python), pero **se comportan igual**: la carpeta [`shared/`](./shared/README.md) contiene los casos de prueba que definen qué debe hacer cada parte del núcleo, desde la URL y sus params hasta la preparación de la petición, las credenciales, el formato, los comandos cURL, los archivos de petición, el historial y el código generado. Los tests de la web y del escritorio leen los mismos archivos, así que una diferencia en cualquiera de las dos versiones hace fallar sus tests.

## Desarrollo

La versión web está en [`web/`](./web): React, TypeScript y Vite, con CodeMirror para los editores y sin librerías de componentes; su aspecto sigue el diseño común de la web y las demás herramientas.

```bash
cd web
npm install
npm run dev      # servidor de desarrollo
npm run check    # tipos, lint, formato y tests
npm run build    # build de producción en web/dist
```

Los tests cubren el núcleo (URL y params, autorización, bodies, preparación de la petición, fallos, respuestas, historial, importación y generación de código —también ejecutando el Python y el shell generados cuando `python3` y `bash` están instalados—), los casos compartidos y los flujos principales de la interfaz.

La versión de escritorio está en [`desktop/`](./desktop): consulta [desktop/README_es.md](./desktop/README_es.md#ejecutar-en-local) para ejecutarla, probarla y crear el ejecutable.

## Estructura del repositorio

```
web/                     Versión web (React + TypeScript + Vite)
  src/core/              Lógica sin interfaz: peticiones, autorización, bodies, ejecución, respuestas, historial, importación, código
  src/app/               Estado de la interfaz fuera de los componentes (borrador, envío, historial)
  src/components/        Interfaz React
desktop/                 Versión de escritorio (Python + PySide6)
  api2data/core/         La misma lógica que web/src/core/, en Python, más el envío con la biblioteca estándar
  api2data/ui/           Interfaz con PySide6
shared/                  Comportamiento común a las dos versiones
  test-cases/            Llamadas al núcleo y el resultado que deben dar las dos versiones
docs/                    Documentación técnica e imágenes
```

## Documentación técnica

| Documento | Contenido |
|---|---|
| [architecture.md](docs/architecture.md) | Capas, carpetas, el recorrido de una petición y cómo ampliarlo |
| [interoperability.md](docs/interoperability.md) | Archivos de petición, formato del historial y traspaso a Api2Class |

## Sugerencias

Ideas de mejora o errores: escribe a [contact.raulesteveza@gmail.com](mailto:contact.raulesteveza@gmail.com).

## Desarrollador

**Raul Estevez**

- [Web personal](https://raulesteveza.github.io/)
- [Perfil de LinkedIn](https://www.linkedin.com/in/raulesteveza/)

## Licencia

[MIT](./LICENSE)
