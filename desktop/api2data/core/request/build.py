"""From what the user typed to the request that will be sent. Mirrors web/src/core/request/build.ts."""

from ..auth.registry import apply_auth, is_auth_complete
from ..body.registry import body_kind
from ..http.key_value import active_rows
from ..http.methods import allows_body
from ..js import trim
from .headers import is_forbidden_header, is_valid_header_name, is_valid_header_value, same_header
from .url import append_query, resolve_url


def _header_issues(headers: list[dict]) -> list[dict]:
    issues = []
    for header in headers:
        name, value = header["name"], header["value"]
        if not is_valid_header_name(name):
            issues.append({"level": "error", "code": "headerName", "name": name})
        elif not is_valid_header_value(value):
            issues.append({"level": "error", "code": "headerValue", "name": name})
        elif is_forbidden_header(name):
            issues.append({"level": "notice", "code": "forbiddenHeader", "name": name})
    return issues


def prepare_request(draft: dict) -> dict:
    """{"request": prepared or None, "issues": [...], "headers": [...]}. Errors stop the request; notices only inform.
    Pure: it runs on every change, and the same draft always gives the same result."""
    issues: list[dict] = []
    resolved = resolve_url(draft["url"])
    if not resolved["ok"]:
        issues.append({"level": "error", "code": "url", "problem": resolved["problem"]})

    # Headers typed by the user come first and win over the automatic ones with the same name
    headers = [
        {"name": trim(row["key"]), "value": row["value"], "source": "user"} for row in active_rows(draft["headers"])
    ]

    def has(name: str) -> bool:
        return any(same_header(header["name"], name) for header in headers)

    auth = draft["auth"]
    if not is_auth_complete(auth):
        issues.append({"level": "notice", "code": "authIncomplete", "type": auth["type"]})
    contribution = apply_auth(auth)
    for header in contribution["headers"]:
        if has(header["name"]):
            issues.append({"level": "notice", "code": "authOverridden", "name": header["name"]})
        else:
            headers.append({**header, "source": "auth"})

    body = None
    if allows_body(draft["method"]):
        kind = body_kind(draft["body"]["mode"])
        body_issue = kind.validate(draft["body"])
        if body_issue:
            issues.append({"level": "error", "code": "body", "issue": body_issue})
        body = kind.serialize(draft["body"])
        if body is not None and kind.content_type and not has("Content-Type"):
            headers.append({"name": "Content-Type", "value": kind.content_type, "source": "body"})

    issues.extend(_header_issues(headers))
    if not resolved["ok"] or any(issue["level"] == "error" for issue in issues):
        return {"request": None, "issues": issues, "headers": headers}

    url = append_query(resolved["url"], contribution["query"])
    if resolved["schemeAdded"]:
        issues.insert(0, {"level": "notice", "code": "schemeAdded", "url": resolved["url"]})
    return {
        "request": {"method": draft["method"], "url": url, "headers": headers, "body": body},
        "issues": issues,
        "headers": headers,
    }
