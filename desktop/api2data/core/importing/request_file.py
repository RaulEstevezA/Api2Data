"""Request files: one request saved to share or reopen, never with credentials. Mirrors
web/src/core/import/requestFile.ts."""

import json
import re
from datetime import UTC, datetime
from urllib.parse import urlsplit

from ..js import decode_uri_component
from ..request.draft_format import read_draft, to_stored_draft
from ..request.redact import redact_draft
from ..request.url import is_valid_http_url
from .curl import looks_like_curl, parse_curl

REQUEST_FILE_FORMAT = "api2data-request"
REQUEST_FILE_VERSION = 1
REQUEST_FILE_EXTENSION = ".api2data.json"
# Far above any request; stops a file opened by mistake from freezing the window
MAX_REQUEST_FILE_SIZE = 5 * 1024 * 1024


def _iso(moment: datetime) -> str:
    """Date.toISOString(): UTC with milliseconds."""
    utc = moment.astimezone(UTC)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"


def create_request_file(draft: dict, exported_at: datetime) -> str:
    file = {
        "format": REQUEST_FILE_FORMAT,
        "version": REQUEST_FILE_VERSION,
        "exportedAt": _iso(exported_at),
        "request": to_stored_draft(redact_draft(draft)),
    }
    return json.dumps(file, ensure_ascii=False, indent=2) + "\n"


def request_file_name(draft: dict) -> str:
    """File name from the last part of the address, decoded: "users.api2data.json", "ñandú.api2data.json"."""
    name = ""
    if is_valid_http_url(draft["url"]):
        parts = urlsplit(draft["url"])
        segments = [segment for segment in parts.path.split("/") if segment]
        name = segments[-1] if segments else (parts.hostname or "")
        try:
            name = decode_uri_component(name)
        except ValueError:
            pass
    safe = re.sub(r"[^\w.-]+", "-", name)
    safe = re.sub(r"^[-.]+|[-.]+$", "", safe)[:60]
    return f"{safe or 'request'}{REQUEST_FILE_EXTENSION}"


def read_request_file(text: str, new_id) -> dict:
    """An Api2Data request, or a text file with a cURL command."""
    if looks_like_curl(text):
        curl = parse_curl(text, new_id)
        if curl["ok"]:
            return {"ok": True, "draft": curl["draft"], "source": "curl", "notices": curl["notices"]}
        return {"ok": False, "problem": "unreadable"}
    try:
        data = json.loads(text)
    except ValueError:
        return {"ok": False, "problem": "notRequest"}
    if not isinstance(data, dict) or data.get("format") != REQUEST_FILE_FORMAT:
        return {"ok": False, "problem": "notRequest"}
    if data.get("version") != REQUEST_FILE_VERSION:
        return {"ok": False, "problem": "version"}
    draft = read_draft(data.get("request"), new_id)
    return (
        {"ok": True, "draft": draft, "source": "file", "notices": []}
        if draft
        else {"ok": False, "problem": "unreadable"}
    )
