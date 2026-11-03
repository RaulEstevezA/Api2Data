"""English and Spanish texts. Mirrors web/src/i18n/messages.ts for the texts both versions share; the desktop says
"this computer" where the web says "this browser", "Save" where it says "Download", and its failures are its own:
without a browser there is no CORS."""

from types import SimpleNamespace

from PySide6.QtCore import QLocale, QObject, QSettings, Signal


def _en_number(value: int) -> str:
    return f"{value:,}"


def _es_number(value: int) -> str:
    # Spanish groups thousands only from five digits on: 1234, 12.345
    return f"{value:,}".replace(",", ".") if abs(value) >= 10000 else str(value)


def _found(found: str | None) -> str:
    """The character found, readable even when it is invisible (a line break, a tab)."""
    if found is None:
        return ""
    import json

    escaped = json.dumps(found, ensure_ascii=False)[1:-1]
    return f"“{escaped or found}”"


_EXPECTED_EN = {
    "value": "a value",
    "key": "a property name in double quotes",
    "colon": "“:”",
    "commaOrBrace": "“,” or “}”",
    "commaOrBracket": "“,” or “]”",
}
_EXPECTED_ES = {
    "value": "un valor",
    "key": "un nombre de propiedad entre comillas dobles",
    "colon": "“:”",
    "commaOrBrace": "“,” o “}”",
    "commaOrBracket": "“,” o “]”",
}


def _json_error_en(error: dict) -> str:
    after = "" if error.get("key") is None else f" after “{error['key']}”"
    found = _found(error.get("found"))
    code = error["code"]
    if code == "empty":
        return "Write a JSON body."
    if code == "unexpectedEnd":
        expected = error.get("expected")
        return (
            f"The JSON ends too early: expected {_EXPECTED_EN[expected]}{after}."
            if expected
            else "The JSON ends too early: a string is not closed."
        )
    if code == "unexpectedCharacter":
        hint = (
            " JSON uses double quotes."
            if error.get("found") == "'"
            else " JSON does not allow comments."
            if error.get("found") == "/"
            else ""
        )
        return f"Expected {_EXPECTED_EN[error.get('expected') or 'value']}{after}, found {found}.{hint}"
    if code == "trailingComma":
        return f"Comma before {found}{after}: remove it."
    if code == "invalidNumber":
        return "Invalid number: JSON does not allow leading zeros or a dot without decimals."
    if code == "invalidEscape":
        return f"Unknown escape sequence \\{error.get('found') or ''}."
    if code == "controlCharacter":
        return "Line break or tab inside a string: write it as \\n or \\t."
    if code == "trailingContent":
        return "There is more text after the end of the JSON."
    return "The JSON is nested too deep (more than 512 levels)."


def _json_error_es(error: dict) -> str:
    after = "" if error.get("key") is None else f" después de “{error['key']}”"
    found = _found(error.get("found"))
    code = error["code"]
    if code == "empty":
        return "Escribe un body JSON."
    if code == "unexpectedEnd":
        expected = error.get("expected")
        return (
            f"El JSON termina antes de tiempo: se esperaba {_EXPECTED_ES[expected]}{after}."
            if expected
            else "El JSON termina antes de tiempo: falta cerrar las comillas de un texto."
        )
    if code == "unexpectedCharacter":
        hint = (
            " JSON usa comillas dobles."
            if error.get("found") == "'"
            else " JSON no admite comentarios."
            if error.get("found") == "/"
            else ""
        )
        return f"Se esperaba {_EXPECTED_ES[error.get('expected') or 'value']}{after}, pero hay {found}.{hint}"
    if code == "trailingComma":
        return f"Coma antes de {found}{after}: quítala."
    if code == "invalidNumber":
        return "Número no válido: JSON no admite ceros a la izquierda ni un punto sin decimales."
    if code == "invalidEscape":
        return f"Secuencia de escape desconocida: \\{error.get('found') or ''}."
    if code == "controlCharacter":
        return "Salto de línea o tabulador dentro de un texto: escríbelo como \\n o \\t."
    if code == "trailingContent":
        return "Hay más texto después del final del JSON."
    return "El JSON tiene demasiados niveles (más de 512)."


