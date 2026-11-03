"""How a text body is shown: JSON, XML, HTML or text. Mirrors web/src/core/response/viewers.ts.

A view is {"kind", "language", "raw", "pretty"} plus "invalidJson" when the content type says JSON but the text is
not valid JSON."""

import re
from collections.abc import Callable
from dataclasses import dataclass

from ..json.parse import parse_json
from ..json.pretty import pretty_json
from .xml import pretty_xml

# Formatting is skipped above this size so the window stays responsive; the text is shown as received
MAX_FORMAT_LENGTH = 8 * 1024 * 1024


@dataclass(frozen=True)
class Viewer:
    kind: str
    # Declared by the Content-Type
    matches_type: Callable[[str], bool]
    # Recognized from the text when the Content-Type is missing or generic
    looks_like: Callable[[str], bool]
    view: Callable[[str], dict]


def _view_json(text: str) -> dict:
    result = parse_json(text)
    if not result.ok:
        return {"kind": "json", "language": "json", "raw": text, "pretty": text, "invalidJson": result.error.to_dict()}
    return {
        "kind": "json",
        "language": "json",
        "raw": text,
        "pretty": text if len(text) > MAX_FORMAT_LENGTH else pretty_json(text),
    }


def _view_xml(text: str) -> dict:
    pretty = pretty_xml(text) if len(text) <= MAX_FORMAT_LENGTH else None
    return {"kind": "xml", "language": "xml", "raw": text, "pretty": pretty or text}


_JSON_VIEWER = Viewer(
    "json",
    lambda media_type: media_type in ("application/json", "text/json") or media_type.endswith("+json"),
    lambda text: bool(re.match(r"^\s*[\[{]", text)) and parse_json(text).ok,
    _view_json,
)
_XML_VIEWER = Viewer(
    "xml",
    lambda media_type: media_type in ("application/xml", "text/xml") or media_type.endswith("+xml"),
    lambda text: bool(re.match(r"^\s*<\?xml", text)),
    _view_xml,
)
_HTML_VIEWER = Viewer(
    "html",
    lambda media_type: media_type in ("text/html", "application/xhtml+xml"),
    lambda text: bool(re.match(r"^\s*<!doctype html|^\s*<html[\s>]", text, re.IGNORECASE)),
    lambda text: {"kind": "html", "language": None, "raw": text, "pretty": text},
)
_TEXT_VIEWER = Viewer(
    "text",
    lambda _media_type: True,
    lambda _text: True,
    lambda text: {"kind": "text", "language": None, "raw": text, "pretty": text},
)

# Specific viewers first; plain text accepts anything. A new format is one more viewer in this list.
_VIEWERS = (_JSON_VIEWER, _XML_VIEWER, _HTML_VIEWER, _TEXT_VIEWER)

# Types that say nothing about the content, so the text decides
_GENERIC_TYPES = {"text/plain", "application/octet-stream", "binary/octet-stream"}


def view_text(text: str, media_type: str | None) -> dict:
    declared = (
        next((viewer for viewer in _VIEWERS if viewer.matches_type(media_type)), None)
        if media_type and media_type not in _GENERIC_TYPES
        else None
    )
    viewer = declared if declared and declared is not _TEXT_VIEWER else next(v for v in _VIEWERS if v.looks_like(text))
    return viewer.view(text)


_BINARY_TYPES = re.compile(
    r"^(image|audio|video|font)/|^application/(pdf|zip|gzip|x-gzip|x-tar|x-7z-compressed|wasm|vnd\.ms-excel"
    r"|vnd\.openxmlformats|msword|x-protobuf|protobuf)"
)


def is_binary(media_type: str | None, data: bytes) -> bool:
    """Whether the body cannot be shown as text: declared as a binary format, or full of control characters."""
    if media_type == "image/svg+xml":
        return False
    if media_type and _BINARY_TYPES.search(media_type):
        return True
    sample = data[:1024]
    control = 0
    for byte in sample:
        if byte == 0:
            return True
        if byte < 9 or 13 < byte < 32:
            control += 1
    return len(sample) > 0 and control / len(sample) > 0.1
