"""The history of sent requests. Mirrors web/src/core/history/history.ts.

An entry is {"id", "sentAt" (ISO), "draft", "outcome": {"status"} or {"failure"}, "withCredentials"}."""

from datetime import datetime

from ..js import stringify
from ..request.draft_format import read_draft, to_stored_draft

HISTORY_FORMAT_VERSION = 1
MAX_HISTORY_ENTRIES = 50

# Failures of either version: the browser's (blocked, mixedContent) and the desktop's (unreachable, timeout, tls)
_FAILURES = {"aborted", "offline", "mixedContent", "blocked", "interrupted", "unreachable", "timeout", "tls"}


def _same_request(a: dict, b: dict) -> bool:
    return stringify(to_stored_draft(a)) == stringify(to_stored_draft(b))


def add_entry(entries: list[dict], entry: dict) -> list[dict]:
    """The newest entry first. Repeating the latest request updates it; the oldest entries go beyond the limit."""
    first = entries[0] if entries else None
    repeated = (
        first and _same_request(first["draft"], entry["draft"]) and first["withCredentials"] == entry["withCredentials"]
    )
    rest = entries[1:] if repeated else entries
    return [entry, *rest][:MAX_HISTORY_ENTRIES]


def remove_entry(entries: list[dict], entry_id: str) -> list[dict]:
    return [entry for entry in entries if entry["id"] != entry_id]


def serialize_history(entries: list[dict]) -> str:
    stored = [
        {
            "sentAt": entry["sentAt"],
            "draft": to_stored_draft(entry["draft"]),
            "outcome": entry["outcome"],
            "withCredentials": entry["withCredentials"],
        }
        for entry in entries
    ]
    return stringify({"version": HISTORY_FORMAT_VERSION, "entries": stored})


def _read_outcome(value) -> dict | None:
    if not isinstance(value, dict):
        return None
    status = value.get("status")
    if isinstance(status, (int, float)) and not isinstance(status, bool) and float(status).is_integer():
        return {"status": int(status)}
    if value.get("failure") in _FAILURES:
        return {"failure": value["failure"]}
    return None


def _valid_date(text) -> bool:
    if not isinstance(text, str):
        return False
    try:
        datetime.fromisoformat(text)
        return True
    except ValueError:
        return False


def parse_history(text: str | None, new_id) -> dict:
    """{"ok": True, "entries"} or {"ok": False, "reason": "version" | "damaged"}. Another version or damaged data is
    reported, never dropped silently; entries that cannot be read are skipped."""
    import json

    if text is None:
        return {"ok": True, "entries": []}
    try:
        data = json.loads(text)
    except ValueError:
        return {"ok": False, "reason": "damaged"}
    if not isinstance(data, dict):
        return {"ok": False, "reason": "damaged"}
    if data.get("version") != HISTORY_FORMAT_VERSION or isinstance(data.get("version"), bool):
        return {"ok": False, "reason": "version"}
    entries = data.get("entries")
    if not isinstance(entries, list):
        return {"ok": False, "reason": "damaged"}
    result = []
    for item in entries[:MAX_HISTORY_ENTRIES]:
        if not isinstance(item, dict):
            continue
        draft = read_draft(item.get("draft"), new_id)
        outcome = _read_outcome(item.get("outcome"))
        if not draft or not outcome or not _valid_date(item.get("sentAt")):
            continue
        result.append(
            {
                "id": new_id(),
                "sentAt": item["sentAt"],
                "draft": draft,
                "outcome": outcome,
                "withCredentials": item.get("withCredentials") is True,
            }
        )
    return {"ok": True, "entries": result}