_AUTH_EN = {"none": "No Auth", "bearer": "Bearer Token", "basic": "Basic Auth", "apiKey": "API Key"}
_AUTH_ES = {"none": "Sin autenticación", "bearer": "Bearer Token", "basic": "Basic Auth", "apiKey": "API Key"}


def _messages_en() -> SimpleNamespace:
    t = SimpleNamespace()
    t.tagline = "Send HTTP requests to an API and inspect the response"
    t.intro_description = (
        "Write the address, choose the method, add parameters, headers, authorization or a body if you need them, "
        "and send. You see the status, the time, the size and the response formatted (JSON, XML or text) with its "
        "headers. Requests go straight from this computer to the API, without a browser: CORS does not apply."
    )
    t.privacy_short = "Processed locally"
    t.examples_label = "Try an example"
    t.examples = {"github": "GET a repository", "query": "Query parameters", "post": "POST with JSON"}
    t.example_descriptions = {
        "github": "Public GitHub API: data of the Api2Class repository",
        "query": "JSONPlaceholder: comments filtered with ?postId=1",
        "post": "JSONPlaceholder: creates a post from a JSON body (simulated by the API)",
    }
    t.developed_by = "Developed by"
    t.url_placeholder = "https://api.example.com/users"
    t.method_label = "Method"
    t.url_label = "URL"
    t.send = "Send"
    t.sending = "Sending…"
    t.send_shortcut = "Send (Ctrl/Cmd+Enter)"
    t.cancel = "Cancel"
    t.url_problem = {
        "empty": "Write the address of the API to send the request.",
        "invalid": "This address is not valid. Check that it has no spaces and the domain is complete.",
        "unsupportedScheme": "Only http:// and https:// addresses can be requested.",
    }
    t.scheme_added = lambda url: f"No protocol written: it will be sent to {url}"
    t.request_title = "Request"
    t.sections = {"params": "Params", "headers": "Headers", "auth": "Authorization", "body": "Body", "code": "Code"}
    t.key_placeholder = "Key"
    t.value_placeholder = "Value"
    t.remove = "Remove"
    t.enable_row = lambda key: f"Send “{key or 'empty'}”"
    t.params_hint = "They are added to the URL. Uncheck a row to leave it out without deleting it."
    t.headers_hint = "Uncheck a row to leave it out without deleting it."
    t.automatic_headers = "Added automatically"
    t.header_source = {"user": "", "auth": "from Authorization", "body": "from Body"}
    t.auth_type_label = "Type"
    t.auth_types = _AUTH_EN
    t.auth_none = "The request is sent without credentials."
    t.token_label = "Token"
    t.username_label = "Username"
    t.password_label = "Password"
    t.api_key_name_label = "Key name"
    t.api_key_value_label = "Value"
    t.api_key_location_label = "Add to"
    t.api_key_locations = {"header": "Header", "query": "Query params"}
    t.show = "Show"
    t.hide = "Hide"
    t.credentials_note = "Credentials are only kept in this window while it is open, and only sent to the API."
    t.body_modes = {"none": "None", "json": "JSON", "text": "Text", "xml": "XML", "form": "Form URL Encoded"}
    t.body_not_allowed = lambda method: (
        f"{method} requests have no body. Choose POST, PUT, PATCH or DELETE to send one."
    )
    t.body_none = "The request is sent without a body."
    t.format_json = "Format"
    t.json_valid = "Valid JSON"
    t.content_type_note = lambda value: f"Sent with Content-Type: {value}"
    t.error_position = lambda line, column: f"Line {_en_number(line)}, column {_en_number(column)}"
    t.json_error = _json_error_en
    t.code_target_label = "Language"
    t.code_unavailable = "The code will appear here when the request can be sent."
    t.code_credentials_note = "It includes the credentials of the request: be careful where you paste it."
    t.open_request = "Open"
    t.open_request_title = "Open a request saved with Api2Data, or a text file with a cURL command"
    t.save_request = "Save"
    t.save_request_title = (
        "Save this request in a file to reopen or share it. Tokens, passwords and keys are not included."
    )
    t.curl_imported = "cURL command imported."
    t.file_opened = lambda name: f"“{name}” opened."
    t.file_saved = lambda name: f"Saved as “{name}”, without credentials."
    t.curl_problem = {
        "notCurl": "This is not a cURL command.",
        "noUrl": "The cURL command has no address.",
        "unclosedQuote": "The cURL command has a quote that is not closed: copy it again, complete.",
    }
    t.curl_notice = lambda notice: {
        "dataFile": (
            f"The body comes from a file ({notice.get('option')} @…), which is not read from a command: add it in Body."
        ),
        "multipart": "Multipart forms (-F) are not supported: the form fields were left out.",
        "ignored": f"Options that do not apply here were ignored: {' '.join(notice.get('options', []))}",
        "unknownMethod": f"Method {notice.get('method')} is not supported: choose one in the list.",
    }[notice["code"]]
    t.file_problem = lambda name, problem: {
        "unreadable": f"“{name}” is damaged and cannot be read.",
        "version": f"“{name}” was saved by another version of Api2Data and cannot be read.",
        "notRequest": f"“{name}” is not an Api2Data request or a cURL command.",
        "tooLarge": f"“{name}” is larger than 5 MB.",
        "error": f"“{name}” could not be read.",
    }[problem]
    t.history_title = lambda count: f"History ({_en_number(count)})"
    t.history_save = "Save the history on this computer"
    t.history_save_hint = "Only here: it is never sent anywhere. The body is kept as written."
    t.history_credentials = "Also save tokens, passwords and keys"
    t.history_credentials_hint = (
        "Off: they are left out, along with the values of headers and parameters that look secret. "
        "Turning it off removes them from the history."
    )
    t.history_empty = "The requests you send will appear here."
    t.history_off = "The history is not being saved."
    t.history_with_credentials = "with credentials"
    t.history_no_response = "no response"
    t.history_clear = "Clear history"
    t.history_clear_confirm = "Clear the whole history saved on this computer?"
    t.history_notice = {
        "version": "The saved history is from another version of Api2Data and cannot be read: a new one starts.",
        "damaged": "The saved history is damaged and cannot be read: a new one starts.",
        "unavailable": "The history could not be saved on this computer: it lasts while the app is open.",
    }
    t.dismiss = "Close"
    t.response_title = "Response"
    t.response_empty = "Send a request to see the response here."
    t.response_sending = lambda method, url: f"Waiting for the response to {method} {url}…"
    t.response_tabs = {"body": "Body", "headers": "Headers", "raw": "Raw"}
    t.status_label = "Status"
    t.time_label = "Time"
    t.size_label = "Size"
    t.size_hint = "Size of the body received, after decompression"
    t.type_label = "Type"
    t.no_content_type = "no Content-Type"
    t.redirected_to = "Redirected to"
    t.body_empty = "The response has no body."
    t.body_binary = lambda kind: f"The body is binary content ({kind}) and cannot be shown as text. Save it to open it."
    t.binary_unknown = "unknown type"
    t.invalid_json_response = lambda position, detail: (
        f"The response says it is JSON but it is not valid ({position} · {detail}). It is shown as received."
    )
    t.header_name = "Name"
    t.header_value = "Value"
    t.no_headers = "The response has no headers."
    t.search = "Search"
    t.search_placeholder = "Search in the response"
    t.search_next = "Next"
    t.search_previous = "Previous"
    t.search_not_found = "Not found"
    t.copy = "Copy"
    t.copied = "Copied"
    t.save_response = "Save"
    t.failure = lambda failure, host: {
        "aborted": ("Request cancelled", "Nothing was received."),
        "unreachable": (
            "The server could not be reached",
            f"No connection could be made to “{host}”: the address may not exist, the server may be off, or the "
            "network may block it.",
        ),
        "timeout": (
            "The server took too long",
            f"“{host}” did not answer in 60 seconds. Try again, or check that the address is right.",
        ),
        "tls": (
            "The secure connection failed",
            f"The certificate of “{host}” is not valid or this computer does not trust it, so nothing was sent.",
        ),
        "interrupted": (
            "The response was interrupted",
            "The connection was cut while the response was being received. Send the request again.",
        ),
    }[failure["kind"]]
    t.failure_detail = "Details"
    return t


