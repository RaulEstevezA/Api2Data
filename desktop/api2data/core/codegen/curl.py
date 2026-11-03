"""cURL command. Mirrors web/src/core/codegen/curl.ts."""

from .types import CodeTarget


def shell_quote(text: str) -> str:
    """POSIX shell single quotes: everything is literal except the quote itself."""
    return "'" + text.replace("'", "'\\''") + "'"


def curl_command(request: dict, options: dict | None = None) -> str:
    """With include, curl also prints the status line and the headers (-i)."""
    include = bool((options or {}).get("include"))
    method = request["method"]
    flag = "" if method == "GET" else "--head " if method == "HEAD" else f"-X {method} "
    lines = [f"curl {'-i ' if include and method != 'HEAD' else ''}{flag}{shell_quote(request['url'])}"]
    lines.extend(f"-H {shell_quote(header['name'] + ': ' + header['value'])}" for header in request["headers"])
    if request["body"] is not None:
        lines.append(f"--data-raw {shell_quote(request['body'])}")
    return " \\\n  ".join(lines)


CURL_TARGET = CodeTarget("curl", "cURL", "shell", lambda request: curl_command(request))
