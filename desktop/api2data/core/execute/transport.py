"""Sending a prepared request. Mirrors web/src/core/execute/transport.ts; the failures are the desktop's.

send(request, cancelled) returns {"ok": True, "response": http response} or {"ok": False, "failure": {"kind", ...}}.
The interface depends on this contract, not on urllib, so the tests can provide another implementation."""

from typing import Protocol

# Why no response could be read. Without a browser there is no CORS or mixed content: the server answers, cannot be
# reached, takes too long, or its certificate is not valid.
FAILURE_KINDS = ("aborted", "unreachable", "timeout", "tls", "interrupted")


class Cancelled(Protocol):
    def is_set(self) -> bool: ...


class HttpTransport(Protocol):
    def send(self, request: dict, cancelled: Cancelled) -> dict: ...
