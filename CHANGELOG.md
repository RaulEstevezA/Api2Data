# Changelog

Notable changes to Api2Data, the web and the desktop version together. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). The web version is published on every change to `main`; desktop releases are tagged `v<version>` and published on [Releases](https://github.com/RaulEstevezA/Api2Data/releases).

## [Unreleased]

### Added

- Web: requests with any of GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS, sent straight from the browser with no server in between.
- Web: Params, Headers, Authorization (Bearer Token, Basic Auth, API Key) and Body (JSON, Text, XML, Form URL Encoded) sections, one at a time; params stay in sync with the URL and rows can be switched off.
- Web: checks before sending: invalid addresses, JSON bodies with the line and column of the error, headers the browser would reject or drop, incomplete authorization.
- Web: responses with status, time, size and type; the body formatted and highlighted (JSON, XML), headers and raw text; search, copy and download.
- Web: when the server does not say the charset, the one the content declares is used (XML prolog, HTML `<meta charset>`, byte order mark), so accents in Latin-1 responses such as AEMET's are read correctly.
- Web: clear explanations when there is no response, including CORS, no connection and http addresses from an https page.
- Web: when the browser blocks a request, copy it as a cURL command and paste curl's output to see the response; the desktop download, for the visitor's system, appears there once the desktop version is released.
- Web: local history of sent requests, without credentials unless chosen explicitly.
- Web: paste a cURL command in the URL bar to fill the request; save and open requests as `.api2data.json` files, without credentials.
- Web: the request as cURL, JavaScript (fetch) or Python (requests).
- Web: English and Spanish, examples, and Cloudflare Web Analytics.
- Desktop: the same tool as an installable app for Windows, macOS and Linux (Python + PySide6). Requests are sent without a browser, so CORS does not apply and every header is sent as written; the history, request files, cURL commands and generated code work as in the web version.
- Both: shared test cases (`shared/test-cases/`) that the web and desktop cores must pass, so they prepare, check, format and save requests the same way.

[Unreleased]: https://github.com/RaulEstevezA/Api2Data/commits/main
