"""The requests offered as examples, the same as the web version's. Public APIs that answer anyone, so they work from
anywhere; nothing is sent until Send is pressed."""

from ..app.draft import new_row_id
from ..core.auth.registry import default_auth
from ..core.body.registry import default_body


def _draft(method: str, url: str, headers: list[tuple[str, str]] | None = None, json_body: str | None = None) -> dict:
    body = default_body()
    if json_body is not None:
        body["mode"] = "json"
        body["text"]["json"] = json_body
    return {
        "method": method,
        "url": url,
        "params": [],
        "headers": [{"id": new_row_id(), "key": key, "value": value, "enabled": True} for key, value in headers or []],
        "auth": default_auth(),
        "body": body,
    }


EXAMPLES = [
    {
        "id": "github",
        "draft": lambda: _draft(
            "GET", "https://api.github.com/repos/RaulEstevezA/Api2Class", [("Accept", "application/vnd.github+json")]
        ),
    },
    {"id": "query", "draft": lambda: _draft("GET", "https://jsonplaceholder.typicode.com/comments?postId=1")},
    {
        "id": "post",
        "draft": lambda: _draft(
            "POST",
            "https://jsonplaceholder.typicode.com/posts",
            json_body='{\n  "title": "Api2Data",\n  "body": "Sent from the desktop app",\n  "userId": 1\n}',
        ),
    },
]
