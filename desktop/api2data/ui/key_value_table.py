"""Key / value rows that can be added, removed and switched off. The last row is always empty: typing in it creates
a new row, so there is no "Add" button to look for. Mirrors web/src/components/KeyValueEditor.tsx."""

from PySide6.QtCore import Signal
from PySide6.QtWidgets import QCheckBox, QGridLayout, QLineEdit, QWidget

from ..app.draft import new_row_id
from .highlighter import monospace_font
from .i18n import I18n
from .widgets import small_button


def _same(a: list[dict], b: list[dict]) -> bool:
    keys = ("id", "key", "value", "enabled")
    return len(a) == len(b) and all(all(x[key] == y[key] for key in keys) for x, y in zip(a, b, strict=True))


class KeyValueTable(QWidget):
    changed = Signal(list)

    def __init__(self, i18n: I18n):
        super().__init__()
        self._i18n = i18n
        self._rows: list[dict] = []
        self._grid = QGridLayout(self)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setHorizontalSpacing(8)
        self._grid.setVerticalSpacing(6)
        self._grid.setColumnStretch(1, 2)
        self._grid.setColumnStretch(2, 3)
        self._widgets: list[dict] = []
        self._rebuild()
        i18n.changed.connect(self._retranslate)

    def rows(self) -> list[dict]:
        return [dict(row) for row in self._rows]

    def sync(self, rows: list[dict]) -> None:
        """Shows these rows, unless they are the ones already shown (an edit made here keeps its focus)."""
        if _same(rows, self._rows):
            return
        self._rows = [dict(row) for row in rows]
        self._rebuild()

    def _emit(self) -> None:
        self.changed.emit(self.rows())

    def _rebuild(self) -> None:
        for widgets in self._widgets:
            for widget in widgets.values():
                if isinstance(widget, QWidget):
                    widget.hide()
                    widget.deleteLater()
        self._widgets = []
        for index, row in enumerate(self._rows):
            self._add_widgets(index, row)
        self._add_widgets(len(self._rows), None)
        self._retranslate()

    def _add_widgets(self, index: int, row: dict | None) -> None:
        """One line of the table; row is None for the empty one at the end."""
        t = self._i18n.t
        check = QCheckBox()
        key = QLineEdit(row["key"] if row else "")
        value = QLineEdit(row["value"] if row else "")
        remove = small_button(t.remove)
        for field in (key, value):
            field.setFont(monospace_font())
        widgets = {"check": check, "key": key, "value": value, "remove": remove, "row": row}
        self._grid.addWidget(check, index, 0)
        self._grid.addWidget(key, index, 1)
        self._grid.addWidget(value, index, 2)
        self._grid.addWidget(remove, index, 3)
        self._widgets.append(widgets)
        if row is None:
            check.setVisible(False)
            remove.setVisible(False)
        else:
            check.setChecked(row["enabled"])
            self._style_enabled(widgets)
        check.toggled.connect(lambda checked, w=widgets: self._edit(w, "enabled", checked))
        key.textEdited.connect(lambda text, w=widgets: self._edit(w, "key", text))
        value.textEdited.connect(lambda text, w=widgets: self._edit(w, "value", text))
        remove.clicked.connect(lambda _=False, w=widgets: self._remove(w))

    def _edit(self, widgets: dict, field: str, value) -> None:
        if widgets["row"] is None:
            # The empty row becomes a real one in place, so its field keeps the focus, and a new empty row follows
            row = {"id": new_row_id(), "key": "", "value": "", "enabled": True, field: value}
            widgets["row"] = row
            self._rows.append(row)
            widgets["check"].setVisible(True)
            widgets["check"].setChecked(True)
            widgets["remove"].setVisible(True)
            self._add_widgets(len(self._rows), None)
            self._retranslate()
        else:
            widgets["row"][field] = value
            if field == "enabled":
                self._style_enabled(widgets)
        if field == "key":
            self._retranslate()
        self._emit()

    def _remove(self, widgets: dict) -> None:
        self._rows = [row for row in self._rows if row is not widgets["row"]]
        self._rebuild()
        self._emit()

    def _style_enabled(self, widgets: dict) -> None:
        enabled = widgets["row"]["enabled"]
        for field in (widgets["key"], widgets["value"]):
            font = field.font()
            font.setStrikeOut(not enabled)
            field.setFont(font)
            field.setProperty("off", not enabled)
            field.style().unpolish(field)
            field.style().polish(field)

    def _retranslate(self) -> None:
        t = self._i18n.t
        for widgets in self._widgets:
            widgets["key"].setPlaceholderText(t.key_placeholder)
            widgets["value"].setPlaceholderText(t.value_placeholder)
            widgets["remove"].setText(t.remove)
            key = widgets["row"]["key"] if widgets["row"] else ""
            widgets["check"].setToolTip(t.enable_row(key))
            widgets["check"].setAccessibleName(t.enable_row(key))
