"""Main window: the presentation card (name with its icon, language switcher and examples), the request bar, the
history, the request and response panes, and the credit. Like Mapper's desktop app, it has no links: the app works on
its own."""

from pathlib import Path

from PySide6.QtCore import QSettings, Qt
from PySide6.QtGui import QIcon, QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QButtonGroup,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from ..app.draft import new_row_id
from ..core.importing.curl import parse_curl
from .examples import EXAMPLES
from .history_panel import HistoryPanel
from .i18n import MESSAGES, I18n
from .request_bar import RequestBar
from .request_pane import RequestPane
from .response_pane import ResponsePane
from .session import Session
from .theme import ACCENT

PORTFOLIO_URL = "https://raulesteveza.github.io/"
ICON = Path(__file__).resolve().parent.parent / "assets" / "icon.svg"


class LanguageSwitcher(QWidget):
    def __init__(self, i18n: I18n):
        super().__init__()
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)
        group = QButtonGroup(self)
        self._buttons = {}
        for code in MESSAGES:
            button = QPushButton(code.upper())
            button.setProperty("lang", True)
            button.setCheckable(True)
            button.clicked.connect(lambda _=False, code=code: i18n.set_language(code))
            group.addButton(button)
            layout.addWidget(button)
            self._buttons[code] = button
        self._i18n = i18n
        i18n.changed.connect(self._sync)
        self._sync()

    def _sync(self) -> None:
        self._buttons[self._i18n.language].setChecked(True)


class MainWindow(QMainWindow):
    def __init__(self, i18n: I18n, session: Session, settings: QSettings):
        super().__init__()
        self._i18n = i18n
        self.session = session
        self.setWindowTitle("Api2Data")
        self.resize(1440, 920)

        central = QWidget()
        page = QVBoxLayout(central)
        page.setContentsMargins(20, 12, 20, 10)
        page.setSpacing(10)

        intro = QFrame()
        intro.setObjectName("card")
        intro_layout = QHBoxLayout(intro)
        intro_layout.setContentsMargins(28, 16, 28, 16)
        text = QVBoxLayout()
        title_row = QHBoxLayout()
        title_row.setSpacing(14)
        # The tool's icon next to its name, as in the web version (personal_web_style layouts/tool-page.md)
        icon = QLabel()
        icon.setObjectName("toolIcon")
        icon.setPixmap(QIcon(str(ICON)).pixmap(40, 40))
        icon.setFixedSize(44, 44)
        icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title = QLabel("Api2Data")
        title.setProperty("role", "title")
        self.privacy_tag = QLabel()
        self.privacy_tag.setProperty("role", "privacyTag")
        title_row.addWidget(icon)
        title_row.addWidget(title)
        title_row.addWidget(self.privacy_tag, 0, Qt.AlignmentFlag.AlignVCenter)
        title_row.addStretch()
        text.addLayout(title_row)
        self.tagline = QLabel()
        self.tagline.setProperty("role", "subtitle")
        self.tagline.setWordWrap(True)
        self.description = QLabel()
        self.description.setProperty("role", "muted")
        self.description.setWordWrap(True)
        text.addWidget(self.tagline)
        text.addWidget(self.description)
        intro_layout.addLayout(text, 2)

        side = QVBoxLayout()
        # The language switcher sits in the card's top right corner: there is no header line
        side.addWidget(LanguageSwitcher(i18n), 0, Qt.AlignmentFlag.AlignRight)
        self.examples_label = QLabel()
        self.examples_label.setProperty("role", "fieldLabel")
        side.addWidget(self.examples_label)
        examples = QHBoxLayout()
        self._example_buttons = {}
        for example in EXAMPLES:
            button = QPushButton()
            button.setProperty("small", True)
            button.clicked.connect(lambda _=False, example=example: self.load_example(example["id"]))
            examples.addWidget(button)
            self._example_buttons[example["id"]] = button
        examples.addStretch()
        side.addLayout(examples)
        side.addStretch()
        intro_layout.addLayout(side, 1)
        page.addWidget(intro)

        self.request_bar = RequestBar(i18n, session, self.paste_curl)
        page.addWidget(self.request_bar)
        self.history_panel = HistoryPanel(i18n, session, self.load_request)
        page.addWidget(self.history_panel)

        self.request_pane = RequestPane(i18n, session, settings)
        self.response_pane = ResponsePane(i18n, session)
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.addWidget(self.request_pane)
        splitter.addWidget(self.response_pane)
        splitter.setChildrenCollapsible(False)
        splitter.setSizes([700, 700])
        page.addWidget(splitter, 1)

        # Credit at the bottom; the name opens the portfolio in the browser
        self.credit = QLabel()
        self.credit.setProperty("role", "muted")
        self.credit.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.credit.setOpenExternalLinks(True)
        self.credit.setTextFormat(Qt.TextFormat.RichText)
        page.addWidget(self.credit)
        self.setCentralWidget(central)

        # Ctrl/Cmd+Enter sends from anywhere, also from the body editor
        for keys in ("Ctrl+Return", "Ctrl+Enter"):
            QShortcut(QKeySequence(keys), self, session.send)

        i18n.changed.connect(self._retranslate)
        self._retranslate()

    def load_example(self, example_id: str) -> None:
        example = next(example for example in EXAMPLES if example["id"] == example_id)
        self.load_request(example["draft"]())

    def load_request(self, draft: dict, status: dict | None = None) -> None:
        self.session.load(draft, status)
        self.request_pane.show_section("params")

    def paste_curl(self, command: str) -> None:
        """A cURL command pasted in the URL bar fills the whole request instead of the address."""
        t = self._i18n.t
        result = parse_curl(command, new_row_id)
        if not result["ok"]:
            self.session.set_status({"tone": "error", "text": t.curl_problem[result["problem"]]})
            return
        details = [t.curl_notice(notice) for notice in result["notices"]]
        self.load_request(result["draft"], {"tone": "success", "text": t.curl_imported, "details": details})

    def _retranslate(self) -> None:
        t = self._i18n.t
        self.privacy_tag.setText(t.privacy_short)
        self.tagline.setText(t.tagline)
        self.description.setText(t.intro_description)
        self.examples_label.setText(t.examples_label)
        for example_id, button in self._example_buttons.items():
            button.setText(t.examples[example_id])
            button.setToolTip(t.example_descriptions[example_id])
        link = f'<a href="{PORTFOLIO_URL}" style="color: {ACCENT}; text-decoration: none;">Raúl Estévez</a>'
        self.credit.setText(f"{t.developed_by} {link}")
