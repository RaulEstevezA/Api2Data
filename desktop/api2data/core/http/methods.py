"""HTTP methods. Mirrors web/src/core/http/methods.ts."""

HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")

# GET and HEAD cannot carry a body; DELETE and OPTIONS may, but almost never do
_WITH_BODY = {"POST", "PUT", "PATCH", "DELETE"}


def allows_body(method: str) -> bool:
    """Whether the method can send a body, so the Body section is only offered where it makes sense."""
    return method in _WITH_BODY


def is_http_method(value) -> bool:
    return value in HTTP_METHODS
