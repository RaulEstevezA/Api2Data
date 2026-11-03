"""Params, headers, authorization, body and code, one section at a time: everything optional stays out of sight.
Mirrors web/src/components/RequestPane.tsx."""

from PySide6.QtCore import QSettings, Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QLabel, QPushButton, QScrollArea, QStackedWidget, QTabBar, QVBoxLayout, QWidget

from ..core.http.key_value import active_rows
from ..core.http.methods import allows_body
from .auth_editor import AuthEditor
from .body_editor import BodyEditor
from .code_snippet import CodeSnippet
from .i18n import I18n
from .key_value_table import KeyValueTable
from .pane import Pane
from .request_files import open_request, save_request
from .session import Session
from .theme import DANGER, MUTED, WARNING
from .widgets import muted, on_surface

SECTIONS = ("params", "headers", "auth", "body", "code")
# The browser drops these headers; the desktop sends them, so the notice does not apply here
_HEADER_ISSUES = {"headerName", "headerValue", "authOverridden"}
_AUTH_ISSUES = {"authIncomplete", "authOverridden"}


def _issues_html(t, issues: list[dict]) -> str:
    lines = []
    for issue in issues:
        color = DANGER if issue["level"] == "error" else WARNING
        text = t.issue(issue).replace("&", "&amp;").replace("<", "&lt;")
        lines.append(f'<div style="color: {color};">{text}</div>')
    return "".join(lines)


def _page(*widgets: QWidget, stretch: bool = True) -> QWidget:
    page = QWidget()
    on_surface(page)
    layout = QVBoxLayout(page)
    layout.setContentsMargins(16, 16, 16, 16)
    layout.setSpacing(12)
    for widget in widgets:
        layout.addWidget(widget)
    if stretch:
        layout.addStretch()
    return page


def _scrolling(page: QWidget) -> QScrollArea:
    area = QScrollArea()
    area.setWidgetResizable(True)
    area.setWidget(page)
    return area


