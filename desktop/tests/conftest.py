import json
import os
from pathlib import Path

# Interface tests run without opening windows
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

SHARED_CASES = Path(__file__).resolve().parents[2] / "shared" / "test-cases"


def as_json(value):
    """What JSON keeps of a value, as the files hold it (tuples become lists, None keys stay None)."""
    return json.loads(json.dumps(value, ensure_ascii=False))


import pytest  # noqa: E402


class FakeTransport:
    """Answers at once without going online: a JSON 200, or the failure set in `failure`."""

    def __init__(self):
        self.sent: list[dict] = []
        self.failure: dict | None = None

    def send(self, request, cancelled):
        self.sent.append(request)
        if self.failure:
            return {"ok": False, "failure": self.failure}
        body = json.dumps({"id": 1, "name": "Api2Class"}).encode()
        return {
            "ok": True,
            "response": {
                "status": 200,
                "statusText": "OK",
                "url": request["url"],
                "redirected": False,
                "headers": [["content-type", "application/json"]],
                "bytes": body,
                "durationMs": 12,
                "origin": "sent",
            },
        }


@pytest.fixture
def transport():
    return FakeTransport()


@pytest.fixture
def window(tmp_path, transport):
    """Main window with settings isolated in a temporary folder (no real preferences are touched)."""
    from PySide6.QtCore import QEvent, QSettings

    QSettings.setDefaultFormat(QSettings.Format.IniFormat)
    QSettings.setPath(QSettings.Format.IniFormat, QSettings.Scope.UserScope, str(tmp_path))
    from api2data.ui.app import create_app

    app, main_window = create_app([], transport=transport)
    main_window.show()
    yield main_window
    main_window.close()
    # Deleted now, not when the process ends, so pending deletions never meet a window already gone
    main_window.deleteLater()
    app.sendPostedEvents(None, QEvent.Type.DeferredDelete)
    app.processEvents()


def wait_until(condition, timeout: float = 3.0) -> None:
    """Processes Qt events until the condition holds: requests are answered from another thread."""
    import time

    from PySide6.QtWidgets import QApplication

    deadline = time.monotonic() + timeout
    while not condition():
        if time.monotonic() > deadline:
            raise AssertionError("timed out")
        QApplication.processEvents()
        time.sleep(0.01)


@pytest.fixture(autouse=True)
def answer_yes(monkeypatch):
    """Confirmation dialogs would wait for a click: tests answer yes."""
    from PySide6.QtWidgets import QMessageBox

    monkeypatch.setattr(QMessageBox, "question", lambda *_args, **_kwargs: QMessageBox.StandardButton.Yes)
