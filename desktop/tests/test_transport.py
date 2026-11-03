"""The desktop transport against a real HTTP server on this computer."""

import gzip
import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from api2data.core.execute.urllib_transport import UrllibTransport
from api2data.core.response.process import process_response


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def _send(self, status: int, body: bytes, headers: dict | None = None):
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _echo(self):
        length = int(self.headers.get("Content-Length") or 0)
        received = self.rfile.read(length).decode("utf-8") if length else None
        echo = {"method": self.command, "path": self.path, "headers": dict(self.headers.items()), "body": received}
        self._send(200, json.dumps(echo).encode(), {"Content-Type": "application/json"})

    def do_GET(self):  # noqa: N802 (http.server's name)
        if self.path == "/missing":
            self._send(404, b'{"message":"Not Found"}', {"Content-Type": "application/json"})
        elif self.path == "/redirect":
            self._send(302, b"", {"Location": "/echo?after=redirect"})
        elif self.path == "/gzip":
            self._send(
                200,
                gzip.compress("comprimido ñ".encode()),
                {"Content-Type": "text/plain; charset=utf-8", "Content-Encoding": "gzip"},
            )
        elif self.path == "/slow":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            for _ in range(50):
                self.wfile.write(b"x" * 70000)
                self.wfile.flush()
                time.sleep(0.05)
        elif self.path == "/hang":
            time.sleep(2)
            self._send(200, b"late")
        else:
            self._echo()

    do_POST = do_PUT = do_PATCH = do_DELETE = _echo


@pytest.fixture(scope="module")
def server():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def _request(url, method="GET", headers=None, body=None):
    return {"method": method, "url": url, "headers": headers or [], "body": body}


def _not_cancelled():
    return threading.Event()


def test_sends_method_headers_and_body_as_written(server):
    request = _request(
        f"{server}/echo?q=a%20b",
        "POST",
        [
            {"name": "Content-Type", "value": "application/json", "source": "body"},
            {"name": "Cookie", "value": "a=1", "source": "user"},
        ],
        '{"name": "Raúl Estévez"}',
    )
    result = UrllibTransport().send(request, _not_cancelled())
    assert result["ok"]
    response = result["response"]
    assert response["status"] == 200 and response["origin"] == "sent" and response["durationMs"] >= 0
    echo = json.loads(response["bytes"])
    assert echo["method"] == "POST" and echo["path"] == "/echo?q=a%20b"
    assert echo["body"] == '{"name": "Raúl Estévez"}'
    # No browser in between: headers a browser would drop are sent, and there is a user agent
    assert echo["headers"]["Cookie"] == "a=1"
    assert echo["headers"]["User-Agent"] == "Api2Data"
    assert ["content-type", "application/json"] in response["headers"]


def test_error_statuses_are_responses(server):
    result = UrllibTransport().send(_request(f"{server}/missing"), _not_cancelled())
    processed = process_response(result["response"])
    assert processed["status"] == 404 and processed["reason"] == "Not Found"
    assert processed["body"]["view"]["pretty"] == '{\n  "message": "Not Found"\n}'


def test_follows_redirects_and_decompresses(server):
    redirected = UrllibTransport().send(_request(f"{server}/redirect"), _not_cancelled())["response"]
    assert redirected["redirected"] and redirected["url"].endswith("/echo?after=redirect")
    compressed = UrllibTransport().send(
        _request(f"{server}/gzip", headers=[{"name": "Accept-Encoding", "value": "gzip", "source": "user"}]),
        _not_cancelled(),
    )["response"]
    assert compressed["bytes"].decode("utf-8") == "comprimido ñ"


def test_unreachable_server():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    result = UrllibTransport().send(_request(f"http://127.0.0.1:{port}/"), _not_cancelled())
    assert result["ok"] is False and result["failure"]["kind"] == "unreachable"


def test_timeout(server):
    result = UrllibTransport(timeout=0.3).send(_request(f"{server}/hang"), _not_cancelled())
    assert result == {"ok": False, "failure": {"kind": "timeout"}}


def test_cancel_while_receiving(server):
    cancelled = threading.Event()
    threading.Timer(0.2, cancelled.set).start()
    started = time.perf_counter()
    result = UrllibTransport().send(_request(f"{server}/slow"), cancelled)
    assert result == {"ok": False, "failure": {"kind": "aborted"}}
    # Stopped well before the 2.5 seconds the whole body takes
    assert time.perf_counter() - started < 1.5
