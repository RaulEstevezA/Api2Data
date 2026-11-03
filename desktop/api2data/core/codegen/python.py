"""Python with requests. Mirrors web/src/core/codegen/python.ts."""

from ..js import json_string
from .types import CodeTarget


def _triple(text: str) -> str:
    """Triple-quoted string for multi-line bodies; backslashes, inner triple quotes and a final quote are escaped."""
    escaped = text.replace("\\", "\\\\").replace('"""', '\\"\\"\\"')
    if escaped.endswith('"'):
        escaped = escaped[:-1] + '\\"'
    return f'"""{escaped}"""'


def _generate(request: dict) -> str:
    # A JSON string is also a valid Python string literal (same escapes)
    args = [f"    {json_string(request['url'])},"]
    if request["headers"]:
        args.append("    headers={")
        args.extend(
            f"        {json_string(header['name'])}: {json_string(header['value'])}," for header in request["headers"]
        )
        args.append("    },")
    body = request["body"]
    # Encoded explicitly: a str body would be sent as Latin-1 and fail with other characters
    if body is not None:
        args.append(f'    data={_triple(body) if chr(10) in body else json_string(body)}.encode("utf-8"),')
    return "\n".join(
        [
            "import requests",
            "",
            f"response = requests.{request['method'].lower()}(",
            *args,
            ")",
            "",
            "print(response.status_code)",
            "print(response.headers)" if request["method"] == "HEAD" else "print(response.text)",
        ]
    )


REQUESTS_TARGET = CodeTarget("python", "Python (requests)", "python", _generate)
