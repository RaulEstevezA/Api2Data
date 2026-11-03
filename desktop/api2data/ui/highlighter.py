"""Syntax highlighting with the same colors as the web editors, adapted from Mapper. Simple per-line rules: enough to
read responses and the generated code, not a full parser."""

from PySide6.QtCore import QRegularExpression
from PySide6.QtGui import QColor, QFont, QSyntaxHighlighter, QTextCharFormat, QTextDocument

from .theme import SYNTAX

_KEYWORDS = {
    "python": "import from as return if else for in is not None True False and or with def class print",
    "javascript": "const let await async return new if else function import export from",
    "shell": "curl",
}

_CONSTANTS = r"\b(true|false|null|None|True|False)\b"


def _format(color: str, italic: bool = False) -> QTextCharFormat:
    text_format = QTextCharFormat()
    text_format.setForeground(QColor(color))
    if italic:
        text_format.setFontItalic(True)
    return text_format


class Highlighter(QSyntaxHighlighter):
    def __init__(self, document: QTextDocument, language: str = "text"):
        super().__init__(document)
        self._rules: list[tuple[QRegularExpression, QTextCharFormat, int]] = []
        self.set_language(language)

    def set_language(self, language: str | None) -> None:
        language = language or "text"
        rules: list[tuple[str, QTextCharFormat, int]] = []
        if language == "json":
            rules.append((_CONSTANTS, _format(SYNTAX["constant"]), 0))
            rules.append((r"-?\b\d+(\.\d+)?([eE][+-]?\d+)?\b", _format(SYNTAX["constant"]), 0))
            rules.append((r'"(\\.|[^"\\])*"', _format(SYNTAX["string"]), 0))
            # Keys: a string followed by a colon
            rules.append((r'("(\\.|[^"\\])*")\s*:', _format(SYNTAX["property"]), 1))
        elif language == "xml":
            rules.append((r"</?[\w:.-]+", _format(SYNTAX["type"]), 0))
            rules.append((r"\b[\w:-]+(?==)", _format(SYNTAX["property"]), 0))
            rules.append((r"\"[^\"]*\"|'[^']*'", _format(SYNTAX["string"]), 0))
            rules.append((r"<\?.*\?>", _format(SYNTAX["function"]), 0))
            rules.append((r"<!--.*-->", _format(SYNTAX["comment"], italic=True), 0))
        elif language in _KEYWORDS:
            rules.append((rf"\b({'|'.join(_KEYWORDS[language].split())})\b", _format(SYNTAX["keyword"]), 0))
            rules.append((_CONSTANTS, _format(SYNTAX["constant"]), 0))
            rules.append((r"\b\d+(\.\d+)?\b", _format(SYNTAX["constant"]), 0))
            if language == "shell":
                # Options: -H, --data-raw
                rules.append((r"(?<=\s)--?[A-Za-z][\w-]*", _format(SYNTAX["property"]), 0))
            rules.append((r'"(\\.|[^"\\])*"', _format(SYNTAX["string"]), 0))
            rules.append((r"'[^']*'", _format(SYNTAX["string"]), 0))
            rules.append((r"`[^`]*`", _format(SYNTAX["string"]), 0))
        self._rules = [(QRegularExpression(pattern), text_format, group) for pattern, text_format, group in rules]
        self.rehighlight()

    def highlightBlock(self, text: str) -> None:  # noqa: N802 (Qt's name)
        for pattern, text_format, group in self._rules:
            matches = pattern.globalMatch(text)
            while matches.hasNext():
                match = matches.next()
                self.setFormat(match.capturedStart(group), match.capturedLength(group), text_format)


def monospace_font() -> QFont:
    font = QFont()
    font.setFamilies(["SF Mono", "Menlo", "Consolas", "DejaVu Sans Mono", "monospace"])
    font.setStyleHint(QFont.StyleHint.Monospace)
    font.setPointSize(12)
    return font
