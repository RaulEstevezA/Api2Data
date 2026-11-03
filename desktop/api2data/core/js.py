"""JavaScript string behavior the port depends on, so both versions give the same results (shared/test-cases)."""

import json
import re

# What String.prototype.trim() and the \s class remove: unlike str.strip(), the byte order mark is included and the
# ASCII separators \x1c-\x1f are not
WHITESPACE = "\t\n\v\f\r                  　﻿"


def trim(text: str) -> str:
    return text.strip(WHITESPACE)


def is_space(char: str) -> bool:
    """The \\s class of a JavaScript regular expression."""
    return char != "" and char in WHITESPACE


# encodeURIComponent leaves these as they are, besides ASCII letters and digits
_URI_COMPONENT_SAFE = set("-_.!~*'()")
# URLSearchParams (application/x-www-form-urlencoded) leaves these, and writes a space as "+"
_FORM_SAFE = set("*-._")


def _percent_encode(text: str, safe: set[str], space: str | None = None) -> str:
    out = []
    for char in text:
        if char.isascii() and (char.isalnum() or char in safe):
            out.append(char)
        elif char == " " and space is not None:
            out.append(space)
        else:
            out.append("".join(f"%{byte:02X}" for byte in char.encode("utf-8")))
    return "".join(out)


def encode_uri_component(text: str) -> str:
    return _percent_encode(text, _URI_COMPONENT_SAFE)


def form_encode(pairs: list[tuple[str, str]]) -> str:
    """new URLSearchParams(pairs).toString()."""
    return "&".join(
        f"{_percent_encode(key, _FORM_SAFE, '+')}={_percent_encode(value, _FORM_SAFE, '+')}" for key, value in pairs
    )


_ESCAPE = re.compile(r"(?:%[0-9A-Fa-f]{2})+")


def decode_uri_component(text: str) -> str:
    """decodeURIComponent: raises ValueError on a lone "%" or bytes that are not UTF-8, as it throws URIError."""
    if re.search(r"%(?![0-9A-Fa-f]{2})", text):
        raise ValueError("malformed URI sequence")

    def decode(match: re.Match) -> str:
        data = bytes(int(match.group(0)[index + 1 : index + 3], 16) for index in range(0, len(match.group(0)), 3))
        return data.decode("utf-8")  # strict, like JavaScript

    return _ESCAPE.sub(decode, text)


def stringify(value) -> str:
    """JSON.stringify(value) without spaces."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def json_string(text: str) -> str:
    """JSON.stringify of a string."""
    return json.dumps(text, ensure_ascii=False)
