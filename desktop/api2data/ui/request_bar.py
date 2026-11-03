"""Method, address and Send: the whole request for most uses. Mirrors web/src/components/RequestBar.tsx."""

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QGuiApplication, QKeySequence
from PySide6.QtWidgets import QComboBox, QFrame, QHBoxLayout, QLabel, QLineEdit, QMenu, QPushButton, QVBoxLayout

from ..core.http.methods import HTTP_METHODS
from ..core.importing.curl import looks_like_curl
from .highlighter import monospace_font
from .i18n import I18n
from .session import Session
from .theme import DANGER, WARNING


class UrlField(QLineEdit):
    """The address. A pasted cURL command is handed over whole: a line edit would drop the line breaks that
    multi-line commands need."""

    pasted_curl = Signal(str)

    def _clipboard_curl(self) -> str | None:
        text = QGuiApplication.clipboard().text()
        return text if looks_like_curl(text) else None

    def keyPressEvent(self, event) -> None:  # noqa: N802 (Qt's name)
        if event.matches(QKeySequence.StandardKey.Paste):
            command = self._clipboard_curl()
            if command is not None:
                self.pasted_curl.emit(command)
                return
        super().keyPressEvent(event)

    def contextMenuEvent(self, event) -> None:  # noqa: N802 (Qt's name)
        menu: QMenu = self.createStandardContextMenu()
        command = self._clipboard_curl()
        if command is not None:
            for action in menu.actions():
                if action.objectName() == "edit-paste":
                    action.triggered.disconnect()
                    action.triggered.connect(lambda: self.pasted_curl.emit(command))
        menu.exec(event.globalPos())


class RequestBar(QFrame):
    def __init__(self, i18n: I18n, session: Session, on_curl):
        super().__init__()
        self.setObjectName("panel")
        self._i18n = i18n
        self._session = session
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(8)
        row = QHBoxLayout()
        row.setSpacing(8)
        self.method = QComboBox()
        self.method.addItems(HTTP_METHODS)
        self.method.setFont(monospace_font())
        self.method.setMinimumWidth(110)
        self.url = UrlField()
        url_font = monospace_font()
        url_font.setPointSize(13)
        self.url.setFont(url_font)
        self.cancel = QPushButton()
        self.send = QPushButton()
        self.send.setProperty("primary", True)
        self.send.setMinimumWidth(104)
        row.addWidget(self.method)
        row.addWidget(self.url, 1)
        row.addWidget(self.cancel)
        row.addWidget(self.send)
        layout.addLayout(row)
        self.status = QLabel()
        self.status.setWordWrap(True)
        self.status.setTextFormat(Qt.TextFormat.PlainText)
        self.issues = QLabel()
        self.issues.setWordWrap(True)
        self.issues.setTextFormat(Qt.TextFormat.RichText)
        layout.addWidget(self.status)
        layout.addWidget(self.issues)

        self.method.currentTextChanged.connect(
            lambda method: session.set_method(method) if method != session.draft["method"] else None
        )
        self.url.textEdited.connect(self._edit_url)
        self.url.returnPressed.connect(session.send)
        self.url.pasted_curl.connect(on_curl)
        self.send.clicked.connect(session.send)
        self.cancel.clicked.connect(session.cancel)
        session.draft_changed.connect(self._sync)
        session.state_changed.connect(self._sync_state)
        session.status_changed.connect(self._sync_status)
        i18n.changed.connect(self._retranslate)
        self._retranslate()

    def _edit_url(self, text: str) -> None:
        self._session.set_url(text)

    def _sync(self) -> None:
        draft = self._session.draft
        if self.method.currentText() != draft["method"]:
            self.method.setCurrentText(draft["method"])
        if self.url.text() != draft["url"]:
            position = self.url.cursorPosition()
            self.url.setText(draft["url"])
            self.url.setCursorPosition(min(position, len(draft["url"])))
        self._sync_status()

    def _sync_state(self) -> None:
        sending = self._session.sending
        self.send.setEnabled(not sending)
        self.cancel.setVisible(sending)
        self.send.setText(self._i18n.t.sending if sending else self._i18n.t.send)

    def _sync_status(self) -> None:
        t = self._i18n.t
        status = self._session.status
        if status:
            details = status.get("details") or []
            self.status.setText("\n".join([status["text"], *details]))
            self.status.setProperty("role", "error" if status["tone"] == "error" else "success")
        self.status.setVisible(bool(status))
        self.status.style().unpolish(self.status)
        self.status.style().polish(self.status)
        lines = []
        for issue in self._session.bar_issues():
            color = DANGER if issue["level"] == "error" else WARNING
            text = t.issue(issue).replace("&", "&amp;").replace("<", "&lt;")
            lines.append(f'<div style="color: {color};">{text}</div>')
        self.issues.setText("".join(lines))
        self.issues.setVisible(bool(lines))

    def _retranslate(self) -> None:
        t = self._i18n.t
        self.method.setToolTip(t.method_label)
        self.method.setAccessibleName(t.method_label)
        self.url.setPlaceholderText(t.url_placeholder)
        self.url.setAccessibleName(t.url_label)
        self.cancel.setText(t.cancel)
        self.send.setToolTip(t.send_shortcut)
        self._sync_state()
        self._sync_status()
