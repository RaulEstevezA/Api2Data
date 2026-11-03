"""Authorization schemes: what each type adds to the request. Mirrors web/src/core/auth/schemes.ts.

A scheme has apply(settings) → {"headers": [...], "query": [...]} and is_complete(settings) → bool."""

import base64
from collections.abc import Callable
from dataclasses import dataclass

from ..js import trim


def _nothing() -> dict:
    return {"headers": [], "query": []}


@dataclass(frozen=True)
class AuthScheme:
    type: str
    # The headers or query parameters to add; empty when the settings are incomplete
    apply: Callable[[dict], dict]
    # False when something required is missing, so the user can be told nothing will be sent
    is_complete: Callable[[dict], bool]


def base64_utf8(text: str) -> str:
    """Base64 of the UTF-8 bytes, so user names and passwords with accents are encoded as servers expect."""
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _bearer(settings: dict) -> dict:
    token = trim(settings["token"])
    return {"headers": [{"name": "Authorization", "value": f"Bearer {token}"}], "query": []} if token else _nothing()


def _basic(settings: dict) -> dict:
    username, password = settings["username"], settings["password"]
    if not (username or password):
        return _nothing()
    return {
        "headers": [{"name": "Authorization", "value": f"Basic {base64_utf8(f'{username}:{password}')}"}],
        "query": [],
    }


def _api_key(settings: dict) -> dict:
    name = trim(settings["name"])
    if not name:
        return _nothing()
    if settings["location"] == "header":
        return {"headers": [{"name": name, "value": settings["value"]}], "query": []}
    return {"headers": [], "query": [{"key": name, "value": settings["value"]}]}


NO_AUTH = AuthScheme("none", lambda _settings: _nothing(), lambda _settings: True)
BEARER_AUTH = AuthScheme("bearer", _bearer, lambda settings: trim(settings["token"]) != "")
BASIC_AUTH = AuthScheme("basic", _basic, lambda settings: settings["username"] != "")
API_KEY_AUTH = AuthScheme("apiKey", _api_key, lambda settings: trim(settings["name"]) != "" and settings["value"] != "")
