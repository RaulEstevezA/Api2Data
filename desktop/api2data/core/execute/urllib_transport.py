"""Sends requests with the Python standard library: no browser, so no CORS, and every header is sent as written."""

import time
import urllib.error
import urllib.request
import zlib

from .failure import classify_failure

# Large enough for slow APIs, short enough not to leave the window waiting for a server that never answers
DEFAULT_TIMEOUT = 60
_CHUNK = 64 * 1024


class _Aborted(Exception):
    pass


def _decompress(data: bytes, encoding: str | None) -> bytes:
    """The body after decompression, as a browser gives it. Only when the user asked for compression themselves:
    urllib does not ask for it."""
    encoding = (encoding or "").strip().lower()
    try:
        if encoding in ("gzip", "x-gzip"):
            return zlib.decompress(data, 16 + zlib.MAX_WBITS)
        if encoding == "deflate":
            try:
                return zlib.decompress(data)
            except zlib.error:
                return zlib.decompress(data, -zlib.MAX_WBITS)
    except zlib.error:
        pass
    return data


class UrllibTransport:
    def __init__(self, timeout: float = DEFAULT_TIMEOUT, clock=time.perf_counter, user_agent: str = "Api2Data"):
        self._timeout = timeout
        self._clock = clock
        self._user_agent = user_agent
        self._opener = urllib.request.build_opener()

    def send(self, request: dict, cancelled) -> dict:
        headers = {header["name"]: header["value"] for header in request["headers"]}
        if not any(name.lower() == "user-agent" for name in headers):
            headers["User-Agent"] = self._user_agent
        body = None if request["body"] is None else request["body"].encode("utf-8")
        prepared = urllib.request.Request(request["url"], data=body, headers=headers, method=request["method"])
        started = self._clock()
        try:
            try:
                reply = self._opener.open(prepared, timeout=self._timeout)
            except urllib.error.HTTPError as error:
                # 4xx and 5xx are responses like any other
                reply = error
        except Exception as error:
            return {"ok": False, "failure": classify_failure(error, cancelled.is_set())}

        try:
            chunks = []
            while True:
                if cancelled.is_set():
                    raise _Aborted
                chunk = reply.read(_CHUNK)
                if not chunk:
                    break
                chunks.append(chunk)
        except _Aborted:
            return {"ok": False, "failure": {"kind": "aborted"}}
        except Exception as error:
            failure = classify_failure(error, cancelled.is_set())
            if failure["kind"] != "aborted":
                failure = {"kind": "interrupted", "detail": failure.get("detail", str(error))}
            return {"ok": False, "failure": failure}
        finally:
            reply.close()

        # Header names in lower case, as the browser gives them
        response_headers = [[name.lower(), value] for name, value in reply.headers.items()]
        final_url = reply.geturl() or request["url"]
        return {
            "ok": True,
            "response": {
                "status": reply.status,
                "statusText": reply.reason or "",
                "url": final_url,
                "redirected": final_url != request["url"],
                "headers": response_headers,
                "bytes": _decompress(b"".join(chunks), reply.headers.get("Content-Encoding")),
                "durationMs": max(0, round((self._clock() - started) * 1000)),
                "origin": "sent",
            },
        }
