"""Requests sent before, folded into one line until it is opened. Clicking one loads it into the request. Mirrors
web/src/components/HistoryPanel.tsx; the history is kept on this computer."""

from datetime import datetime

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

from ..core.response.status import status_class
from .highlighter import monospace_font
from .i18n import I18n
from .session import Session
from .widgets import STATUS_TONES, badge, clear_layout, muted, small_button


def format_when(iso: str, language: str, now: datetime | None = None) -> str:
    """ "10:42" for today, "3 Nov, 10:42" for another day."""
    moment = datetime.fromisoformat(iso).astimezone()
    now = now or datetime.now().astimezone()
    time = moment.strftime("%H:%M")
    if moment.date() == now.date():
        return time
    months_en = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    months_es = "ene feb mar abr may jun jul ago sept oct nov dic".split()
    if language == "es":
        day = f"{moment.day} {months_es[moment.month - 1]}"
    else:
        day = f"{months_en[moment.month - 1]} {moment.day}"
    if moment.year != now.year:
        day = f"{day} {moment.year}" if language == "es" else f"{day}, {moment.year}"
    return f"{day}, {time}"


class HistoryPanel(QFrame):
    def __init__(self, i18n: I18n, session: Session, on_load):
        super().__init__()
        self.setObjectName("panel")
        self._i18n = i18n
        self._session = session
        self._on_load = on_load
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.toggle = QToolButton()
        self.toggle.setCheckable(True)
        self.toggle.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        self.toggle.setArrowType(Qt.ArrowType.RightArrow)
        self.toggle.setProperty("role", "summary")
        layout.addWidget(self.toggle)

        self.content = QWidget()
        self.content.setProperty("section", "pane")
        content = QVBoxLayout(self.content)
        content.setContentsMargins(16, 8, 16, 16)
        content.setSpacing(8)
        self.notice = QLabel()
        self.notice.setWordWrap(True)
        self.notice.setProperty("role", "warningBox")
        self.dismiss = small_button()
        notice_row = QHBoxLayout()
        notice_row.addWidget(self.notice, 1)
        notice_row.addWidget(self.dismiss)
        content.addLayout(notice_row)
        self.save_check = QCheckBox()
        self.save_hint = muted()
        self.credentials_check = QCheckBox()
        self.credentials_hint = muted()
        for widget in (self.save_check, self.save_hint, self.credentials_check, self.credentials_hint):
            content.addWidget(widget)
        self.empty = muted()
        content.addWidget(self.empty)
        self.list_area = QScrollArea()
        self.list_area.setWidgetResizable(True)
        self.list_area.setMaximumHeight(260)
        list_widget = QWidget()
        list_widget.setProperty("section", "list")
        self.list = QVBoxLayout(list_widget)
        self.list.setContentsMargins(0, 0, 0, 0)
        self.list.setSpacing(0)
        self.list_area.setWidget(list_widget)
        content.addWidget(self.list_area)
        actions = QHBoxLayout()
        actions.addStretch()
        self.clear = QPushButton()
        actions.addWidget(self.clear)
        content.addLayout(actions)
        layout.addWidget(self.content)
        self.content.hide()

        self.toggle.toggled.connect(self._open)
        self.save_check.toggled.connect(
            lambda checked: session.set_history_enabled(checked) if checked != session.history_enabled else None
        )
        self.credentials_check.toggled.connect(
            lambda checked: session.set_keep_credentials(checked) if checked != session.keep_credentials else None
        )
        self.dismiss.clicked.connect(session.dismiss_history_notice)
        self.clear.clicked.connect(self._clear)
        session.history_changed.connect(self._sync)
        i18n.changed.connect(self._sync)
        self._sync()

    def _open(self, opened: bool) -> None:
        self.content.setVisible(opened)
        self.toggle.setArrowType(Qt.ArrowType.DownArrow if opened else Qt.ArrowType.RightArrow)

    def _clear(self) -> None:
        answer = QMessageBox.question(self, "Api2Data", self._i18n.t.history_clear_confirm)
        if answer == QMessageBox.StandardButton.Yes:
            self._session.clear_history()

    def _sync(self) -> None:
        t = self._i18n.t
        session = self._session
        self.toggle.setText(t.history_title(len(session.history)))
        notice = session.history_notice
        self.notice.setText(t.history_notice[notice] if notice else "")
        self.notice.setVisible(bool(notice))
        self.dismiss.setVisible(bool(notice))
        self.dismiss.setText(t.dismiss)
        self.save_check.setText(t.history_save)
        self.save_check.setChecked(session.history_enabled)
        self.save_hint.setText(t.history_save_hint)
        self.credentials_check.setText(t.history_credentials)
        self.credentials_check.setChecked(session.keep_credentials)
        self.credentials_check.setEnabled(session.history_enabled)
        self.credentials_hint.setText(t.history_credentials_hint)
        self.clear.setText(t.history_clear)
        self.clear.setVisible(bool(session.history))
        self.empty.setText(t.history_empty if session.history_enabled else t.history_off)
        self.empty.setVisible(not session.history)
        self.list_area.setVisible(bool(session.history))
        clear_layout(self.list)
        for entry in session.history:
            self.list.addWidget(self._row(entry))
        self.list.addStretch()
        # As tall as its rows, up to about six; then it scrolls
        self.list_area.setFixedHeight(min(260, 42 * len(session.history) + 2))

    def _row(self, entry: dict) -> QWidget:
        t = self._i18n.t
        row = QFrame()
        row.setObjectName("historyRow")
        layout = QHBoxLayout(row)
        layout.setContentsMargins(12, 4, 8, 4)
        layout.setSpacing(8)
        draft = entry["draft"]
        load = QPushButton(f"{draft['method']:<7} {draft['url']}")
        load.setProperty("historyLoad", True)
        load.setFont(monospace_font())
        load.setToolTip(draft["url"])
        load.clicked.connect(lambda _=False, entry=entry: self._on_load(entry["draft"]))
        layout.addWidget(load, 1)
        outcome = entry["outcome"]
        if "status" in outcome:
            layout.addWidget(badge(str(outcome["status"]), STATUS_TONES[status_class(outcome["status"])]))
        else:
            layout.addWidget(badge(t.history_no_response))
        if entry["withCredentials"]:
            layout.addWidget(badge(t.history_with_credentials, "warning"))
        layout.addWidget(muted(format_when(entry["sentAt"], self._i18n.language), wrap=False))
        remove = small_button(t.remove)
        remove.setAccessibleName(f"{t.remove} {draft['method']} {draft['url']}")
        remove.clicked.connect(lambda _=False, entry_id=entry["id"]: self._session.remove_history_entry(entry_id))
        layout.addWidget(remove)
        return row
