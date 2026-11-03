"""A response ready to be shown. Mirrors web/src/core/response/process.ts.

An HTTP response is {"status", "statusText", "url", "redirected", "headers": [[name, value]], "bytes",
"durationMs" (None when not measured), "origin": "sent" or "pasted"}."""

from .content_type import decode_body, header_value, parse_content_type
from .status import reason_phrase, status_class
from .viewers import is_binary, view_text


def _body_of(data: bytes, content_type: dict | None, charset: str | None) -> dict:
    if len(data) == 0:
        return {"kind": "empty"}
    media_type = content_type["mediaType"] if content_type else None
    if is_binary(media_type, data):
        return {"kind": "binary"}
    return {"kind": "text", "view": view_text(decode_body(data, charset), media_type)}


def process_response(response: dict) -> dict:
    content_type = parse_content_type(header_value(response["headers"], "content-type"))
    reason = reason_phrase(response["status"], response["statusText"])
    # Pasted text was decoded by the terminal and stored as UTF-8, whatever charset the server declared
    charset = "utf-8" if response["origin"] == "pasted" else (content_type["charset"] if content_type else None)
    body = _body_of(response["bytes"], content_type, charset)
    status_line = f"HTTP {response['status']}{' ' + reason if reason else ''}"
    header_lines = [f"{name}: {value}" for name, value in response["headers"]]
    raw_body = body["view"]["raw"] if body["kind"] == "text" else ""
    return {
        "status": response["status"],
        "reason": reason,
        "statusClass": status_class(response["status"]),
        "url": response["url"],
        "redirected": response["redirected"],
        "headers": response["headers"],
        "contentType": content_type,
        "size": len(response["bytes"]),
        "bytes": response["bytes"],
        "durationMs": response["durationMs"],
        "origin": response["origin"],
        "body": body,
        "raw": "\n".join([status_line, *header_lines, "", raw_body]),
    }
