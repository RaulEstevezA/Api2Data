"""Re-indents valid JSON without parsing its values. Mirrors web/src/core/json/pretty.ts."""


def pretty_json(text: str, indent: str = "  ") -> str:
    """Numbers beyond a double's precision (12345678901234567890) and escapes stay exactly as the server sent them.
    Call it only on valid JSON."""
    out: list[str] = []
    depth = 0
    in_string = False
    index = 0
    length = len(text)

    def newline() -> str:
        return "\n" + indent * depth

    while index < length:
        char = text[index]
        if in_string:
            out.append(char)
            if char == "\\":
                index += 1
                out.append(text[index] if index < length else "")
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
            out.append(char)
        elif char in "{[":
            # Empty objects and lists stay on one line
            following = index + 1
            while following < length and text[following] in " \t\n\r":
                following += 1
            if following < length and text[following] == ("}" if char == "{" else "]"):
                out.append(char + text[following])
                index = following
            else:
                depth += 1
                out.append(char + newline())
        elif char in "}]":
            depth -= 1
            out.append(newline() + char)
        elif char == ",":
            out.append("," + newline())
        elif char == ":":
            out.append(": ")
        elif char not in " \t\n\r":
            out.append(char)
        index += 1
    return "".join(out)
