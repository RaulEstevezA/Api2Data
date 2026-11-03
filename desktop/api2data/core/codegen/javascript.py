"""JavaScript with fetch. Mirrors web/src/core/codegen/javascript.ts."""

from ..js import json_string
from .types import CodeTarget


def _js(text: str) -> str:
    return json_string(text).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def _template(text: str) -> str:
    """Template literal, so a multi-line body stays readable."""
    return "`" + text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"


def _generate(request: dict) -> str:
    options = [f"  method: {_js(request['method'])},"]
    if request["headers"]:
        options.append("  headers: {")
        options.extend(f"    {_js(header['name'])}: {_js(header['value'])}," for header in request["headers"])
        options.append("  },")
    body = request["body"]
    if body is not None:
        options.append(f"  body: {_template(body) if chr(10) in body else _js(body)},")
    return "\n".join(
        [
            f"const response = await fetch({_js(request['url'])}, {{",
            *options,
            "})",
            "",
            "console.log(response.status)",
            "console.log([...response.headers])"
            if request["method"] == "HEAD"
            else "console.log(await response.text())",
        ]
    )


FETCH_TARGET = CodeTarget("fetch", "JavaScript (fetch)", "javascript", _generate)
