"""Keeps the history in a key / value storage. Mirrors web/src/core/history/store.ts.

The storage has get_item(key), set_item(key, value) and remove_item(key): localStorage on the web, the app's
settings on the desktop, a dictionary in the tests. Nothing here raises: without storage the history lasts as long
as the window."""

from .history import parse_history, serialize_history

HISTORY_KEY = "api2data.history"


class HistoryStore:
    def __init__(self, storage, key: str = HISTORY_KEY):
        self._storage = storage
        self._key = key

    def load(self, new_id) -> dict:
        try:
            return parse_history(self._storage.get_item(self._key), new_id)
        except Exception:
            return {"ok": True, "entries": []}

    def save(self, entries: list[dict]) -> bool:
        """False when the storage cannot keep it."""
        try:
            if entries:
                self._storage.set_item(self._key, serialize_history(entries))
            else:
                self._storage.remove_item(self._key)
            return True
        except Exception:
            return False

    def clear(self) -> None:
        try:
            self._storage.remove_item(self._key)
        except Exception:
            pass
