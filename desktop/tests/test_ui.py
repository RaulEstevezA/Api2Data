"""The main flows of the window, with a transport that answers without going online."""

import json

from PySide6.QtCore import QSettings

from api2data.ui.request_files import open_request, save_request

from .conftest import wait_until


def test_example_send_and_response(window, transport):
    session = window.session
    window.load_example("github")
    assert window.request_bar.url.text() == "https://api.github.com/repos/RaulEstevezA/Api2Class"
    session.send()
    wait_until(lambda: session.state["status"] == "done")
    assert transport.sent[0]["headers"] == [
        {"name": "Accept", "value": "application/vnd.github+json", "source": "user"}
    ]
    pane = window.response_pane
    assert pane.status_badge.text() == "200 OK"
    assert '"name": "Api2Class"' in pane.body_view.toPlainText()
    assert len(session.history) == 1


def test_url_and_params_stay_in_sync(window):
    session = window.session
    window.request_bar.url.setText("https://api.example.com/items?page=2")
    window.request_bar.url.textEdited.emit("https://api.example.com/items?page=2")
    assert [(row["key"], row["value"]) for row in session.draft["params"]] == [("page", "2")]
    table = window.request_pane.params
    blank = table._widgets[-1]
    blank["key"].setText("size")
    blank["key"].textEdited.emit("size")
    assert session.draft["url"] == "https://api.example.com/items?page=2&size="


def test_pasted_curl_fills_the_request(window):
    window._i18n.set_language("en")
    command = "curl 'https://api.example.com/items' \\\n  -H 'authorization: Bearer abc' \\\n  --data-raw '{\"a\":1}'"
    window.paste_curl(command)
    draft = window.session.draft
    assert draft["method"] == "POST" and draft["url"] == "https://api.example.com/items"
    assert draft["auth"]["type"] == "bearer" and draft["body"]["text"]["json"] == '{"a":1}'
    assert window.request_bar.status.text() == "cURL command imported."
    # The body editor shows the imported body (it used to be overwritten while syncing)
    assert window.request_pane.body_editor.editor.toPlainText() == '{"a":1}'


def test_invalid_json_body_stops_the_request(window, transport):
    session = window.session
    window.load_example("post")
    body = dict(session.draft["body"], text={**session.draft["body"]["text"], "json": '{"a": 1,}'})
    session.set_body(body)
    session.send()
    assert transport.sent == []
    assert "Body" in window.request_bar.issues.text()


def test_history_leaves_credentials_out(window, tmp_path):
    session = window.session
    window.load_example("github")
    auth = json.loads(json.dumps(session.draft["auth"]))
    auth["type"] = "bearer"
    auth["settings"]["bearer"]["token"] = "secret-token"
    session.set_auth(auth)
    session.send()
    wait_until(lambda: len(session.history) == 1)
    stored = QSettings().value("api2data.history")
    assert "api.github.com" in stored and "secret-token" not in stored

    session.set_keep_credentials(True)
    session.send()
    wait_until(lambda: session.history[0]["withCredentials"])
    assert "secret-token" in QSettings().value("api2data.history")
    session.set_keep_credentials(False)
    assert "secret-token" not in QSettings().value("api2data.history")


def test_failures(window, transport):
    session = window.session
    transport.failure = {"kind": "unreachable", "detail": "Name or service not known"}
    window.request_bar.url.textEdited.emit("https://nowhere.example.com")
    session.send()
    wait_until(lambda: session.state["status"] == "failed")
    assert window.response_pane.failure.isVisible()
    assert "nowhere.example.com" in window.response_pane.failure_text.text()


def test_save_and_open_request_files(window, tmp_path):
    session = window.session
    window.load_example("post")
    path = tmp_path / "posts.api2data.json"
    save_request(window, window._i18n, session, str(path))
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["format"] == "api2data-request" and saved["request"]["method"] == "POST"
    window.load_example("github")
    open_request(window, window._i18n, session, str(path))
    assert session.draft["method"] == "POST" and session.draft["url"].endswith("/posts")


def test_language_switch(window):
    window._i18n.set_language("es")
    assert window.request_bar.send.text() == "Enviar"
    window._i18n.set_language("en")
    assert window.request_bar.send.text() == "Send"


def test_find_in_response(window):
    session = window.session
    window.load_example("github")
    session.send()
    wait_until(lambda: session.state["status"] == "done")
    window.response_pane.open_find()
    bar = window.response_pane.find_bar
    bar.field.setText("Api2Class")
    assert bar.find(forward=True)
    assert window.response_pane.body_view.textCursor().selectedText() == "Api2Class"


def test_cancel(window, transport):
    session = window.session
    released = []

    def wait_for_cancel(request, cancelled):
        cancelled.wait(5)
        released.append(cancelled.is_set())
        return {"ok": False, "failure": {"kind": "aborted"}}

    transport.send = wait_for_cancel
    window.load_example("github")
    session.send()
    assert session.sending and window.request_bar.cancel.isVisible()
    session.cancel()
    assert session.state["status"] == "failed" and session.state["failure"]["kind"] == "aborted"
    wait_until(lambda: released == [True])
    # A cancelled request is not kept in the history
    assert session.history == []
