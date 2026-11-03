"""Key / value rows of the Params, Headers and form body tables: {"id", "key", "value", "enabled"}.
Mirrors web/src/core/http/keyValue.ts."""


def create_row(row_id: str, key: str = "", value: str = "", enabled: bool = True) -> dict:
    return {"id": row_id, "key": key, "value": value, "enabled": enabled}


def active_rows(rows: list[dict]) -> list[dict]:
    """Rows that will be sent: enabled and with a name. A row with only a value is an unfinished edit."""
    from ..js import trim

    return [row for row in rows if row["enabled"] and trim(row["key"]) != ""]
