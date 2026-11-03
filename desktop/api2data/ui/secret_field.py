"""Password-like field with a Show button: tokens and passwords are hidden on screen by default."""

from PySide6.QtCore import Signal
from PySide6.QtWidgets import QHBoxLayout, QLineEdit, QPushButton, QWidget

from .highlighter import monospace_font


class SecretField(QWidget):
    edited = Signal(str)

    def __init__(self):
        super().__init__()
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)
        self.field = QLineEdit()
        self.field.setFont(monospace_font())
        self.field.setEchoMode(QLineEdit.EchoMode.Password)
        self.toggle = QPushButton()
        self.toggle.setCheckable(True)
        self.toggle.setProperty("toggle", True)
        layout.addWidget(self.field, 1)
        layout.addWidget(self.toggle)
        self.field.textEdited.connect(self.edited)
        self.toggle.toggled.connect(self._show)
        self._labels = ("Show", "Hide")

    def _show(self, visible: bool) -> None:
        self.field.setEchoMode(QLineEdit.EchoMode.Normal if visible else QLineEdit.EchoMode.Password)
        self.toggle.setText(self._labels[1] if visible else self._labels[0])

    def set_labels(self, show: str, hide: str, name: str) -> None:
        self._labels = (show, hide)
        self.toggle.setText(hide if self.toggle.isChecked() else show)
        self.field.setAccessibleName(name)

    def set_text(self, text: str) -> None:
        if self.field.text() != text:
            self.field.setText(text)
