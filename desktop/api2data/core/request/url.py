"""The URL bar and the Params table as two views of the same query string. Mirrors web/src/core/request/url.ts."""

import re

from ..js import encode_uri_component, trim


def split_url(url: str) -> dict:
    """The parts of an address as typed: before "?", the query without "?" (None without one), the fragment with "#"."""
    hash_index = url.find("#")
    fragment = "" if hash_index == -1 else url[hash_index:]
    without_hash = url if hash_index == -1 else url[:hash_index]
    query_index = without_hash.find("?")
    if query_index == -1:
        return {"base": without_hash, "query": None, "hash": fragment}
    return {"base": without_hash[:query_index], "query": without_hash[query_index + 1 :], "hash": fragment}


def parse_query(query: str) -> list[dict]:
    """Query pairs exactly as written (not decoded), so the URL and the table always show the same text."""
    pairs = []
    for part in query.split("&"):
        if part == "":
            continue
        key, equals, value = part.partition("=")
        pairs.append({"key": key, "value": value if equals else ""})
    return pairs


def encode_query_part(text: str, is_key: bool) -> str:
    """Escapes only what would break the query (separators, spaces, a lone "%"), so values already encoded are not
    encoded twice."""
    result = re.sub(r"%(?![0-9A-Fa-f]{2})", "%25", text)
    result = result.replace(" ", "%20").replace("#", "%23").replace("&", "%26")
    if is_key:
        result = result.replace("=", "%3D")
    return result


def _serialize_query(params: list[dict]) -> str:
    # "key=" also when the value is empty: the usual form, and what URLSearchParams writes
    return "&".join(
        f"{encode_query_part(row['key'], True)}={encode_query_part(row['value'], False)}"
        for row in params
        if row["enabled"] and (row["key"] != "" or row["value"] != "")
    )


def url_with_params(url: str, params: list[dict]) -> str:
    """The URL with its query string rebuilt from the enabled params. Used when the table is edited."""
    parts = split_url(url)
    query = _serialize_query(params)
    return f"{parts['base']}{'?' + query if query else ''}{parts['hash']}"


def params_from_url(url: str, previous: list[dict], new_id) -> list[dict]:
    """The params after the URL bar is edited: the pairs of its query, enabled, then the disabled rows, which are not
    in the URL and must not be lost. Existing ids are reused so rows keep their focus."""
    query = split_url(url)["query"]
    pairs = [] if query is None else parse_query(query)
    enabled_ids = [row["id"] for row in previous if row["enabled"]]
    parsed = [
        {
            "id": enabled_ids[index] if index < len(enabled_ids) else new_id(),
            "key": pair["key"],
            "value": pair["value"],
            "enabled": True,
        }
        for index, pair in enumerate(pairs)
    ]
    return parsed + [row for row in previous if not row["enabled"]]


def append_query(url: str, pairs: list[dict]) -> str:
    """Adds query parameters to an absolute URL (API key in the query), keeping the existing ones as written."""
    if not pairs:
        return url
    parts = split_url(url)
    extra = "&".join(f"{encode_uri_component(pair['key'])}={encode_uri_component(pair['value'])}" for pair in pairs)
    query = parts["query"]
    return f"{parts['base']}?{query + '&' if query else ''}{extra}{parts['hash']}"


_SCHEME = re.compile(r"^[a-z][a-z\d+.-]*:", re.IGNORECASE)
# Characters a host cannot contain (WHATWG URL: forbidden host code points), besides control characters
_FORBIDDEN_HOST = set(" #%/:<>?@[\\]^|\t\n\r")


def is_valid_http_url(url: str) -> bool:
    """Whether new URL(url) accepts an http or https address: a host without forbidden characters, a valid port.
    The checks the web version gets from the browser, for the addresses people type."""
    match = re.match(r"^https?://([^/?#]*)", url, re.IGNORECASE)
    if not match:
        return False
    authority = match.group(1)
    host_port = authority.rpartition("@")[2]
    if host_port.startswith("["):
        host, _, rest = host_port.partition("]")
        if not re.fullmatch(r"\[[0-9A-Fa-f:.]+", host) or (rest and not re.fullmatch(r":\d*", rest)):
            return False
        port = rest[1:]
    else:
        host, _, port = host_port.partition(":")
        if host == "" or any(char in _FORBIDDEN_HOST or ord(char) < 0x20 for char in host):
            return False
        if ":" in port:
            return False
    # Spaces elsewhere (path, query) are valid: the browser encodes them
    return not (port and (not port.isascii() or not port.isdigit() or int(port) > 65535))


def resolve_url(text_input: str) -> dict:
    """The absolute address that will be requested. Without a scheme, https:// is assumed, and the caller says so."""
    text = trim(text_input)
    if not text:
        return {"ok": False, "problem": "empty"}
    # "localhost:3000" looks like a scheme followed by a port
    scheme_added = not _SCHEME.match(text) or bool(re.match(r"^[^/:]+:\d+(?:[/?#]|$)", text))
    candidate = f"https://{re.sub(r'^//', '', text)}" if scheme_added else text
    scheme = _SCHEME.match(candidate).group(0)[:-1].lower()
    if scheme not in ("http", "https"):
        return {"ok": False, "problem": "unsupportedScheme"}
    if not is_valid_http_url(candidate):
        return {"ok": False, "problem": "invalid"}
    # The fragment is never sent to the server
    return {"ok": True, "url": candidate.split("#")[0], "schemeAdded": scheme_added}
