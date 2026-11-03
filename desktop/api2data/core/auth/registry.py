"""Every authorization type, in the order they are offered. Mirrors web/src/core/auth/registry.ts.

An auth config is {"type": ..., "settings": {type: settings}}: the settings of every type are kept, so switching
back and forth does not lose what was typed."""

from .schemes import API_KEY_AUTH, BASIC_AUTH, BEARER_AUTH, NO_AUTH, AuthScheme

_SCHEMES: dict[str, AuthScheme] = {scheme.type: scheme for scheme in (NO_AUTH, BEARER_AUTH, BASIC_AUTH, API_KEY_AUTH)}

AUTH_TYPES = list(_SCHEMES)


def apply_auth(config: dict) -> dict:
    return _SCHEMES[config["type"]].apply(config["settings"][config["type"]])


def is_auth_complete(config: dict) -> bool:
    return _SCHEMES[config["type"]].is_complete(config["settings"][config["type"]])


def default_auth() -> dict:
    return {
        "type": "none",
        "settings": {
            "none": {},
            "bearer": {"token": ""},
            "basic": {"username": "", "password": ""},
            "apiKey": {"name": "X-API-Key", "value": "", "location": "header"},
        },
    }
