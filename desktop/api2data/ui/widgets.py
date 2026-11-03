"""Small widgets shared by the panels: badges with a state as text (never color alone) and helpers."""

from PySide6.QtWidgets import QComboBox, QLabel, QLayout, QPushButton, QWidget


def badge(text: str, tone: str = "") -> QLabel:
    label = QLabel(text)
    label.setProperty("role", "badge")
    if tone:
        label.setProperty("tone", tone)
    return label


# HTTP status class → badge tone, as in the web version
STATUS_TONES = {
    "informational": "",
    "success": "success",
    "redirect": "accent",
    "clientError": "warning",
    "serverError": "danger",
}


def small_button(text: str = "", primary: bool = False) -> QPushButton:
    button = QPushButton(text)
    button.setProperty("small", True)
    if primary:
        button.setProperty("primary", True)
    return button


def muted(text: str = "", wrap: bool = True) -> QLabel:
    label = QLabel(text)
    label.setProperty("role", "muted")
    label.setWordWrap(wrap)
    return label


def combo(items: list[tuple[str, object]], current=None) -> QComboBox:
    widget = QComboBox()
    for text, data in items:
        widget.addItem(text, data)
    index = widget.findData(current)
    widget.setCurrentIndex(max(0, index))
    return widget


def set_role(widget: QWidget, role: str) -> None:
    """Changes a styled role and applies it again (Qt only reads dynamic properties when the style is polished)."""
    widget.setProperty("role", role)
    widget.style().unpolish(widget)
    widget.style().polish(widget)


def on_surface(*widgets: QWidget) -> None:
    """Containers inside a pane take the pane's background (the theme gives every widget the page's)."""
    for widget in widgets:
        widget.setProperty("section", "pane")


def clear_layout(layout: QLayout) -> None:
    """Removes and deletes every item of a layout, nested layouts included."""
    while layout.count():
        item = layout.takeAt(0)
        widget: QWidget | None = item.widget()
        if widget is not None:
            widget.hide()
            widget.deleteLater()
        elif item.layout() is not None:
            clear_layout(item.layout())
