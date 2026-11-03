"""A draft as stored (history) or exported (request files), and reading it back. Mirrors
web/src/core/request/draftFormat.ts."""

from ..auth.registry import AUTH_TYPES, default_auth
from ..body.registry import BODY_MODES, default_body
from ..http.methods import is_http_method


def _to_stored(rows: list[dict]) -> list[dict]:
    return [{"key": row["key"], "value": row["value"], "enabled": row["enabled"]} for row in rows]


def to_stored_draft(draft: dict) -> dict:
    """The same fields without row ids, which only make sense while the window is open."""
    return {
        "method": draft["method"],
        "url": draft["url"],
        "params": _to_stored(draft["params"]),
        "headers": _to_stored(draft["headers"]),
        "auth": draft["auth"],
        "body": {**draft["body"], "form": _to_stored(draft["body"]["form"])},
    }


def _is_record(value) -> bool:
    return isinstance(value, dict)


def _text(value, fallback: str = "") -> str:
    return value if isinstance(value, str) else fallback


# Generous limits: they only stop a damaged or hostile file from freezing the window
_MAX_ROWS = 500
_MAX_TEXT = 5 * 1024 * 1024
_MISSING = object()


def _read_rows(value, new_id) -> list[dict] | None:
    if value is _MISSING:
        return []
    if not isinstance(value, list) or len(value) > _MAX_ROWS:
        return None
    rows = []
    for item in value:
        if not _is_record(item) or not isinstance(item.get("key"), str) or not isinstance(item.get("value"), str):
            return None
        rows.append(
            {"id": new_id(), "key": item["key"], "value": item["value"], "enabled": item.get("enabled") is not False}
        )
    return rows


def _read_auth(value) -> dict:
    auth = default_auth()
    if not _is_record(value):
        return auth
    if value.get("type") in AUTH_TYPES:
        auth["type"] = value["type"]
    settings = value.get("settings") if _is_record(value.get("settings")) else {}
    bearer = settings.get("bearer") if _is_record(settings.get("bearer")) else {}
    basic = settings.get("basic") if _is_record(settings.get("basic")) else {}
    api_key = settings.get("apiKey") if _is_record(settings.get("apiKey")) else {}
    auth["settings"]["bearer"] = {"token": _text(bearer.get("token"))}
    auth["settings"]["basic"] = {"username": _text(basic.get("username")), "password": _text(basic.get("password"))}
    auth["settings"]["apiKey"] = {
        "name": _text(api_key.get("name"), auth["settings"]["apiKey"]["name"]),
        "value": _text(api_key.get("value")),
        "location": "query" if api_key.get("location") == "query" else "header",
    }
    return auth


def _read_body(value, new_id) -> dict | None:
    body = default_body()
    if value is _MISSING:
        return body
    if not _is_record(value):
        return None
    if value.get("mode") in BODY_MODES:
        body["mode"] = value["mode"]
    texts = value.get("text") if _is_record(value.get("text")) else {}
    for mode in ("json", "text", "xml"):
        content = _text(texts.get(mode))
        if len(content) > _MAX_TEXT:
            return None
        body["text"][mode] = content
    form = _read_rows(value.get("form", _MISSING), new_id)
    if form is None:
        return None
    body["form"] = form
    return body


def read_draft(value, new_id) -> dict | None:
    """Reads a stored or imported draft. Anything malformed gives None; missing optional parts take their defaults.
    The caller loads it through the draft reducer, which reads the enabled params again from the URL."""
    if not _is_record(value):
        return None
    if (
        not is_http_method(value.get("method"))
        or not isinstance(value.get("url"), str)
        or len(value["url"]) > 64 * 1024
    ):
        return None
    params = _read_rows(value.get("params", _MISSING), new_id)
    headers = _read_rows(value.get("headers", _MISSING), new_id)
    body = _read_body(value.get("body", _MISSING), new_id)
    if params is None or headers is None or body is None:
        return None
    return {
        "method": value["method"],
        "url": value["url"],
        "params": params,
        "headers": headers,
        "auth": _read_auth(value.get("auth")),
        "body": body,
    }