def _messages_es() -> SimpleNamespace:
    t = SimpleNamespace()
    t.tagline = "Envía peticiones HTTP a una API y revisa la respuesta"
    t.intro_description = (
        "Escribe la dirección, elige el método, añade parámetros, cabeceras, autorización o un body si los necesitas, "
        "y envía. Verás el estado, el tiempo, el tamaño y la respuesta formateada (JSON, XML o texto) con sus "
        "cabeceras. Las peticiones van directamente de este ordenador a la API, sin navegador: CORS no se aplica."
    )
    t.privacy_short = "Procesado en local"
    t.examples_label = "Prueba un ejemplo"
    t.examples = {"github": "GET de un repositorio", "query": "Parámetros de consulta", "post": "POST con JSON"}
    t.example_descriptions = {
        "github": "API pública de GitHub: datos del repositorio de Api2Class",
        "query": "JSONPlaceholder: comentarios filtrados con ?postId=1",
        "post": "JSONPlaceholder: crea una publicación a partir de un body JSON (la API lo simula)",
    }
    t.developed_by = "Desarrollado por"
    t.url_placeholder = "https://api.example.com/users"
    t.method_label = "Método"
    t.url_label = "URL"
    t.send = "Enviar"
    t.sending = "Enviando…"
    t.send_shortcut = "Enviar (Ctrl/Cmd+Enter)"
    t.cancel = "Cancelar"
    t.url_problem = {
        "empty": "Escribe la dirección de la API para enviar la petición.",
        "invalid": "Esta dirección no es válida. Comprueba que no tiene espacios y que el dominio está completo.",
        "unsupportedScheme": "Solo se pueden pedir direcciones http:// y https://.",
    }
    t.scheme_added = lambda url: f"Sin protocolo escrito: se enviará a {url}"
    t.request_title = "Petición"
    t.sections = {"params": "Params", "headers": "Headers", "auth": "Autorización", "body": "Body", "code": "Código"}
    t.key_placeholder = "Clave"
    t.value_placeholder = "Valor"
    t.remove = "Quitar"
    t.enable_row = lambda key: f"Enviar “{key or 'vacío'}”"
    t.params_hint = "Se añaden a la URL. Desmarca una fila para no enviarla sin borrarla."
    t.headers_hint = "Desmarca una fila para no enviarla sin borrarla."
    t.automatic_headers = "Añadidas automáticamente"
    t.header_source = {"user": "", "auth": "de Autorización", "body": "del Body"}
    t.auth_type_label = "Tipo"
    t.auth_types = _AUTH_ES
    t.auth_none = "La petición se envía sin credenciales."
    t.token_label = "Token"
    t.username_label = "Usuario"
    t.password_label = "Contraseña"
    t.api_key_name_label = "Nombre de la clave"
    t.api_key_value_label = "Valor"
    t.api_key_location_label = "Añadir en"
    t.api_key_locations = {"header": "Header", "query": "Query params"}
    t.show = "Mostrar"
    t.hide = "Ocultar"
    t.credentials_note = (
        "Las credenciales solo se guardan en esta ventana mientras está abierta, y solo se envían a la API."
    )
    t.body_modes = {"none": "Ninguno", "json": "JSON", "text": "Texto", "xml": "XML", "form": "Form URL Encoded"}
    t.body_not_allowed = lambda method: (
        f"Las peticiones {method} no llevan body. Elige POST, PUT, PATCH o DELETE para enviar uno."
    )
    t.body_none = "La petición se envía sin body."
    t.format_json = "Formatear"
    t.json_valid = "JSON válido"
    t.content_type_note = lambda value: f"Se envía con Content-Type: {value}"
    t.error_position = lambda line, column: f"Línea {_es_number(line)}, columna {_es_number(column)}"
    t.json_error = _json_error_es
    t.code_target_label = "Lenguaje"
    t.code_unavailable = "El código aparecerá aquí cuando la petición se pueda enviar."
    t.code_credentials_note = "Incluye las credenciales de la petición: ten cuidado con dónde lo pegas."
    t.open_request = "Abrir"
    t.open_request_title = "Abre una petición guardada con Api2Data, o un archivo de texto con un comando cURL"
    t.save_request = "Guardar"
    t.save_request_title = (
        "Guarda esta petición en un archivo para reabrirla o compartirla. No incluye tokens, contraseñas ni claves."
    )
    t.curl_imported = "Comando cURL importado."
    t.file_opened = lambda name: f"“{name}” abierto."
    t.file_saved = lambda name: f"Guardada como “{name}”, sin credenciales."
    t.curl_problem = {
        "notCurl": "Esto no es un comando cURL.",
        "noUrl": "El comando cURL no tiene dirección.",
        "unclosedQuote": "El comando cURL tiene unas comillas sin cerrar: vuelve a copiarlo completo.",
    }
    t.curl_notice = lambda notice: {
        "dataFile": (
            f"El body viene de un archivo ({notice.get('option')} @…), que no se lee desde un comando: añádelo en Body."
        ),
        "multipart": "Los formularios multipart (-F) no se admiten: sus campos se han omitido.",
        "ignored": f"Se han ignorado opciones que aquí no aplican: {' '.join(notice.get('options', []))}",
        "unknownMethod": f"El método {notice.get('method')} no se admite: elige uno de la lista.",
    }[notice["code"]]
    t.file_problem = lambda name, problem: {
        "unreadable": f"“{name}” está dañado y no se puede leer.",
        "version": f"“{name}” se guardó con otra versión de Api2Data y no se puede leer.",
        "notRequest": f"“{name}” no es una petición de Api2Data ni un comando cURL.",
        "tooLarge": f"“{name}” ocupa más de 5 MB.",
        "error": f"No se ha podido leer “{name}”.",
    }[problem]
    t.history_title = lambda count: f"Historial ({_es_number(count)})"
    t.history_save = "Guardar el historial en este ordenador"
    t.history_save_hint = "Solo aquí: nunca se envía a ningún sitio. El body se guarda tal como está escrito."
    t.history_credentials = "Guardar también tokens, contraseñas y claves"
    t.history_credentials_hint = (
        "Desactivado: se omiten, junto con los valores de cabeceras y parámetros que parecen secretos. "
        "Al desactivarlo se quitan del historial."
    )
    t.history_empty = "Las peticiones que envíes aparecerán aquí."
    t.history_off = "El historial no se está guardando."
    t.history_with_credentials = "con credenciales"
    t.history_no_response = "sin respuesta"
    t.history_clear = "Borrar historial"
    t.history_clear_confirm = "¿Borrar todo el historial guardado en este ordenador?"
    t.history_notice = {
        "version": "El historial guardado es de otra versión de Api2Data y no se puede leer: empieza uno nuevo.",
        "damaged": "El historial guardado está dañado y no se puede leer: empieza uno nuevo.",
        "unavailable": (
            "No se ha podido guardar el historial en este ordenador: dura mientras la aplicación esté abierta."
        ),
    }
    t.dismiss = "Cerrar"
    t.response_title = "Respuesta"
    t.response_empty = "Envía una petición para ver aquí la respuesta."
    t.response_sending = lambda method, url: f"Esperando la respuesta a {method} {url}…"
    t.response_tabs = {"body": "Body", "headers": "Headers", "raw": "Raw"}
    t.status_label = "Estado"
    t.time_label = "Tiempo"
    t.size_label = "Tamaño"
    t.size_hint = "Tamaño del body recibido, ya descomprimido"
    t.type_label = "Tipo"
    t.no_content_type = "sin Content-Type"
    t.redirected_to = "Redirigida a"
    t.body_empty = "La respuesta no tiene body."
    t.body_binary = lambda kind: (
        f"El body es contenido binario ({kind}) y no se puede mostrar como texto. Guárdalo para abrirlo."
    )
    t.binary_unknown = "tipo desconocido"
    t.invalid_json_response = lambda position, detail: (
        f"La respuesta dice ser JSON pero no es válida ({position} · {detail}). Se muestra tal como llegó."
    )
    t.header_name = "Nombre"
    t.header_value = "Valor"
    t.no_headers = "La respuesta no tiene cabeceras."
    t.search = "Buscar"
    t.search_placeholder = "Buscar en la respuesta"
    t.search_next = "Siguiente"
    t.search_previous = "Anterior"
    t.search_not_found = "Sin resultados"
    t.copy = "Copiar"
    t.copied = "Copiado"
    t.save_response = "Guardar"
    t.failure = lambda failure, host: {
        "aborted": ("Petición cancelada", "No se ha recibido nada."),
        "unreachable": (
            "No se ha podido conectar con el servidor",
            f"No se ha podido establecer conexión con “{host}”: puede que la dirección no exista, que el "
            "servidor esté apagado o que la red lo bloquee.",
        ),
        "timeout": (
            "El servidor ha tardado demasiado",
            f"“{host}” no ha respondido en 60 segundos. Vuelve a intentarlo o comprueba que la dirección es correcta.",
        ),
        "tls": (
            "La conexión segura ha fallado",
            f"El certificado de “{host}” no es válido o este ordenador no confía en él, así que no se ha enviado nada.",
        ),
        "interrupted": (
            "La respuesta se ha interrumpido",
            "La conexión se ha cortado mientras llegaba la respuesta. Vuelve a enviar la petición.",
        ),
    }[failure["kind"]]
    t.failure_detail = "Detalle"
    return t


