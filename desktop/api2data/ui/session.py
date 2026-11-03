"""The state of the window outside the widgets: the request being edited, its preparation, the request in flight, the
response and the history. Widgets change it through its methods and listen to its signals; requests are sent in
another thread so the window keeps responding."""

import itertools
import threading
from datetime import UTC, datetime

from PySide6.QtCore import QObject, QSettings, Qt, Signal

from ..app import draft as drafts
from ..core.execute.urllib_transport import UrllibTransport
from ..core.history.history import add_entry, remove_entry
from ..core.history.store import HistoryStore
from ..core.request.build import prepare_request
from ..core.request.redact import has_credentials, redact_draft
from ..core.response.process import process_response


class SettingsStorage:
    """The app's settings as the key / value storage the history store expects."""

    def __init__(self, settings: QSettings):
        self._settings = settings

    def get_item(self, key: str) -> str | None:
        value = self._settings.value(key)
        return value if isinstance(value, str) else None

    def set_item(self, key: str, value: str) -> None:
        self._settings.setValue(key, value)
        self._settings.sync()
        if self._settings.status() != QSettings.Status.NoError:
            raise OSError("the settings could not be written")

    def remove_item(self, key: str) -> None:
        self._settings.remove(key)


def _flag(settings: QSettings, key: str, default: bool) -> bool:
    value = settings.value(key, default)
    return value in (True, "true", "1", 1)


