"""Indenting XML one element per line. Mirrors web/src/core/response/xml.ts."""

import re

from ..js import trim

_TOKEN = re.compile(r"<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|</?[^>]+>|[^<]+")
_NAME = re.compile(r"^</?\s*([^\s/>]+)")


def _tokenize(text: str) -> list[dict]:
    tokens = []
    for part in _TOKEN.findall(text):
        if not part.startswith("<"):
            tokens.append({"kind": "text", "text": part, "name": ""})
        elif part.startswith("<!") or part.startswith("<?"):
            tokens.append({"kind": "other", "text": part, "name": ""})
        else:
            match = _NAME.match(part)
            name = match.group(1) if match else ""
            if part.startswith("</"):
                tokens.append({"kind": "close", "text": part, "name": name})
            else:
                tokens.append({"kind": "self" if part.endswith("/>") else "open", "text": part, "name": name})
    return tokens


def pretty_xml(text: str, indent: str = "  ") -> str | None:
    """None when the tags do not match, so the caller shows the text as it came instead of a misleading layout.
    Text inside elements is kept, only trimmed."""
    tokens = _tokenize(trim(text))
    lines: list[str] = []
    stack: list[str] = []
    index = 0
    while index < len(tokens):
        token = tokens[index]
        pad = indent * len(stack)
        kind = token["kind"]
        if kind == "text":
            if trim(token["text"]):
                lines.append(pad + trim(token["text"]))
        elif kind == "close":
            if not stack or stack.pop() != token["name"]:
                return None
            lines.append(indent * len(stack) + token["text"])
        elif kind == "open":
            following = tokens[index + 1] if index + 1 < len(tokens) else None
            after = tokens[index + 2] if index + 2 < len(tokens) else None
            # <name>short text</name> on one line
            if (
                following
                and following["kind"] == "text"
                and after
                and after["kind"] == "close"
                and after["name"] == token["name"]
            ):
                lines.append(pad + token["text"] + trim(following["text"]) + after["text"])
                index += 2
            elif following and following["kind"] == "close" and following["name"] == token["name"]:
                lines.append(pad + token["text"] + following["text"])
                index += 1
            else:
                lines.append(pad + token["text"])
                stack.append(token["name"])
        else:
            lines.append(pad + token["text"])
        index += 1
    return "\n".join(lines) if not stack else None
