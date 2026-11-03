"""Header rules. Mirrors web/src/core/request/headers.ts. The desktop sends every header, but the checks are the same
so a request behaves the same in both versions."""

import re

from ..js import trim

# Headers a browser sets itself and drops from fetch (Fetch standard, "forbidden request-header")
_FORBIDDEN = {
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "date",
    "dnt",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "set-cookie",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "via",
}


def is_forbidden_header(name: str) -> bool:
    lower = trim(name).lower()
    return lower in _FORBIDDEN or lower.startswith("proxy-") or lower.startswith("sec-")


# RFC 9110 token
_TOKEN = re.compile(r"[!#$%&'*+\-.^_`|~0-9A-Za-z]+")


def is_valid_header_name(name: str) -> bool:
    return bool(_TOKEN.fullmatch(trim(name)))


def is_valid_header_value(value: str) -> bool:
    """Only Latin-1 without line breaks: anything else cannot be written in an HTTP/1.1 header."""
    return all(ord(char) <= 0xFF and char not in "\r\n\0" for char in value)


def same_header(a: str, b: str) -> bool:
    return trim(a).lower() == trim(b).lower()