class Session(QObject):
    # The draft changed (also its preparation); "loaded" when it was replaced, so tables rebuild their rows
    draft_changed = Signal()
    loaded = Signal()
    # Idle, sending, done or failed
    state_changed = Signal()
    history_changed = Signal()
    # Result of the last import or save, or the problems under the bar
    status_changed = Signal()
    _finished = Signal(int, object)

    def __init__(self, settings: QSettings, transport=None):
        super().__init__()
        self._settings = settings
        self._transport = transport or UrllibTransport()
        self.draft = drafts.empty_draft()
        self.preparation = prepare_request(self.draft)
        # Errors under the bar only after trying to send: an address being typed is not yet a mistake
        self.attempted = False
        self.status: dict | None = None
        self.state: dict = {"status": "idle"}
        self._tokens = itertools.count(1)
        self._current: tuple[int, threading.Event, dict] | None = None
        self._finished.connect(self._on_finished, Qt.ConnectionType.QueuedConnection)

        self._history_store = HistoryStore(SettingsStorage(settings))
        self.history_enabled = _flag(settings, "history/enabled", True)
        self.keep_credentials = _flag(settings, "history/credentials", False)
        loaded = self._history_store.load(drafts.new_row_id)
        self.history: list[dict] = loaded["entries"] if loaded["ok"] else []
        # Told once: the saved history could not be read and a new one starts
        self.history_notice: str | None = None if loaded["ok"] else loaded["reason"]

    # ---------- The request ----------

    def _set(self, draft: dict) -> None:
        self.draft = draft
        self.preparation = prepare_request(draft)
        self.draft_changed.emit()

    def set_method(self, method: str) -> None:
        self._set(drafts.set_method(self.draft, method))

    def set_url(self, url: str) -> None:
        self.status = None
        self._set(drafts.set_url(self.draft, url))
        self.status_changed.emit()

    def set_params(self, params: list[dict]) -> None:
        self._set(drafts.set_params(self.draft, params))

    def set_headers(self, headers: list[dict]) -> None:
        self._set(drafts.set_headers(self.draft, headers))

    def set_auth(self, auth: dict) -> None:
        self._set(drafts.set_auth(self.draft, auth))

    def set_body(self, body: dict) -> None:
        self._set(drafts.set_body(self.draft, body))

    def load(self, draft: dict, status: dict | None = None) -> None:
        """Replaces the request: an example, a history entry, an opened file or a pasted cURL command. The response
        shown belonged to the previous request, so it goes too."""
        self._cancel_current()
        self.state = {"status": "idle"}
        self.attempted = False
        self.status = status
        self._set(drafts.load(draft))
        self.loaded.emit()
        self.state_changed.emit()
        self.status_changed.emit()

    def set_status(self, status: dict | None) -> None:
        self.status = status
        self.status_changed.emit()

    def bar_issues(self) -> list[dict]:
        """Problems shown under the bar: errors after trying to send, and the protocol added. Headers a browser would
        drop are sent by the desktop, so that notice does not apply here."""
        return [
            issue
            for issue in self.preparation["issues"]
            if (self.attempted and issue["level"] == "error") or issue["code"] == "schemeAdded"
        ]

    # ---------- Sending ----------

    @property
    def sending(self) -> bool:
        return self.state["status"] == "sending"

    def send(self) -> None:
        request = self.preparation["request"]
        if request is None:
            self.attempted = True
            self.status_changed.emit()
            return
        self._cancel_current()
        self.attempted = False
        self.status = None
        token = next(self._tokens)
        cancelled = threading.Event()
        self._current = (token, cancelled, self.draft)
        self.state = {"status": "sending", "request": request}
        self.state_changed.emit()
        self.status_changed.emit()

        def work() -> None:
            self._finished.emit(token, self._transport.send(request, cancelled))

        threading.Thread(target=work, daemon=True).start()

    def cancel(self) -> None:
        if self._current:
            self._current[1].set()
            # The window does not wait for the server: the request is shown as cancelled now
            token = self._current[0]
            self._on_finished(token, {"ok": False, "failure": {"kind": "aborted"}})

    def _cancel_current(self) -> None:
        if self._current:
            self._current[1].set()
            self._current = None

    def _on_finished(self, token: int, result: dict) -> None:
        if not self._current or self._current[0] != token:
            return  # A newer request replaced this one, or it was cancelled
        _token, _cancelled, sent_draft = self._current
        self._current = None
        request = self.state.get("request")
        if result["ok"]:
            self.state = {"status": "done", "request": request, "response": process_response(result["response"])}
            self._record(sent_draft, {"status": result["response"]["status"]})
        else:
            self.state = {"status": "failed", "request": request, "failure": result["failure"]}
            # A cancelled request is not worth keeping
            if result["failure"]["kind"] != "aborted":
                self._record(sent_draft, {"failure": result["failure"]["kind"]})
        self.state_changed.emit()

    # ---------- History ----------

    def _persist(self, entries: list[dict]) -> None:
        self.history = entries
        if not self._history_store.save(entries):
            self.history_notice = "unavailable"
        self.history_changed.emit()

    def _record(self, draft: dict, outcome: dict) -> None:
        if not self.history_enabled:
            return
        with_credentials = self.keep_credentials and has_credentials(draft)
        entry = {
            "id": drafts.new_row_id(),
            "sentAt": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "draft": draft if with_credentials else redact_draft(draft),
            "outcome": outcome,
            "withCredentials": with_credentials,
        }
        self._persist(add_entry(self.history, entry))

    def set_history_enabled(self, enabled: bool) -> None:
        self.history_enabled = enabled
        self._settings.setValue("history/enabled", enabled)
        self.history_changed.emit()

    def set_keep_credentials(self, keep: bool) -> None:
        """Turning credentials off also removes them from the entries already saved."""
        self.keep_credentials = keep
        self._settings.setValue("history/credentials", keep)
        if not keep and any(entry["withCredentials"] for entry in self.history):
            self._persist(
                [
                    {**entry, "draft": redact_draft(entry["draft"]), "withCredentials": False}
                    if entry["withCredentials"]
                    else entry
                    for entry in self.history
                ]
            )
        else:
            self.history_changed.emit()

    def remove_history_entry(self, entry_id: str) -> None:
        self._persist(remove_entry(self.history, entry_id))

    def clear_history(self) -> None:
        self._history_store.clear()
        self.history = []
        self.history_changed.emit()

    def dismiss_history_notice(self) -> None:
        self.history_notice = None
        self.history_changed.emit()
