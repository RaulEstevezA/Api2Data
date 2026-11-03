"""Strict JSON (RFC 8259) parser, copied from Api2Class (desktop/api2class/core/json_parser.py).
Mirrors web/src/core/json/parse.ts.

json.loads cannot tell 29.0 from 29 once parsed and its errors differ from the web version, so the
parser is written by hand: numbers keep their text, object entries keep their order (repeated keys
included), and errors say the code, line, column, what was expected and the last property read.
"""

import re
import sys
from dataclasses import dataclass, field
from typing import Literal

JsonErrorCode = Literal[
    "empty",
    "unexpectedEnd",
    "unexpectedCharacter",
    "trailingComma",
    "invalidNumber",
    "invalidEscape",
    "controlCharacter",
    "trailingContent",
    "tooDeep",
]
JsonExpected = Literal["value", "key", "colon", "commaOrBrace", "commaOrBracket"]

# Deeper documents are almost certainly not API responses, and the limit avoids a recursion error
MAX_DEPTH = 512


@dataclass
class JsonObject:
    entries: list[tuple[str, "JsonValue"]]
    kind: str = "object"


@dataclass
class JsonArray:
    items: list["JsonValue"]
    kind: str = "array"


@dataclass
class JsonString:
    value: str
    kind: str = "string"


@dataclass
class JsonNumber:
    text: str
    integer: bool
    kind: str = "number"


@dataclass
class JsonBoolean:
    value: bool
    kind: str = "boolean"


@dataclass
class JsonNull:
    kind: str = "null"


JsonValue = JsonObject | JsonArray | JsonString | JsonNumber | JsonBoolean | JsonNull


@dataclass
class JsonErrorInfo:
    code: JsonErrorCode
    # 1-based, counted in characters (code points), the same as the web version
    line: int
    column: int
    found: str | None = None
    expected: JsonExpected | None = None
    key: str | None = None

    def to_dict(self) -> dict:
        """Same layout as the shared cases: absent fields are left out."""
        result: dict = {"code": self.code, "line": self.line, "column": self.column}
        for name in ("found", "expected", "key"):
            if getattr(self, name) is not None:
                result[name] = getattr(self, name)
        return result


@dataclass
class ParseResult:
    ok: bool
    value: JsonValue | None = None
    error: JsonErrorInfo | None = None


@dataclass
class _Context:
    expected: JsonExpected | None = None
    key: str | None = None


class _JsonError(Exception):
    def __init__(self, code: JsonErrorCode, index: int, context: _Context):
        super().__init__(code)
        self.code = code
        self.index = index
        self.context = context


