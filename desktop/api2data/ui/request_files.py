"""Open and Save of the request pane: files the user chooses, read and written on this computer."""

from datetime import UTC, datetime
from pathlib import Path

from PySide6.QtWidgets import QFileDialog, QWidget

from ..app.draft import new_row_id
from ..core.importing.request_file import (
    MAX_REQUEST_FILE_SIZE,
    create_request_file,
    read_request_file,
    request_file_name,
)
from .i18n import I18n
from .paths import in_downloads
from .session import Session


def open_request(parent: QWidget, i18n: I18n, session: Session, path: str | None = None) -> None:
    t = i18n.t
    if path is None:
        path, _ = QFileDialog.getOpenFileName(parent, t.open_request, "", "Api2Data (*.json *.txt *.sh *.curl);;* (*)")
        if not path:
            return
    name = Path(path).name
    try:
        if Path(path).stat().st_size > MAX_REQUEST_FILE_SIZE:
            session.set_status({"tone": "error", "text": t.file_problem(name, "tooLarge")})
            return
        text = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        session.set_status({"tone": "error", "text": t.file_problem(name, "error")})
        return
    result = read_request_file(text, new_row_id)
    if not result["ok"]:
        session.set_status({"tone": "error", "text": t.file_problem(name, result["problem"])})
        return
    session.load(
        result["draft"],
        {"tone": "success", "text": t.file_opened(name), "details": [t.curl_notice(n) for n in result["notices"]]},
    )


def save_request(parent: QWidget, i18n: I18n, session: Session, path: str | None = None) -> None:
    t = i18n.t
    if path is None:
        path, _ = QFileDialog.getSaveFileName(
            parent, t.save_request, in_downloads(request_file_name(session.draft)), "Api2Data (*.json)"
        )
        if not path:
            return
    try:
        Path(path).write_text(create_request_file(session.draft, datetime.now(UTC)), encoding="utf-8")
    except OSError:
        session.set_status({"tone": "error", "text": t.file_problem(Path(path).name, "error")})
        return
    session.set_status({"tone": "success", "text": t.file_saved(Path(path).name)})
