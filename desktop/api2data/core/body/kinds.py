"""Body modes: how each one is sent and checked. Mirrors web/src/core/body/kinds.ts.

A body config is {"mode": ..., "text": {"json", "text", "xml"}, "form": [rows]}: the content of every mode is kept,
so switching does not lose what was typed."""

from collections.abc import Callable
from dataclasses import dataclass

from ..http.key_value import active_rows
from ..js import form_encode, trim
from ..json.parse import parse_json


@dataclass(frozen=True)
class BodyKind:
    mode: str
    # Content-Type added when the user has not set one
    content_type: str | None
    # The text sent, or None when there is no body
    serialize: Callable[[dict], str | None]
    # A problem that should stop the request from being sent
    validate: Callable[[dict], dict | None]


def _no_issue(_config: dict) -> None:
    return None


def _validate_json(config: dict) -> dict | None:
    text = config["text"]["json"]
    if not trim(text):
        return None
    result = parse_json(text)
    return None if result.ok else {"code": "invalidJson", "error": result.error.to_dict()}


def _serialize_form(config: dict) -> str | None:
    rows = active_rows(config["form"])
    return form_encode([(row["key"], row["value"]) for row in rows]) if rows else None


NO_BODY = BodyKind("none", None, lambda _config: None, _no_issue)
# Sent exactly as written: re-serializing could change numbers too large for other languages
JSON_BODY = BodyKind(
    "json",
    "application/json",
    lambda config: config["text"]["json"] if trim(config["text"]["json"]) else None,
    _validate_json,
)
TEXT_BODY = BodyKind(
    "text",
    "text/plain;charset=UTF-8",
    lambda config: None if config["text"]["text"] == "" else config["text"]["text"],
    _no_issue,
)
XML_BODY = BodyKind(
    "xml", "application/xml", lambda config: config["text"]["xml"] if trim(config["text"]["xml"]) else None, _no_issue
)
FORM_BODY = BodyKind("form", "application/x-www-form-urlencoded", _serialize_form, _no_issue)
