"""The authorization of the request: only the fields of the chosen type are shown. Mirrors
web/src/components/AuthEditor.tsx."""

import copy

from PySide6.QtWidgets import QComboBox, QFormLayout, QLabel, QLineEdit, QStackedWidget, QVBoxLayout, QWidget

from ..core.auth.registry import AUTH_TYPES
from .highlighter import monospace_font
from .i18n import I18n
from .secret_field import SecretField
from .session import Session
from .widgets import muted, on_surface


def _label() -> QLabel:
    label = QLabel()
    label.setProperty("role", "fieldLabel")
    return label


class AuthEditor(QWidget):
    def __init__(self, i18n: I18n, session: Session):
        super().__init__()
        self._i18n = i18n
        self._session = session
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)
        self.type_label = _label()
        self.type = QComboBox()
        self.type.setMaximumWidth(260)
        layout.addWidget(self.type_label)
        layout.addWidget(self.type)

        self.forms = QStackedWidget()
        self.none_note = muted()
        self.token = SecretField()
        self.username = QLineEdit()
        self.username.setFont(monospace_font())
        self.password = SecretField()
        self.key_name = QLineEdit()
        self.key_name.setFont(monospace_font())
        self.key_value = SecretField()
        self.key_location = QComboBox()
        self.labels: dict[str, QLabel] = {}

        def form(*rows: tuple[str, QWidget]) -> QWidget:
            page = QWidget()
            on_surface(page)
            grid = QFormLayout(page)
            grid.setContentsMargins(0, 0, 0, 0)
            grid.setVerticalSpacing(10)
            for name, field in rows:
                self.labels[name] = _label()
                grid.addRow(self.labels[name], field)
            return page

        self._pages = {
            "none": self.none_note,
            "bearer": form(("token", self.token)),
            "basic": form(("username", self.username), ("password", self.password)),
            "apiKey": form(
                ("keyName", self.key_name), ("keyValue", self.key_value), ("keyLocation", self.key_location)
            ),
        }
        for auth_type in AUTH_TYPES:
            self.forms.addWidget(self._pages[auth_type])
        on_surface(self, self.forms)
        layout.addWidget(self.forms)
        self.note = muted()
        layout.addWidget(self.note)
        layout.addStretch()

        self.type.activated.connect(lambda _index: self._change(lambda auth: auth.update(type=self.type.currentData())))
        self.token.edited.connect(lambda text: self._change(lambda auth: auth["settings"]["bearer"].update(token=text)))
        self.username.textEdited.connect(
            lambda text: self._change(lambda auth: auth["settings"]["basic"].update(username=text))
        )
        self.password.edited.connect(
            lambda text: self._change(lambda auth: auth["settings"]["basic"].update(password=text))
        )
        self.key_name.textEdited.connect(
            lambda text: self._change(lambda auth: auth["settings"]["apiKey"].update(name=text))
        )
        self.key_value.edited.connect(
            lambda text: self._change(lambda auth: auth["settings"]["apiKey"].update(value=text))
        )
        self.key_location.activated.connect(
            lambda _index: self._change(
                lambda auth: auth["settings"]["apiKey"].update(location=self.key_location.currentData())
            )
        )
        session.draft_changed.connect(self._sync)
        i18n.changed.connect(self._retranslate)
        self._retranslate()

    def _change(self, edit) -> None:
        auth = copy.deepcopy(self._session.draft["auth"])
        edit(auth)
        self._session.set_auth(auth)

    def _sync(self) -> None:
        auth = self._session.draft["auth"]
        settings = auth["settings"]
        self.type.setCurrentIndex(self.type.findData(auth["type"]))
        self.forms.setCurrentWidget(self._pages[auth["type"]])
        self.token.set_text(settings["bearer"]["token"])
        if self.username.text() != settings["basic"]["username"]:
            self.username.setText(settings["basic"]["username"])
        self.password.set_text(settings["basic"]["password"])
        if self.key_name.text() != settings["apiKey"]["name"]:
            self.key_name.setText(settings["apiKey"]["name"])
        self.key_value.set_text(settings["apiKey"]["value"])
        self.key_location.setCurrentIndex(self.key_location.findData(settings["apiKey"]["location"]))
        self.note.setVisible(auth["type"] != "none")

    def _retranslate(self) -> None:
        t = self._i18n.t
        self.type_label.setText(t.auth_type_label)
        self.type.clear()
        for auth_type in AUTH_TYPES:
            self.type.addItem(t.auth_types[auth_type], auth_type)
        self.key_location.clear()
        for location in ("header", "query"):
            self.key_location.addItem(t.api_key_locations[location], location)
        self.none_note.setText(t.auth_none)
        texts = {
            "token": t.token_label,
            "username": t.username_label,
            "password": t.password_label,
            "keyName": t.api_key_name_label,
            "keyValue": t.api_key_value_label,
            "keyLocation": t.api_key_location_label,
        }
        for name, text in texts.items():
            self.labels[name].setText(text)
        self.token.set_labels(t.show, t.hide, t.token_label)
        self.password.set_labels(t.show, t.hide, t.password_label)
        self.key_value.set_labels(t.show, t.hide, t.api_key_value_label)
        self.note.setText(t.credentials_note)
        self._sync()
