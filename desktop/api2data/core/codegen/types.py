"""A code target writes the code that sends the same request from somewhere else. Mirrors
web/src/core/codegen/types.ts."""

from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class CodeTarget:
    id: str
    # Name shown in the selector: "cURL", "JavaScript (fetch)"
    label: str
    # Highlighting of the code: "shell", "javascript" or "python"
    language: str
    generate: Callable[[dict], str]
