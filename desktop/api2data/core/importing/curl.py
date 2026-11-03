"""Reading a cURL command into a request draft. Mirrors web/src/core/import/curl.ts. Only reads the text: nothing is
run and no file is opened."""

import re

from ..auth.registry import default_auth
from ..body.registry import default_body
from ..http.methods import is_http_method
from ..js import decode_uri_component, encode_uri_component, is_space
from ..json.parse import parse_json


def looks_like_curl(text: str) -> bool:
    """Whether a pasted text is a cURL command rather than an address."""
    return bool(re.match(r"^\s*curl(\.exe)?\s", text, re.IGNORECASE))


_ANSI_ESCAPES = {
    "n": "\n",
    "t": "\t",
    "r": "\r",
    "\\": "\\",
    "'": "'",
    '"': '"',
    "a": "\x07",
    "b": "\b",
    "e": "\x1b",
    "f": "\f",
    "v": "\v",
}


def tokenize(command: str) -> list[str] | None:
    """Splits a shell command line as bash would: quotes, $'…' escapes, backslashes and line continuations."""
    tokens: list[str] = []
    current = ""
    started = False
    index = 0
    text = re.sub(r"\\\r?\n", " ", command)
    length = len(text)
    while index < length:
        char = text[index]
        if is_space(char):
            if started:
                tokens.append(current)
            current = ""
            started = False
            index += 1
            continue
        started = True
        if char == "'":
            end = text.find("'", index + 1)
            if end == -1:
                return None
            current += text[index + 1 : end]
            index = end + 1
        elif char == "$" and index + 1 < length and text[index + 1] == "'":
            index += 2
            while True:
                if index >= length:
                    return None
                following = text[index]
                if following == "'":
                    break
                if following == "\\":
                    escape = text[index + 1] if index + 1 < length else ""
                    hex_match = re.match(r"x([0-9a-fA-F]{1,2})", text[index + 1 :])
                    unicode_match = re.match(r"u([0-9a-fA-F]{4})", text[index + 1 :])
                    if hex_match:
                        current += chr(int(hex_match.group(1), 16))
                        index += 1 + len(hex_match.group(0))
                    elif unicode_match:
                        current += chr(int(unicode_match.group(1), 16))
                        index += 1 + len(unicode_match.group(0))
                    else:
                        current += _ANSI_ESCAPES.get(escape, f"\\{escape}")
                        index += 2
                    continue
                current += following
                index += 1
            index += 1
        elif char == '"':
            index += 1
            while True:
                if index >= length:
                    return None
                following = text[index]
                if following == '"':
                    break
                # Inside double quotes a backslash only escapes these
                if following == "\\" and index + 1 < length and text[index + 1] in '"\\$`':
                    current += text[index + 1]
                    index += 2
                    continue
                current += following
                index += 1
            index += 1
        elif char == "\\":
            current += text[index + 1] if index + 1 < length else ""
            index += 2
        else:
            current += char
            index += 1
    if started:
        tokens.append(current)
    return tokens


# Options that take a value and are not used, so their value is not mistaken for the URL
_IGNORED_WITH_VALUE = {
    "-o", "--output", "-m", "--max-time", "--connect-timeout", "--retry", "--retry-delay", "--max-redirs", "-w",
    "--write-out", "-x", "--proxy", "--cacert", "--cert", "--key", "-E", "-c", "--cookie-jar", "-r", "--range", "-T",
    "--upload-file", "--resolve",
}  # fmt: skip
# Options without value that do not change the request as Api2Data sends it
_IGNORED_FLAGS = {
    "-L", "--location", "-k", "--insecure", "-s", "--silent", "-S", "--show-error", "-v", "--verbose", "-i",
    "--include", "--compressed", "-f", "--fail", "-N", "--no-buffer", "-#", "--progress-bar", "--http1.1", "--http2",
    "--globoff", "-g",
}  # fmt: skip
_SHORT_WITH_VALUE = set("XHduAebFomxEcrTw")
_SHORT_FLAGS = set("LksSvifNgIG")


def _expand_short(token: str) -> list[str]:
    """Expands grouped short options ("-sSL", "-XPOST") into separate tokens."""
    if not re.match(r"^-[A-Za-z#]{2,}", token) or token.startswith("--"):
        return [token]
    letters = token[1:]
    result = []
    for index, letter in enumerate(letters):
        if letter in _SHORT_WITH_VALUE:
            result.append(f"-{letter}")
            if index + 1 < len(letters):
                result.append(letters[index + 1 :])
            return result
        if letter not in _SHORT_FLAGS:
            return [token]
        result.append(f"-{letter}")
    return result


def _form_rows(data: str, new_id) -> list[dict]:
    def decode(text: str) -> str:
        try:
            return decode_uri_component(text.replace("+", " "))
        except ValueError:
            return text

    rows = []
    for pair in data.split("&"):
        if not pair:
            continue
        key, equals, value = pair.partition("=")
        rows.append({"id": new_id(), "key": decode(key), "value": decode(value if equals else ""), "enabled": True})
    return rows


def _body_mode_for(content_type: str | None, data: str) -> str:
    kind = (content_type or "").lower()
    if "json" in kind:
        return "json"
    if "xml" in kind:
        return "xml"
    if "x-www-form-urlencoded" in kind:
        return "form"
    if content_type:
        return "text"
    # curl sends -d as a form unless told otherwise; JSON sent that way is almost always meant as JSON
    if re.match(r"^\s*[\[{]", data) and parse_json(data).ok:
        return "json"
    return "form" if re.fullmatch(r"[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*", data) else "text"