_NUMBER = re.compile(r"-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?")
_ESCAPES = {'"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t"}
_HEX4 = re.compile(r"[0-9a-fA-F]{4}")
_WHITESPACE = " \t\n\r"


@dataclass
class _Parser:
    source: str
    index: int = 0
    _words: list = field(default_factory=lambda: [("true", True), ("false", False), ("null", None)])

    def fail(self, code: JsonErrorCode, context: _Context | None = None):
        raise _JsonError(code, self.index, context or _Context())

    def unexpected(self, context: _Context):
        self.fail("unexpectedEnd" if self.index >= len(self.source) else "unexpectedCharacter", context)

    def peek(self) -> str | None:
        return self.source[self.index] if self.index < len(self.source) else None

    def skip_whitespace(self):
        while self.index < len(self.source) and self.source[self.index] in _WHITESPACE:
            self.index += 1

    def expect(self, char: str, context: _Context):
        if self.peek() != char:
            self.unexpected(context)
        self.index += 1

    def parse_value(self, depth: int, key: str | None = None) -> JsonValue:
        if depth > MAX_DEPTH:
            self.fail("tooDeep")
        self.skip_whitespace()
        char = self.peek()
        if char == "{":
            return self.parse_object(depth)
        if char == "[":
            return self.parse_array(depth, key)
        if char == '"':
            return JsonString(self.parse_string())
        if char is not None and (char == "-" or "0" <= char <= "9"):
            return self.parse_number()
        for word, value in self._words:
            if self.source.startswith(word, self.index):
                self.index += len(word)
                return JsonNull() if value is None else JsonBoolean(value)
        self.unexpected(_Context("value", key))

    def parse_object(self, depth: int) -> JsonValue:
        entries: list[tuple[str, JsonValue]] = []
        self.index += 1
        self.skip_whitespace()
        if self.peek() == "}":
            self.index += 1
            return JsonObject(entries)
        while True:
            self.skip_whitespace()
            previous = entries[-1][0] if entries else None
            if self.peek() == "}" and entries:
                self.fail("trailingComma", _Context(key=previous))
            if self.peek() != '"':
                self.unexpected(_Context("key", previous))
            key = self.parse_string()
            self.skip_whitespace()
            self.expect(":", _Context("colon", key))
            entries.append((key, self.parse_value(depth + 1, key)))
            self.skip_whitespace()
            if self.peek() == ",":
                self.index += 1
                continue
            self.expect("}", _Context("commaOrBrace", key))
            return JsonObject(entries)

    def parse_array(self, depth: int, key: str | None) -> JsonValue:
        items: list[JsonValue] = []
        self.index += 1
        self.skip_whitespace()
        if self.peek() == "]":
            self.index += 1
            return JsonArray(items)
        while True:
            self.skip_whitespace()
            if self.peek() == "]" and items:
                self.fail("trailingComma", _Context(key=key))
            items.append(self.parse_value(depth + 1, key))
            self.skip_whitespace()
            if self.peek() == ",":
                self.index += 1
                continue
            self.expect("]", _Context("commaOrBracket", key))
            return JsonArray(items)

    def parse_string(self) -> str:
        self.index += 1
        parts: list[str] = []
        source = self.source
        while True:
            if self.index >= len(source):
                self.fail("unexpectedEnd")
            char = source[self.index]
            if char == '"':
                self.index += 1
                return "".join(parts)
            if char < " ":
                self.fail("controlCharacter")
            if char != "\\":
                parts.append(char)
                self.index += 1
                continue
            self.index += 1
            escape = self.peek()
            if escape is None:
                self.fail("unexpectedEnd")
            if escape in _ESCAPES:
                parts.append(_ESCAPES[escape])
                self.index += 1
            elif escape == "u" and _HEX4.fullmatch(source, self.index + 1, self.index + 5):
                code = int(source[self.index + 1 : self.index + 5], 16)
                self.index += 5
                # A surrogate pair written as two escapes (😀) is one character, as in JavaScript
                if 0xD800 <= code <= 0xDBFF and source.startswith("\\u", self.index):
                    low_text = source[self.index + 2 : self.index + 6]
                    if _HEX4.fullmatch(low_text) and 0xDC00 <= int(low_text, 16) <= 0xDFFF:
                        code = 0x10000 + ((code - 0xD800) << 10) + (int(low_text, 16) - 0xDC00)
                        self.index += 6
                parts.append(chr(code))
            else:
                self.fail("invalidEscape")

    def parse_number(self) -> JsonValue:
        match = _NUMBER.match(self.source, self.index)
        if not match:
            self.fail("invalidNumber")
        self.index = match.end()
        # 012, 1., 1e: a number followed by more number characters is malformed, not two values
        if (self.peek() or "") in "0123456789.eE+-" and self.peek() is not None:
            self.fail("invalidNumber")
        return JsonNumber(match.group(0), match.group(1) is None and match.group(2) is None)


def parse_json(text: str) -> ParseResult:
    # A byte order mark is invisible when pasting from some editors
    source = text[1:] if text.startswith("﻿") else text
    parser = _Parser(source)
    # Two calls per level (value and array or object): Python's default limit of 1000 is not enough
    limit = sys.getrecursionlimit()
    sys.setrecursionlimit(max(limit, MAX_DEPTH * 3 + 100))
    try:
        parser.skip_whitespace()
        if parser.index >= len(source):
            parser.fail("empty")
        value = parser.parse_value(1)
        parser.skip_whitespace()
        if parser.index < len(source):
            parser.fail("trailingContent")
        return ParseResult(True, value=value)
    except _JsonError as error:
        return ParseResult(False, error=_error_info(source, error))
    finally:
        sys.setrecursionlimit(limit)


def _error_info(source: str, error: _JsonError) -> JsonErrorInfo:
    before = source[: error.index]
    line_start = before.rfind("\n") + 1
    info = JsonErrorInfo(error.code, before.count("\n") + 1, error.index - line_start + 1)
    if error.index < len(source) and error.code != "empty":
        info.found = source[error.index]
    info.expected = error.context.expected
    info.key = error.context.key
    return info