class RequestPane(Pane):
    def __init__(self, i18n: I18n, session: Session, settings: QSettings):
        super().__init__()
        self._i18n = i18n
        self._session = session
        self.open_button = QPushButton()
        self.save_button = QPushButton()
        self.header.addWidget(self.open_button)
        self.header.addWidget(self.save_button)

        self.tabs = QTabBar()
        self.tabs.setDrawBase(False)
        self.tabs.setExpanding(False)
        for _section in SECTIONS:
            self.tabs.addTab("")
        tabs_row = QWidget()
        tabs_row.setProperty("section", "tabs")
        tabs_layout = QVBoxLayout(tabs_row)
        tabs_layout.setContentsMargins(8, 6, 8, 0)
        tabs_layout.addWidget(self.tabs)
        self.body.addWidget(tabs_row)

        self.params = KeyValueTable(i18n)
        self.params_hint = muted()
        self.headers = KeyValueTable(i18n)
        self.headers_hint = muted()
        self.header_issues = QLabel()
        self.header_issues.setWordWrap(True)
        self.automatic = QLabel()
        self.automatic.setWordWrap(True)
        self.automatic.setTextFormat(Qt.TextFormat.RichText)
        self.auth = AuthEditor(i18n, session)
        self.auth_issues = QLabel()
        self.auth_issues.setWordWrap(True)
        self.body_editor = BodyEditor(i18n, session)
        self.body_not_allowed = muted()
        self.code = CodeSnippet(i18n, session, settings)

        body_page = QWidget()
        body_layout = QVBoxLayout(body_page)
        body_layout.setContentsMargins(16, 16, 16, 16)
        body_layout.addWidget(self.body_editor, 1)
        body_layout.addWidget(self.body_not_allowed)
        code_page = QWidget()
        code_layout = QVBoxLayout(code_page)
        code_layout.setContentsMargins(16, 16, 16, 16)
        code_layout.addWidget(self.code)

        self.pages = QStackedWidget()
        on_surface(self.pages, body_page, code_page, self.params, self.headers)
        self.pages.addWidget(_scrolling(_page(self.params, self.params_hint)))
        self.pages.addWidget(_scrolling(_page(self.headers, self.headers_hint, self.header_issues, self.automatic)))
        self.pages.addWidget(_scrolling(_page(self.auth, self.auth_issues)))
        self.pages.addWidget(body_page)
        self.pages.addWidget(code_page)
        self.body.addWidget(self.pages, 1)
        # This pane has no footer
        self.footer.parentWidget().hide()

        self.tabs.currentChanged.connect(self.pages.setCurrentIndex)
        self.params.changed.connect(session.set_params)
        self.headers.changed.connect(session.set_headers)
        self.open_button.clicked.connect(lambda: open_request(self, i18n, session))
        self.save_button.clicked.connect(lambda: save_request(self, i18n, session))
        session.draft_changed.connect(self._sync)
        session.loaded.connect(self._sync)
        i18n.changed.connect(self._retranslate)
        self._retranslate()

    def show_section(self, section: str) -> None:
        self.tabs.setCurrentIndex(SECTIONS.index(section))

    def _sync(self) -> None:
        t = self._i18n.t
        draft = self._session.draft
        preparation = self._session.preparation
        self.params.sync(draft["params"])
        self.headers.sync(draft["headers"])
        header_issues = [issue for issue in preparation["issues"] if issue["code"] in _HEADER_ISSUES]
        auth_issues = [issue for issue in preparation["issues"] if issue["code"] in _AUTH_ISSUES]
        self.header_issues.setText(_issues_html(t, header_issues))
        self.header_issues.setVisible(bool(header_issues))
        self.auth_issues.setText(_issues_html(t, auth_issues))
        self.auth_issues.setVisible(bool(auth_issues))
        automatic = [header for header in preparation["headers"] if header["source"] != "user"]
        if automatic:

            def automatic_row(header: dict) -> str:
                value = "••••••" if header["source"] == "auth" else header["value"]
                return (
                    f'<div><span style="font-family: monospace;">{header["name"]}</span> '
                    f'<span style="color: {MUTED}; font-family: monospace;">{value}</span> '
                    f'<i style="color: {MUTED};">{t.header_source[header["source"]]}</i></div>'
                )

            rows = "".join(automatic_row(header) for header in automatic)
            self.automatic.setText(f'<div style="color: {MUTED};">{t.automatic_headers}</div>{rows}')
        self.automatic.setVisible(bool(automatic))
        body_allowed = allows_body(draft["method"])
        self.body_editor.setVisible(body_allowed)
        self.body_not_allowed.setVisible(not body_allowed)
        self.body_not_allowed.setText(t.body_not_allowed(draft["method"]))

        def count(rows: list[dict]) -> str:
            return f"  {len(active_rows(rows))}" if active_rows(rows) else ""

        labels = {
            "params": t.sections["params"] + count(draft["params"]),
            "headers": t.sections["headers"] + (count(draft["headers"]) or ("  !" if header_issues else "")),
            "auth": t.sections["auth"]
            + ("" if draft["auth"]["type"] == "none" else f"  {t.auth_types[draft['auth']['type']]}"),
            "body": t.sections["body"]
            + (f"  {t.body_modes[draft['body']['mode']]}" if body_allowed and draft["body"]["mode"] != "none" else ""),
            "code": t.sections["code"],
        }
        body_error = any(issue["code"] == "body" for issue in preparation["issues"])
        for index, section in enumerate(SECTIONS):
            self.tabs.setTabText(index, labels[section])
            warning = (
                (section == "auth" and auth_issues)
                or (section == "body" and body_error)
                or (section == "headers" and any(i["level"] == "error" for i in header_issues))
            )
            # A section with a problem is named in the warning color; an invalid color goes back to the theme's
            self.tabs.setTabTextColor(index, QColor(WARNING) if warning else QColor())

    def _retranslate(self) -> None:
        t = self._i18n.t
        self.title.setText(t.request_title)
        self.open_button.setText(t.open_request)
        self.open_button.setToolTip(t.open_request_title)
        self.save_button.setText(t.save_request)
        self.save_button.setToolTip(t.save_request_title)
        self.params_hint.setText(t.params_hint)
        self.headers_hint.setText(t.headers_hint)
        self._sync()