_DEFAULT_TYPES = {
    "json": re.compile(r"^application/json\s*(;\s*charset=utf-8)?$", re.IGNORECASE),
    "xml": re.compile(r"^application/xml$", re.IGNORECASE),
    "form": re.compile(r"^application/x-www-form-urlencoded\s*(;\s*charset=utf-8)?$", re.IGNORECASE),
}


def _append_query_raw(url: str, query: str) -> str:
    """-G moves the data to the query string as it is written (it is already encoded)."""
    hash_index = url.find("#")
    base = url if hash_index == -1 else url[:hash_index]
    fragment = "" if hash_index == -1 else url[hash_index:]
    return f"{base}{'&' if '?' in base else '?'}{query}{fragment}"


def parse_curl(command: str, new_id) -> dict:
    """{"ok": True, "draft", "notices"} or {"ok": False, "problem": "notCurl" | "noUrl" | "unclosedQuote"}."""
    if not looks_like_curl(command):
        return {"ok": False, "problem": "notCurl"}
    tokens = tokenize(command.strip())
    if tokens is None:
        return {"ok": False, "problem": "unclosedQuote"}
    args = [part for token in tokens[1:] for part in _expand_short(token)]

    method: str | None = None
    url: str | None = None
    head = False
    get = False
    headers: list[dict] = []
    data: list[str] = []
    user: str | None = None
    notices: list[dict] = []
    ignored: list[str] = []

    index = 0

    def value() -> str:
        nonlocal index
        index += 1
        return args[index] if index < len(args) else ""

    def has_header(name: str) -> bool:
        return any(header["name"].lower() == name for header in headers)

    while index < len(args):
        arg = args[index]
        if arg in ("-X", "--request"):
            method = value().upper()
        elif arg in ("-H", "--header"):
            header = value()
            colon = header.find(":")
            if colon > 0:
                headers.append({"name": header[:colon].strip(), "value": header[colon + 1 :].strip()})
        elif arg in ("-d", "--data", "--data-ascii", "--data-binary", "--data-raw"):
            text = value()
            if arg != "--data-raw" and text.startswith("@"):
                notices.append({"code": "dataFile", "option": arg})
            else:
                data.append(text if arg in ("--data-binary", "--data-raw") else re.sub(r"\r?\n", "", text))
        elif arg == "--data-urlencode":
            text = value()
            name, equals, content = text.partition("=")
            data.append(f"{name}={encode_uri_component(content)}" if equals else encode_uri_component(text))
        elif arg == "--json":
            data.append(value())
            if not has_header("content-type"):
                headers.append({"name": "Content-Type", "value": "application/json"})
            if not has_header("accept"):
                headers.append({"name": "Accept", "value": "application/json"})
        elif arg in ("-u", "--user"):
            user = value()
        elif arg in ("-A", "--user-agent"):
            headers.append({"name": "User-Agent", "value": value()})
        elif arg in ("-e", "--referer"):
            headers.append({"name": "Referer", "value": value()})
        elif arg in ("-b", "--cookie"):
            headers.append({"name": "Cookie", "value": value()})
        elif arg in ("-I", "--head"):
            head = True
        elif arg in ("-G", "--get"):
            get = True
        elif arg == "--url":
            url = value()
        elif arg in ("-F", "--form"):
            value()
            if not any(notice["code"] == "multipart" for notice in notices):
                notices.append({"code": "multipart"})
        elif arg in _IGNORED_WITH_VALUE:
            ignored.append(arg)
            value()
        elif arg in _IGNORED_FLAGS or (arg.startswith("-") and len(arg) > 1):
            ignored.append(arg)
        elif url is None:
            url = arg
        index += 1

    if not url:
        return {"ok": False, "problem": "noUrl"}
    if ignored:
        notices.append({"code": "ignored", "options": list(dict.fromkeys(ignored))})

    body = default_body()
    joined = "&".join(data)
    if get and data:
        url = _append_query_raw(url, joined)

    resolved_method = "HEAD" if head else "POST" if data and not get else "GET"
    if method:
        if is_http_method(method):
            resolved_method = method
        else:
            notices.append({"code": "unknownMethod", "method": method})

    auth = default_auth()
    if user is not None:
        username, colon, password = user.partition(":")
        auth["type"] = "basic"
        auth["settings"]["basic"] = {"username": username, "password": password if colon else ""}
    # A bearer token is easier to see and change in Authorization than as a header
    authorization = next(
        (
            position
            for position, header in enumerate(headers)
            if header["name"].lower() == "authorization" and re.match(r"^Bearer\s+\S", header["value"], re.IGNORECASE)
        ),
        -1,
    )
    if authorization != -1 and auth["type"] == "none":
        auth["type"] = "bearer"
        auth["settings"]["bearer"]["token"] = re.sub(
            r"^Bearer\s+", "", headers[authorization]["value"], flags=re.IGNORECASE
        )
        headers.pop(authorization)

    if data and not get:
        content_type_index = next(
            (position for position, header in enumerate(headers) if header["name"].lower() == "content-type"), -1
        )
        content_type = None if content_type_index == -1 else headers[content_type_index]["value"]
        body["mode"] = _body_mode_for(content_type, joined)
        if body["mode"] == "form":
            body["form"] = _form_rows(joined, new_id)
        else:
            body["text"][body["mode"]] = joined
        # The body mode adds this Content-Type itself
        default_type = _DEFAULT_TYPES.get(body["mode"])
        if content_type and default_type and default_type.search(content_type):
            headers.pop(content_type_index)

    return {
        "ok": True,
        "draft": {
            "method": resolved_method,
            "url": url,
            "params": [],
            "headers": [
                {"id": new_id(), "key": header["name"], "value": header["value"], "enabled": True} for header in headers
            ],
            "auth": auth,
            "body": body,
        },
        "notices": notices,
    }
