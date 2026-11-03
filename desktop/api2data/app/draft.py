"""The request being edited and the actions that change it. Mirrors web/src/app/draft.ts: the URL bar and the Params
table are two views of the same query string, so editing one rewrites the other."""

import copy
import itertools

from ..core.auth.registry import default_auth
from ..core.body.registry import default_body
from ..core.request.url import params_from_url, url_with_params

_ids = itertools.count(1)


def new_row_id() -> str:
    """Ids for table rows: only need to be unique while the window is open."""
    return f"row-{next(_ids)}"


def empty_draft() -> dict:
    return {"method": "GET", "url": "", "params": [], "headers": [], "auth": default_auth(), "body": default_body()}


def set_method(draft: dict, method: str) -> dict:
    return {**draft, "method": method}


def set_url(draft: dict, url: str) -> dict:
    return {**draft, "url": url, "params": params_from_url(url, draft["params"], new_row_id)}


def set_params(draft: dict, params: list[dict]) -> dict:
    return {**draft, "params": params, "url": url_with_params(draft["url"], params)}


def set_headers(draft: dict, headers: list[dict]) -> dict:
    return {**draft, "headers": headers}


def set_auth(draft: dict, auth: dict) -> dict:
    return {**draft, "auth": auth}


def set_body(draft: dict, body: dict) -> dict:
    return {**draft, "body": body}


def load(draft: dict) -> dict:
    """Another request (an example, a history entry, an opened file, a pasted cURL command). The URL decides the
    enabled params; the disabled ones, which are not in it, are kept."""
    loaded = copy.deepcopy(draft)
    disabled = [row for row in loaded["params"] if not row["enabled"]]
    return {**loaded, "params": params_from_url(loaded["url"], disabled, new_row_id)}