def _issue(t: SimpleNamespace, en: bool):
    def issue(item: dict) -> str:
        code = item["code"]
        if code == "url":
            return t.url_problem[item["problem"]]
        if code == "schemeAdded":
            return t.scheme_added(item["url"])
        if code == "body":
            error = item["issue"]["error"]
            return f"Body: {t.error_position(error['line'], error['column'])} · {t.json_error(error)}"
        name = item.get("name", "")
        if en:
            return {
                "headerName": f"“{name}” is not a valid header name: use letters, numbers and - without spaces.",
                "headerValue": (
                    f"The value of “{name}” has characters a header cannot carry (line breaks or symbols such as €)."
                ),
                "authIncomplete": (
                    f"{_AUTH_EN.get(item.get('type'), '')} is selected but incomplete: no credentials will be sent."
                ),
                "authOverridden": (
                    f"There is already a “{name}” header in Headers: it is sent instead of the one from Authorization."
                ),
            }.get(code, "")
        return {
            "headerName": f"“{name}” no es un nombre de cabecera válido: usa letras, números y - sin espacios.",
            "headerValue": (
                f"El valor de “{name}” tiene caracteres que una cabecera no admite (saltos de línea o símbolos como €)."
            ),
            "authIncomplete": (
                f"{_AUTH_ES.get(item.get('type'), '')} está elegido pero incompleto: no se enviarán credenciales."
            ),
            "authOverridden": f"Ya hay una cabecera “{name}” en Headers: se envía esa en lugar de la de Autorización.",
        }.get(code, "")

    return issue


def _build() -> dict[str, SimpleNamespace]:
    en, es = _messages_en(), _messages_es()
    en.issue = _issue(en, True)
    es.issue = _issue(es, False)
    return {"en": en, "es": es}


MESSAGES = _build()


class I18n(QObject):
    """The current language, remembered in the settings. Widgets listen to changed to update their texts."""

    changed = Signal()

    def __init__(self, settings: QSettings):
        super().__init__()
        self._settings = settings
        stored = settings.value("language")
        if stored not in MESSAGES:
            stored = "es" if QLocale.system().name().startswith("es") else "en"
        self.language: str = stored

    @property
    def t(self) -> SimpleNamespace:
        return MESSAGES[self.language]

    def set_language(self, language: str) -> None:
        if language == self.language:
            return
        self.language = language
        self._settings.setValue("language", language)
        self.changed.emit()
