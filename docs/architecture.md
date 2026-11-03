# Architecture

Api2Data turns what the user types into an HTTP request, sends it from the browser and turns the answer into something readable. There is no backend: the page talks to the API directly.

```text
RequestDraft ──► prepareRequest ──► PreparedRequest ──► HttpTransport ──► HttpResponse ──► processResponse ──► ProcessedResponse
 (as typed)       auth, body,        (absolute URL,       (fetch today)     (status,         content type,      (status text, size,
                  headers, checks     final headers,                         headers, bytes)  charset, viewers    views of the body,
                                      serialized body)                                                            raw text)
```

Every stage is a pure function or a small interface, so each one is tested on its own and replaced without touching the others: the desktop version, for example, will only need another `HttpTransport`.

## Folders

```text
web/src/
├── core/                 No React and no browser globals: tested in Node
│   ├── http/             RequestDraft, PreparedRequest, HttpResponse; methods; key / value rows
│   ├── request/          URL ⇄ params, header rules, prepareRequest, redaction, stored draft format
│   ├── auth/             Authorization schemes and their registry
│   ├── body/             Body kinds and their registry
│   ├── json/             Strict JSON parser with positions (same as Api2Class) and the re-indenter
│   ├── execute/          HttpTransport contract, the fetch transport, failure classification
│   ├── response/         Content type and charset, viewers, status, processResponse
│   ├── history/          History entries, their stored format and the store over Web Storage
│   ├── import/           cURL parser and request files
│   ├── codegen/          Code targets (cURL, fetch, requests) and their registry
│   └── handoff/          Passing a JSON response to Api2Class
├── app/                  Interface state outside the components: draft reducer, sending, history
├── components/           React components, one per part of the screen
├── i18n/                 English and Spanish texts
├── hooks/, utils/        Stored preferences; clipboard, downloads, formatting, links
└── examples/             The requests offered as examples
```

## The request

- **`RequestDraft`** holds what the user typed, unvalidated: method, URL, params, headers, the settings of every authorization type and the content of every body mode (switching does not lose anything).
- **URL and params** are two views of the query string (`request/url.ts`). The text is never decoded, so the URL and the table always show the same characters; only what would break the query (`&`, `#`, spaces, a lone `%`) is escaped when the table is edited. Disabled rows are kept outside the URL.
- **`prepareRequest`** (`request/build.ts`) resolves the address (adding `https://` when there is no protocol, and saying so), applies the authorization, serializes the body, adds its Content-Type unless the user set one, and returns the issues: errors stop the request (invalid URL, invalid JSON body, headers `fetch` would reject), notices only inform (forbidden headers the browser drops, incomplete authorization, a user header that wins over the automatic one). It runs on every change.

## Sending and failures

`createFetchTransport` receives `fetch`, a clock, the page protocol and the online state, so the tests replace all of them. It sends with `credentials: 'omit'` and reads the whole body as bytes, measuring the time until the last byte.

The browser reports CORS, DNS and refused connections with the same opaque error. `classifyFailure` tells apart what it can (cancelled, offline, an http address from an https page) and leaves the rest as `blocked`, which the interface explains with its likely causes instead of guessing one.

## The response

`processResponse` reads the Content-Type and charset, decides whether the body is binary, decodes it and asks the viewers for the best view:

| Viewer | Declared type | Recognized when the type is missing or generic |
|---|---|---|
| JSON | `application/json`, `*+json` | starts with `{` or `[` and parses |
| XML | `application/xml`, `text/xml`, `*+xml` | starts with `<?xml` |
| HTML | `text/html` | starts with `<!doctype html` or `<html` |
| Text | anything else | always |

JSON is re-indented token by token without parsing values, so numbers beyond JavaScript's precision keep their digits. A body declared as JSON that does not parse is shown as received, with the position of the error.

## Extending it

| To add | Do |
|---|---|
| An authorization type | Its settings in `auth/types.ts`, a scheme in `auth/schemes.ts`, a line in `auth/registry.ts`, its fields in `components/AuthEditor.tsx` (the compiler points at each place) |
| A body mode | A kind in `body/kinds.ts` and a line in `body/registry.ts` |
| A response view | A viewer in `response/viewers.ts`, before the text viewer |
| A code target | A file in `codegen/` and a line in `codegen/registry.ts` |
| Another way of sending (desktop) | An `HttpTransport` |

## Desktop version

`desktop/api2data/core/` holds the same modules in Python (`request/url.ts` ↔ `request/url.py`), checked against the same cases in [`shared/test-cases/`](../shared/README.md). Drafts, requests and responses are dictionaries with the same keys as in TypeScript. A few helpers in `core/js.py` reproduce the JavaScript behavior the results depend on (`trim`, `encodeURIComponent`, `URLSearchParams`, `TextDecoder`).

What changes is how requests are sent: `core/execute/urllib_transport.py` uses the Python standard library instead of `fetch`. There is no browser, so no CORS, no mixed content and no forbidden headers; the failures are those of a network (`unreachable`, `timeout`, `tls`, `interrupted`, `aborted`). The interface (`ui/`) keeps the state in a `Session` object outside the widgets, as `app/` does on the web, and sends in another thread so the window keeps responding.

## Principles

- **The core decides, the interface shows.** Components call the core and the `app/` hooks; they do not build requests or read responses themselves.
- **Dependencies come in.** `fetch`, the clock, `localStorage`, `sessionStorage` and navigation are parameters, never globals inside the core.
- **Nothing silent.** Every automatic change (a protocol added, a header dropped by the browser, an option ignored from a cURL command, a history that cannot be read) is told to the user.
- **Data from outside is validated.** History, opened files and handoffs are read field by field with size limits; anything unexpected is rejected.
