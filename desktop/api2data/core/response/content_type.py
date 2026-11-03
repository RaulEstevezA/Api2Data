"""Content type, charset and decoding. Mirrors web/src/core/response/contentType.ts."""

import codecs
import re

from ..js import trim

# Labels the Encoding standard (what TextDecoder follows) maps to another encoding than Python's codec of the same
# name: browsers decode "ISO-8859-1" and "ASCII" as windows-1252
_WHATWG_ALIASES = {
    "iso-8859-1": "cp1252",
    "iso8859-1": "cp1252",
    "latin1": "cp1252",
    "latin-1": "cp1252",
    "l1": "cp1252",
    "us-ascii": "cp1252",
    "ascii": "cp1252",
    "windows-1252": "cp1252",
    "x-user-defined": "cp1252",
}


def parse_content_type(value: str | None) -> dict | None:
    """{"mediaType": lower case without parameters, "charset": str or None}."""
    if value is None or not trim(value):
        return None
    media_type, *parameters = value.split(";")
    charset = None
    for parameter in parameters:
        name, *rest = parameter.split("=")
        if trim(name).lower() == "charset":
            charset = re.sub(r'^"|"$', "", trim("=".join(rest))) or None
    return {"mediaType": trim(media_type).lower(), "charset": charset}


def header_value(headers: list, name: str) -> str | None:
    lower = name.lower()
    return next((value for key, value in headers if key.lower() == lower), None)


def decode_body(data: bytes, charset: str | None) -> str:
    """The body as text, in the charset the server declared (UTF-8 when it declares none or an unknown one).
    Invalid bytes become U+FFFD and a UTF-8 byte order mark is dropped, as TextDecoder does."""
    label = trim(charset or "utf-8").lower()
    encoding = _WHATWG_ALIASES.get(label, label)
    try:
        name = codecs.lookup(encoding).name
    except LookupError:
        name = "utf-8"
    if name == "utf-8":
        name = "utf-8-sig"
    return data.decode(name, errors="replace")
