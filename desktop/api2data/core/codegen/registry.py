"""Every code target, in the order they are offered. Mirrors web/src/core/codegen/registry.ts."""

from .curl import CURL_TARGET
from .javascript import FETCH_TARGET
from .python import REQUESTS_TARGET
from .types import CodeTarget

CODE_TARGETS: tuple[CodeTarget, ...] = (CURL_TARGET, FETCH_TARGET, REQUESTS_TARGET)


def find_code_target(target_id: str) -> CodeTarget:
    return next((target for target in CODE_TARGETS if target.id == target_id), CODE_TARGETS[0])
