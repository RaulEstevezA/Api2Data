"""Checks that the packaged app works: run by the release workflow as `Api2Data --smoke-test`.

PyInstaller only bundles what it sees imported, so a module loaded in an unusual way can be missing from the
executable even though every test passes. This opens the window, loads every example, sends a real request to a
server on this computer (urllib, http.client, gzip, the response views), writes every code target, saves and opens a
request file and imports a cURL command, then exits with 0.
"""

import gzip
import json
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PySide6.QtCore import QEvent, QTimer
from PySide6.QtWidgets import QApplication


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):  # noqa: N802 (http.server's name)
        body = gzip.compress(json.dumps({"ok": True, "text": "Meteorología"}, ensure_ascii=False).encode("utf-8"))
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _wait(condition, timeout: float = 10) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        if time.monotonic() > deadline:
            raise AssertionError("timed out waiting for the response")
        QApplication.processEvents()
        time.sleep(0.02)


def check(window) -> None:
    from api2data.core.codegen.registry import CODE_TARGETS
    from api2data.ui.examples import EXAMPLES
    from api2data.ui.request_files import open_request, save_request

    session = window.session
    for example in EXAMPLES:
        window.load_example(example["id"])
        assert session.preparation["request"] is not None, example["id"]
    for target in CODE_TARGETS:
        window.request_pane.code.target.setCurrentIndex(window.request_pane.code.target.findData(target.id))
        assert window.request_pane.code.code.toPlainText().strip(), target.id

    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        window.paste_curl(f"curl 'http://127.0.0.1:{server.server_address[1]}/check' -H 'Accept-Encoding: gzip'")
        session.send()
        _wait(lambda: session.state["status"] in ("done", "failed"))
        assert session.state["status"] == "done", session.state
        assert "Meteorología" in session.state["response"]["body"]["view"]["pretty"]
    finally:
        server.shutdown()

    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "check.api2data.json"
        save_request(window, window._i18n, session, str(path))
        assert json.loads(path.read_text(encoding="utf-8"))["format"] == "api2data-request"
        open_request(window, window._i18n, session, str(path))
        assert session.draft["url"].endswith("/check")


def main() -> None:
    from api2data.ui.app import create_app

    app, window = create_app([])
    window.show()

    def run() -> None:
        try:
            check(window)
        except Exception as error:
            print(f"Smoke test failed: {error!r}", file=sys.stderr, flush=True)
            app.exit(1)
        else:
            print("Smoke test passed", flush=True)
            app.exit(0)

    QTimer.singleShot(0, run)
    code = app.exec()
    # Deleted now, not when the process ends, so pending deletions never meet a window already gone
    window.close()
    window.deleteLater()
    app.sendPostedEvents(None, QEvent.Type.DeferredDelete)
    app.processEvents()
    sys.exit(code)
