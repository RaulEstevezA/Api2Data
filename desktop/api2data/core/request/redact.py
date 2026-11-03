"""Removing secrets before a request is saved or shared. Mirrors web/src/core/request/redact.ts."""

import re

from ..auth.registry import default_auth
from .url import split_url, url_with_params

# Names that usually carry a secret, in headers and query strings
_SENSITIVE = re.compile(
    r"auth|token|secret|passw|pwd|api[-_]?key|apikey|^key$|access[-_]?key|session|cookie|signature|^sig$|credential|client[-_]?secret",
    re.IGNORECASE,
)


def is_sensitive_name(name: str) -> bool:
    from ..js import trim

    return bool(_SENSITIVE.search(trim(name)))


def _redact_auth(auth: dict) -> dict:
    """Settings without secrets: the chosen type, the API key name and where it goes, and the Basic user name."""
    empty = default_auth()
    settings = auth["settings"]
    return {
        "type": auth["type"],
        "settings": {
            **empty["settings"],
            "basic": {"username": settings["basic"]["username"], "password": ""},
            "apiKey": {**settings["apiKey"], "value": ""},
        },
    }


def _clear_sensitive(rows: list[dict]) -> list[dict]:
    return [{**row, "value": ""} if is_sensitive_name(row["key"]) else row for row in rows]


def has_credentials(draft: dict) -> bool:
    """Whether the draft holds something that looks like a credential, so saving it can be offered as a choice."""
    auth = draft["auth"]
    settings = auth["settings"]
    auth_secret = (
        (auth["type"] == "bearer" and settings["bearer"]["token"] != "")
        or (auth["type"] == "basic" and settings["basic"]["password"] != "")
        or (auth["type"] == "apiKey" and settings["apiKey"]["value"] != "")
    )

    def sensitive_row(rows: list[dict]) -> bool:
        return any(is_sensitive_name(row["key"]) and row["value"] != "" for row in rows)

    return (
        auth_secret
        or sensitive_row(draft["headers"])
        or sensitive_row(draft["params"])
        or bool(re.search(r"//[^/@?#]*:[^/@?#]*@", draft["url"]))
    )


def redact_draft(draft: dict) -> dict:
    """The draft without what usually is a secret: tokens, passwords, API key values, sensitive header and query
    values, and user info in the URL. The body is kept as written: it is the request itself."""
    params = _clear_sensitive(draft["params"])
    parts = split_url(draft["url"])
    clean_base = re.sub(r"^([a-z][a-z\d+.-]*://)[^/@?#]*@", r"\1", parts["base"], flags=re.IGNORECASE)
    # The params mirror the query string, so the URL is rebuilt from the cleaned rows
    url = url_with_params(f"{clean_base}{parts['hash']}", params)
    return {
        **draft,
        "url": url,
        "params": params,
        "headers": _clear_sensitive(draft["headers"]),
        "auth": _redact_auth(draft["auth"]),
    }
