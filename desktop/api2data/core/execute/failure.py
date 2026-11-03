"""Explaining why there is no response, from the error Python raised."""

import socket
import ssl
import urllib.error


def _reason(error: BaseException) -> BaseException:
    """The error behind urllib's wrapper."""
    if isinstance(error, urllib.error.URLError) and isinstance(error.reason, BaseException):
        return error.reason
    return error


def describe(error: BaseException) -> str:
    reason = _reason(error)
    return str(reason) or reason.__class__.__name__


def classify_failure(error: BaseException, cancelled: bool) -> dict:
    """The most precise explanation of a request that produced no response."""
    if cancelled:
        return {"kind": "aborted"}
    reason = _reason(error)
    if isinstance(reason, (TimeoutError, socket.timeout)):
        return {"kind": "timeout"}
    if isinstance(reason, ssl.SSLError | ssl.CertificateError):
        return {"kind": "tls", "detail": describe(error)}
    return {"kind": "unreachable", "detail": describe(error)}
