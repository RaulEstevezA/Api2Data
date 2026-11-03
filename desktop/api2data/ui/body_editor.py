"""The body of the request: its type, and an editor or a form. JSON is checked while it is written. Mirrors
web/src/components/BodyEditor.tsx."""

import copy

from PySide6.QtWidgets import QButtonGroup, QHBoxLayout, QLabel, QPushButton, QStackedWidget, QVBoxLayout, QWidget

from ..core.body.registry import BODY_MODES, body_kind
from ..core.js import trim
from ..core.json.pretty import pretty_json
from .code_view import CodeView
from .i18n import I18n
from .key_value_table import KeyValueTable
from .session import Session
from .widgets import muted, on_surface, set_role, small_button

_TEXT_MODES = ("json", "text", "xml")


class BodyEditor(QWidget):
    def __init__(self, i18n: I18n, session: Session):
        super().__init__()
        self._i18n = i18n
        self._session = session
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        modes = QHBoxLayout()
        modes.setSpacing(6)
        self._group = QButtonGroup(self)
        self._modes: dict[str, QPushButton] = {}
        for mode in BODY_MODES:
            button = small_button()
            button.setCheckable(True)
            button.setProperty("toggle", True)
            button.clicked.connect(lambda _=False, mode=mode: self._change(lambda body: body.update(mode=mode)))
            self._group.addButton(button)
            modes.addWidget(button)
            self._modes[mode] = button
        modes.addStretch()
        layout.addLayout(modes)

        self.pages = QStackedWidget()
        self.none_note = muted()
        self.editor = CodeView("json")
        self.editor.setObjectName("bodyEditor")
        self.form = KeyValueTable(i18n)
        form_page = QWidget()
        form_layout = QVBoxLayout(form_page)
        form_layout.setContentsMargins(0, 0, 0, 0)
        form_layout.addWidget(self.form)
        form_layout.addStretch()
        on_surface(self, self.pages, form_page, self.form)
        for page in (self.none_note, self.editor, form_page):
            self.pages.addWidget(page)
        self._form_page = form_page
        layout.addWidget(self.pages, 1)

        status = QHBoxLayout()
        self.status = QLabel()
        self.status.setWordWrap(True)
        self.format = small_button()
        status.addWidget(self.status, 1)
        status.addWidget(self.format)
        layout.addLayout(status)

        # Changes made by _sync (the text or its highlighting) are not the user's
        self._syncing = False
        self.editor.textChanged.connect(self._edit_text)
        self.form.changed.connect(lambda rows: self._change(lambda body: body.update(form=rows)))
        self.format.clicked.connect(self._format)
        session.draft_changed.connect(self._sync)
        session.loaded.connect(self._sync)
        i18n.changed.connect(self._retranslate)
        self._retranslate()

    def _change(self, edit) -> None:
        body = copy.deepcopy(self._session.draft["body"])
        edit(body)
        self._session.set_body(body)

    def _edit_text(self) -> None:
        if self._syncing:
            return
        mode = self._session.draft["body"]["mode"]
        if mode in _TEXT_MODES and self.editor.toPlainText() != self._session.draft["body"]["text"][mode]:
            text = self.editor.toPlainText()
            self._change(lambda body: body["text"].update({mode: text}))

    def _format(self) -> None:
        text = self._session.draft["body"]["text"]["json"]
        self._change(lambda body: body["text"].update(json=pretty_json(text)))

    def _sync(self) -> None:
        self._syncing = True
        try:
            self._show()
        finally:
            self._syncing = False

    def _show(self) -> None:
        t = self._i18n.t
        body = self._session.draft["body"]
        mode = body["mode"]
        self._modes[mode].setChecked(True)
        if mode == "none":
            self.pages.setCurrentWidget(self.none_note)
        elif mode == "form":
            self.pages.setCurrentWidget(self._form_page)
            self.form.sync(body["form"])
        else:
            self.pages.setCurrentWidget(self.editor)
            self.editor.set_language(None if mode == "text" else mode)
            if self.editor.toPlainText() != body["text"][mode]:
                self.editor.setPlainText(body["text"][mode])

        kind = body_kind(mode)
        issue = kind.validate(body)
        self.editor.highlight_error_line(issue["error"]["line"] if issue else None)
        self.format.setVisible(mode == "json")
        self.format.setEnabled(issue is None and bool(trim(body["text"]["json"])))
        self.status.setVisible(mode != "none")
        if issue:
            error = issue["error"]
            self.status.setText(f"{t.error_position(error['line'], error['column'])} · {t.json_error(error)}")
            set_role(self.status, "error")
        elif mode == "json" and trim(body["text"]["json"]):
            self.status.setText(t.json_valid)
            set_role(self.status, "success")
        else:
            self.status.setText(t.content_type_note(kind.content_type) if kind.content_type else "")
            set_role(self.status, "muted")

    def _retranslate(self) -> None:
        t = self._i18n.t
        for mode, button in self._modes.items():
            button.setText(t.body_modes[mode])
        self.none_note.setText(t.body_none)
        self.format.setText(t.format_json)
        self._sync()
