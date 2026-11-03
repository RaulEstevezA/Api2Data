"""The same request as code to run elsewhere: cURL, JavaScript or Python. Built from what Send would send. Mirrors
web/src/components/CodeSnippet.tsx."""

from PySide6.QtCore import QSettings, QTimer
from PySide6.QtGui import QGuiApplication
from PySide6.QtWidgets import QComboBox, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from ..core.codegen.registry import CODE_TARGETS, find_code_target
from ..core.request.redact import has_credentials
from .code_view import CodeView
from .i18n import I18n
from .session import Session
from .widgets import muted, on_surface


class CodeSnippet(QWidget):
    def __init__(self, i18n: I18n, session: Session, settings: QSettings):
        super().__init__()
        self._i18n = i18n
        self._session = session
        self._settings = settings
        on_surface(self)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)
        bar = QHBoxLayout()
        self.target_label = QLabel()
        self.target_label.setProperty("role", "fieldLabel")
        self.target = QComboBox()
        for target in CODE_TARGETS:
            self.target.addItem(target.label, target.id)
        # Only the choice of language is remembered
        self.target.setCurrentIndex(max(0, self.target.findData(settings.value("codeTarget", CODE_TARGETS[0].id))))
        self.copy = QPushButton()
        bar.addWidget(self.target_label)
        bar.addWidget(self.target)
        bar.addStretch()
        bar.addWidget(self.copy)
        layout.addLayout(bar)
        self.code = CodeView("shell", read_only=True)
        layout.addWidget(self.code, 1)
        self.note = muted()
        layout.addWidget(self.note)
        self._copied = False

        self.target.currentIndexChanged.connect(self._choose)
        self.copy.clicked.connect(self._copy)
        session.draft_changed.connect(self._sync)
        i18n.changed.connect(self._retranslate)
        self._retranslate()

    def _choose(self) -> None:
        self._settings.setValue("codeTarget", self.target.currentData())
        self._sync()

    def _copy(self) -> None:
        QGuiApplication.clipboard().setText(self.code.toPlainText())
        self._copied = True
        self._retranslate()
        QTimer.singleShot(2000, self._uncopy)

    def _uncopy(self) -> None:
        self._copied = False
        self._retranslate()

    def _sync(self) -> None:
        t = self._i18n.t
        request = self._session.preparation["request"]
        target = find_code_target(self.target.currentData())
        self.code.set_language(target.language)
        self.code.set_text_keeping_position(target.generate(request) if request else "")
        self.code.setVisible(request is not None)
        self.copy.setEnabled(request is not None)
        if request is None:
            self.note.setText(t.code_unavailable)
        else:
            self.note.setText(t.code_credentials_note if has_credentials(self._session.draft) else "")
        self.note.setVisible(bool(self.note.text()))

    def _retranslate(self) -> None:
        t = self._i18n.t
        self.target_label.setText(t.code_target_label)
        self.copy.setText(t.copied if self._copied else t.copy)
        self._sync()
