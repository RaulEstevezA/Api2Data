"""Every case in shared/test-cases/calls/: the arguments of a core function and the result the web version gives
for them (web/src/core/shared.test.ts writes and checks the same files)."""

import importlib
import json

import pytest

from .conftest import SHARED_CASES, as_json


def ids():
    """Row ids for functions that create rows: the same sequence as the web suite, starting again on every call."""
    counter = iter(range(1, 1_000_000))
    return lambda: f"id-{next(counter)}"


def core(path: str):
    module, _, function = path.rpartition(".")
    return getattr(importlib.import_module(f"api2data.core.{module}"), function)


def wrapped(name: str):
    """Functions called through the same small wrappers as in the web suite (shared/README.md). The core function
    is resolved first, so a module not ported yet is skipped instead of failing."""
    function = core(FUNCTIONS[name])
    if name in ("url.paramsFromUrl",):
        return lambda url, previous: function(url, previous, ids())
    if name in ("draftFormat.readDraft", "curl.parseCurl", "requestFile.readRequestFile", "history.parseHistory"):
        return lambda value: function(value, ids())
    if name == "body.serialize":
        return lambda mode, config: function(mode).serialize(config)
    if name == "body.validate":
        return lambda mode, config: function(mode).validate(config)
    if name == "viewers.isBinary":
        return lambda media_type, data: function(media_type, bytes(data))
    if name == "process.processResponse":

        def process(stored):
            response = {key: value for key, value in stored.items() if key != "body"}
            response["bytes"] = stored["body"].encode("utf-8")
            return {key: value for key, value in function(response).items() if key != "bytes"}

        return process
    if name == "codegen.generate":
        return lambda target_id, request: function(target_id).generate(request)
    return function


# Web function → Python module and function
FUNCTIONS = {
    "url.splitUrl": "request.url.split_url",
    "url.parseQuery": "request.url.parse_query",
    "url.encodeQueryPart": "request.url.encode_query_part",
    "url.urlWithParams": "request.url.url_with_params",
    "url.paramsFromUrl": "request.url.params_from_url",
    "url.appendQuery": "request.url.append_query",
    "url.resolveUrl": "request.url.resolve_url",
    "headers.isForbiddenHeader": "request.headers.is_forbidden_header",
    "headers.isValidHeaderName": "request.headers.is_valid_header_name",
    "headers.isValidHeaderValue": "request.headers.is_valid_header_value",
    "auth.base64Utf8": "auth.schemes.base64_utf8",
    "auth.applyAuth": "auth.registry.apply_auth",
    "auth.isAuthComplete": "auth.registry.is_auth_complete",
    "body.serialize": "body.registry.body_kind",
    "body.validate": "body.registry.body_kind",
    "build.prepareRequest": "request.build.prepare_request",
    "redact.redactDraft": "request.redact.redact_draft",
    "redact.hasCredentials": "request.redact.has_credentials",
    "redact.isSensitiveName": "request.redact.is_sensitive_name",
    "draftFormat.readDraft": "request.draft_format.read_draft",
    "draftFormat.toStoredDraft": "request.draft_format.to_stored_draft",
    "pretty.prettyJson": "json.pretty.pretty_json",
    "xml.prettyXml": "response.xml.pretty_xml",
    "contentType.parseContentType": "response.content_type.parse_content_type",
    "status.reasonPhrase": "response.status.reason_phrase",
    "status.statusClass": "response.status.status_class",
    "viewers.viewText": "response.viewers.view_text",
    "viewers.isBinary": "response.viewers.is_binary",
    "process.processResponse": "response.process.process_response",
    "curl.tokenize": "importing.curl.tokenize",
    "curl.looksLikeCurl": "importing.curl.looks_like_curl",
    "curl.parseCurl": "importing.curl.parse_curl",
    "curl.curlCommand": "codegen.curl.curl_command",
    "requestFile.createRequestFile": "importing.request_file.create_request_file",
    "requestFile.readRequestFile": "importing.request_file.read_request_file",
    "requestFile.requestFileName": "importing.request_file.request_file_name",
    "history.addEntry": "history.history.add_entry",
    "history.serializeHistory": "history.history.serialize_history",
    "history.parseHistory": "history.history.parse_history",
    "codegen.generate": "codegen.registry.find_code_target",
}

FILES = sorted((SHARED_CASES / "calls").glob("*.json"))


def test_every_file_has_a_function():
    assert {path.stem for path in FILES} <= set(FUNCTIONS)


@pytest.mark.parametrize("path", FILES, ids=lambda path: path.stem)
def test_calls(path):
    try:
        function = wrapped(path.stem)
    except (ImportError, AttributeError):
        pytest.skip(f"{FUNCTIONS[path.stem]} is not ported yet")
    for index, case in enumerate(json.loads(path.read_text(encoding="utf-8"))):
        result = as_json(function(*case["args"]))
        assert result == case["result"], f"{path.stem} #{index}: {case['args']!r:.300}"
