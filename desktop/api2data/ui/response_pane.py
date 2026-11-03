"""The response: status, time, size and type at a glance, then the body formatted, the headers and the raw text.
Mirrors web/src/components/ResponsePane.tsx; failures are the desktop's (there is no CORS)."""

from urllib.parse import urlsplit

from PySide6.QtCore import QTimer
from PySide6.QtGui import QGuiApplication, QKeySequence, QShortcut, QTextDocument
from PySide6.QtWidgets import (
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QPushButton,
    QStackedWidget,
    QTabBar,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .code_view import CodeView
from .i18n import I18n
from .pane import Pane
from .paths import in_downloads
from .session import Session
from .widgets import STATUS_TONES, badge, muted, on_surface, set_role

_EXTENSIONS = {"json": "json", "xml": "xml", "html": "html", "text": "txt"}


def format_bytes(size: int, language: str) -> str:
    """ "512 B", "2.3 KB", "1.4 MB", with the language's decimal separator."""
    if size < 1024:
        return f"{size} B"
    value, unit = size / 1024, "KB"
    for next_unit in ("MB", "GB"):
        if value < 1024:
            break
        value, unit = value / 1024, next_unit
    text = f"{value:.1f}".rstrip("0").rstrip(".") if value < 10 else f"{value:.0f}"
    return f"{text.replace('.', ',') if language == 'es' else text} {unit}"


def format_duration(ms: int, language: str) -> str:
    """ "142 ms" below a second, "1.24 s" above."""
    if ms < 1000:
        return f"{ms} ms"
    text = f"{ms / 1000:.2f}".rstrip("0").rstrip(".")
    return f"{text.replace('.', ',') if language == 'es' else text} s"


def _host(url: str) -> str:
    try:
        return urlsplit(url).netloc or url
    except ValueError:
        return url


def file_name(response: dict) -> str:
    body = response["body"]
    return f"response.{_EXTENSIONS[body['view']['kind']] if body['kind'] == 'text' else 'bin'}"


class FindBar(QWidget):
    """Search inside the editor shown (Ctrl/Cmd+F), with previous and next."""

    def __init__(self):
        super().__init__()
        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(6)
        self.field = QLineEdit()
        self.previous = QPushButton()
        self.previous.setProperty("small", True)
        self.next = QPushButton()
        self.next.setProperty("small", True)
        self.result = muted(wrap=False)
        self.close = QPushButton("×")
        self.close.setProperty("link", True)
        for widget in (self.field, self.previous, self.next, self.result, self.close):
            layout.addWidget(widget, 1 if widget is self.field else 0)
        self.editor: CodeView | None = None
        self.field.returnPressed.connect(lambda: self.find(forward=True))
        self.field.textEdited.connect(lambda _text: self.find(forward=True, restart=True))
        self.next.clicked.connect(lambda: self.find(forward=True))
        self.previous.clicked.connect(lambda: self.find(forward=False))
        self.close.clicked.connect(self.hide)
        self._not_found = "Not found"

    def find(self, forward: bool, restart: bool = False) -> bool:
        editor = self.editor
        text = self.field.text()
        self.result.setText("")
        if editor is None or not text:
            return False
        if restart:
            cursor = editor.textCursor()
            cursor.setPosition(cursor.selectionStart())
            editor.setTextCursor(cursor)
        flags = QTextDocument.FindFlag(0) if forward else QTextDocument.FindFlag.FindBackward
        if editor.find(text, flags):
            return True
        # Wrap around once
        cursor = editor.textCursor()
        cursor.movePosition(cursor.MoveOperation.Start if forward else cursor.MoveOperation.End)
        editor.setTextCursor(cursor)
        if editor.find(text, flags):
            return True
        self.result.setText(self._not_found)
        return False

    def set_texts(self, placeholder: str, previous: str, following: str, not_found: str) -> None:
        self.field.setPlaceholderText(placeholder)
        self.field.setAccessibleName(placeholder)
        self.previous.setText(previous)
        self.next.setText(following)
        self._not_found = not_found


class ResponsePane(Pane):
    def __init__(self, i18n: I18n, session: Session):
        super().__init__()
        self._i18n = i18n
        self._session = session
        self._copied = False

        # Summary: status, time, size, type
        self.summary = QWidget()
        self.summary.setProperty("section", "pane")
        summary_layout = QVBoxLayout(self.summary)
        summary_layout.setContentsMargins(16, 10, 16, 10)
        summary_layout.setSpacing(6)
        row = QHBoxLayout()
        row.setSpacing(20)
        self.labels: dict[str, QLabel] = {}
        self.values: dict[str, QLabel] = {}
        self.status_badge = badge("")
        for key in ("status", "time", "size", "type"):
            pair = QHBoxLayout()
            pair.setSpacing(6)
            label = muted(wrap=False)
            label.setProperty("role", "fieldLabel")
            value = self.status_badge if key == "status" else QLabel()
            if key != "status":
                value.setProperty("role", "mono")
            pair.addWidget(label)
            pair.addWidget(value)
            row.addLayout(pair)
            self.labels[key], self.values[key] = label, value
        row.addStretch()
        summary_layout.addLayout(row)
        self.redirect = muted()
        summary_layout.addWidget(self.redirect)
        self.body.addWidget(self.summary)

        self.tabs = QTabBar()
        self.tabs.setDrawBase(False)
        self.tabs.setExpanding(False)
        for _section in ("body", "headers", "raw"):
            self.tabs.addTab("")
        tabs_row = QWidget()
        tabs_row.setProperty("section", "tabs")
        tabs_layout = QVBoxLayout(tabs_row)
        tabs_layout.setContentsMargins(8, 6, 8, 0)
        tabs_layout.addWidget(self.tabs)
        self.tabs_row = tabs_row
        self.body.addWidget(tabs_row)

        self.find_bar = FindBar()
        self.find_bar.setProperty("section", "pane")
        self.find_bar.hide()
        self.body.addWidget(self.find_bar)

        # Content: a message, the failure box, or the three views
        self.pages = QStackedWidget()
        self.message = muted()
        message_page = QWidget()
        message_layout = QVBoxLayout(message_page)
        message_layout.setContentsMargins(16, 16, 16, 16)
        message_layout.addWidget(self.message)
        message_layout.addStretch()

        self.failure = QFrame()
        self.failure.setObjectName("failure")
        failure_layout = QVBoxLayout(self.failure)
        failure_layout.setContentsMargins(20, 16, 20, 16)
        failure_layout.setSpacing(8)
        self.failure_title = QLabel()
        self.failure_title.setProperty("role", "failureTitle")
        self.failure_text = QLabel()
        self.failure_text.setWordWrap(True)
        self.failure_detail = muted()
        for widget in (self.failure_title, self.failure_text, self.failure_detail):
            failure_layout.addWidget(widget)
        failure_page = QWidget()
        failure_page_layout = QVBoxLayout(failure_page)
        failure_page_layout.setContentsMargins(16, 16, 16, 16)
        failure_page_layout.addWidget(self.failure)
        failure_page_layout.addStretch()

        self.body_view = CodeView("json", read_only=True)
        self.body_note = QLabel()
        self.body_note.setWordWrap(True)
        self.body_note.setProperty("role", "warningBox")
        body_page = QWidget()
        body_layout = QVBoxLayout(body_page)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)
        body_layout.addWidget(self.body_note)
        body_layout.addWidget(self.body_view, 1)
        self.body_message = muted()
        body_message_page = QWidget()
        body_message_layout = QVBoxLayout(body_message_page)
        body_message_layout.setContentsMargins(16, 16, 16, 16)
        body_message_layout.addWidget(self.body_message)
        body_message_layout.addStretch()

        self.headers_table = QTableWidget(0, 2)
        self.headers_table.verticalHeader().hide()
        self.headers_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self.headers_table.horizontalHeader().setStretchLastSection(True)
        self.headers_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.headers_table.setWordWrap(True)
        self.raw_view = CodeView("text", read_only=True)

        self._pages = {}
        for name, page in (
            ("message", message_page),
            ("failure", failure_page),
            ("body", body_page),
            ("bodyMessage", body_message_page),
            ("headers", self.headers_table),
            ("raw", self.raw_view),
        ):
            self.pages.addWidget(page)
            self._pages[name] = page
        on_surface(self.pages, message_page, failure_page, body_page, body_message_page)
        self.body.addWidget(self.pages, 1)

        self.file_label = QLabel()
        self.file_label.setProperty("role", "mono")
        self.search_button = QPushButton()
        self.copy_button = QPushButton()
        self.save_button = QPushButton()
        self.save_button.setProperty("primary", True)
        self.footer.addWidget(self.file_label)
        self.footer.addStretch()
        for button in (self.search_button, self.copy_button, self.save_button):
            self.footer.addWidget(button)

        self.tabs.currentChanged.connect(lambda _index: self._sync())
        self.search_button.clicked.connect(self.open_find)
        self.copy_button.clicked.connect(self._copy)
        self.save_button.clicked.connect(self._save)
        QShortcut(QKeySequence.StandardKey.Find, self, self.open_find)
        session.state_changed.connect(self._sync)
        i18n.changed.connect(self._retranslate)
        self._retranslate()

    # ---------- Actions ----------

    def _section(self) -> str:
        return ("body", "headers", "raw")[self.tabs.currentIndex()]

    def _response(self) -> dict | None:
        state = self._session.state
        return state["response"] if state["status"] == "done" else None

    def _editor(self) -> CodeView | None:
        section = self._section()
        if section == "raw":
            return self.raw_view
        if section == "body" and self.pages.currentWidget() is self._pages["body"]:
            return self.body_view
        return None

    def _copyable(self) -> str:
        response = self._response()
        if not response:
            return ""
        section = self._section()
        if section == "raw":
            return response["raw"]
        if section == "headers":
            return "\n".join(f"{name}: {value}" for name, value in response["headers"])
        return response["body"]["view"]["pretty"] if response["body"]["kind"] == "text" else ""

    def open_find(self) -> None:
        editor = self._editor()
        if editor is None:
            return
        self.find_bar.editor = editor
        self.find_bar.show()
        self.find_bar.field.setFocus()
        self.find_bar.field.selectAll()

    def _copy(self) -> None:
        QGuiApplication.clipboard().setText(self._copyable())
        self._copied = True
        self._retranslate()
        QTimer.singleShot(2000, self._uncopy)

    def _uncopy(self) -> None:
        self._copied = False
        self._retranslate()

    def save_response(self, path: str | None = None) -> None:
        response = self._response()
        if not response:
            return
        if path is None:
            path, _ = QFileDialog.getSaveFileName(self, self._i18n.t.save_response, in_downloads(file_name(response)))
            if not path:
                return
        with open(path, "wb") as file:
            file.write(response["bytes"])

    def _save(self) -> None:
        self.save_response()

    # ---------- Showing the state ----------

    def _sync(self) -> None:
        t = self._i18n.t
        language = self._i18n.language
        state = self._session.state
        response = self._response()
        has_response = response is not None
        self.summary.setVisible(has_response)
        self.tabs_row.setVisible(has_response)
        self.footer.parentWidget().setVisible(has_response)
        if not has_response:
            self.find_bar.hide()

        if state["status"] == "idle":
            self.message.setText(t.response_empty)
            self.pages.setCurrentWidget(self._pages["message"])
        elif state["status"] == "sending":
            self.message.setText(t.response_sending(state["request"]["method"], state["request"]["url"]))
            self.pages.setCurrentWidget(self._pages["message"])
        elif state["status"] == "failed":
            failure = state["failure"]
            title, text = t.failure(failure, _host(state["request"]["url"]))
            self.failure_title.setText(title)
            self.failure_text.setText(text)
            detail = failure.get("detail")
            self.failure_detail.setText(f"{t.failure_detail}: {detail}" if detail else "")
            self.failure_detail.setVisible(bool(detail))
            if failure["kind"] == "aborted":
                self.message.setText(f"{title}. {text}")
                self.pages.setCurrentWidget(self._pages["message"])
            else:
                self.pages.setCurrentWidget(self._pages["failure"])

        if response:
            self._show_response(response, t, language)

    def _show_response(self, response: dict, t, language: str) -> None:
        self.status_badge.setText(f"{response['status']}{' ' + response['reason'] if response['reason'] else ''}")
        self.status_badge.setProperty("tone", STATUS_TONES[response["statusClass"]])
        set_role(self.status_badge, "badge")
        duration = response["durationMs"]
        self.values["time"].setText(format_duration(duration, language) if duration is not None else "—")
        self.values["size"].setText(format_bytes(response["size"], language))
        self.values["size"].setToolTip(t.size_hint)
        content_type = response["contentType"]
        self.values["type"].setText(content_type["mediaType"] if content_type else t.no_content_type)
        self.redirect.setText(f"{t.redirected_to} {response['url']}")
        self.redirect.setVisible(response["redirected"])
        self.tabs.setTabText(1, f"{t.response_tabs['headers']}  {len(response['headers'])}")
        self.file_label.setText(file_name(response))
        self.save_button.setEnabled(response["size"] > 0)

        section = self._section()
        if section == "body":
            body = response["body"]
            if body["kind"] == "empty":
                self.body_message.setText(t.body_empty)
                self.pages.setCurrentWidget(self._pages["bodyMessage"])
            elif body["kind"] == "binary":
                kind = content_type["mediaType"] if content_type else t.binary_unknown
                self.body_message.setText(t.body_binary(kind))
                self.pages.setCurrentWidget(self._pages["bodyMessage"])
            else:
                view = body["view"]
                invalid = view.get("invalidJson")
                self.body_note.setVisible(bool(invalid))
                if invalid:
                    position = t.error_position(invalid["line"], invalid["column"])
                    self.body_note.setText(t.invalid_json_response(position, t.json_error(invalid)))
                self.body_view.set_language(view["language"])
                self.body_view.set_text_keeping_position(view["pretty"])
                self.body_view.highlight_error_line(invalid["line"] if invalid else None)
                self.pages.setCurrentWidget(self._pages["body"])
        elif section == "headers":
            headers = response["headers"]
            self.headers_table.setRowCount(len(headers))
            for index, (name, value) in enumerate(headers):
                self.headers_table.setItem(index, 0, QTableWidgetItem(name))
                self.headers_table.setItem(index, 1, QTableWidgetItem(value))
            self.headers_table.resizeRowsToContents()
            self.pages.setCurrentWidget(self._pages["headers"])
        else:
            self.raw_view.set_text_keeping_position(response["raw"])
            self.pages.setCurrentWidget(self._pages["raw"])
        self.copy_button.setEnabled(bool(self._copyable()))
        self.search_button.setEnabled(self._editor() is not None)
        if self.find_bar.isVisible():
            self.find_bar.editor = self._editor()
            if self.find_bar.editor is None:
                self.find_bar.hide()

    def _retranslate(self) -> None:
        t = self._i18n.t
        self.title.setText(t.response_title)
        for key, text in (
            ("status", t.status_label),
            ("time", t.time_label),
            ("size", t.size_label),
            ("type", t.type_label),
        ):
            self.labels[key].setText(text)
        for index, section in enumerate(("body", "headers", "raw")):
            self.tabs.setTabText(index, t.response_tabs[section])
        self.headers_table.setHorizontalHeaderLabels([t.header_name, t.header_value])
        self.search_button.setText(t.search)
        self.copy_button.setText(t.copied if self._copied else t.copy)
        self.save_button.setText(t.save_response)
        self.find_bar.set_texts(t.search_placeholder, t.search_previous, t.search_next, t.search_not_found)
        self._sync()
