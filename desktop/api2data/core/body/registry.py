"""Every body mode, in the order they are offered. Mirrors web/src/core/body/registry.ts."""

from .kinds import FORM_BODY, JSON_BODY, NO_BODY, TEXT_BODY, XML_BODY, BodyKind

_KINDS: dict[str, BodyKind] = {kind.mode: kind for kind in (NO_BODY, JSON_BODY, TEXT_BODY, XML_BODY, FORM_BODY)}

BODY_MODES = list(_KINDS)


def body_kind(mode: str) -> BodyKind:
    return _KINDS[mode]


def default_body() -> dict:
    return {"mode": "none", "text": {"json": "", "text": "", "xml": ""}, "form": []}
