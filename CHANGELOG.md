# Changelog

Notable changes to Api2Data. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). The web version is published on every change to `main`.

## [Unreleased]

### Added

- Web: requests with any of GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS, sent straight from the browser with no server in between.
- Web: Params, Headers, Authorization (Bearer Token, Basic Auth, API Key) and Body (JSON, Text, XML, Form URL Encoded) sections, one at a time; params stay in sync with the URL and rows can be switched off.
- Web: checks before sending: invalid addresses, JSON bodies with the line and column of the error, headers the browser would reject or drop, incomplete authorization.
- Web: responses with status, time, size and type; the body formatted and highlighted (JSON, XML), headers and raw text; search, copy and download.
- Web: clear explanations when there is no response, including CORS, no connection and http addresses from an https page.
- Web: local history of sent requests, without credentials unless chosen explicitly.
- Web: paste a cURL command in the URL bar to fill the request; save and open requests as `.api2data.json` files, without credentials.
- Web: the request as cURL, JavaScript (fetch) or Python (requests).
- Web: English and Spanish, examples, and Cloudflare Web Analytics.

[Unreleased]: https://github.com/RaulEstevezA/Api2Data/commits/main
