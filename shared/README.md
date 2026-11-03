# Shared

Language-neutral resources used by both the web (TypeScript) and desktop (Python) versions.

## test-cases/

Test cases that define the expected behavior of the core. The Vitest suite (`web/src/core/shared.test.ts`) and the pytest suite (`desktop/tests/test_shared_calls.py`) load the same files, so if one implementation behaves differently, its tests fail.

| Folder | What it checks |
|---|---|
| `calls/<module>.<function>.json` | Arguments of a core function and the result it gives, as JSON: URL and params, headers, authorization, bodies, request preparation, redaction, stored drafts, JSON and XML formatting, content types, response views and processing, cURL commands, request files, history and generated code |

In the files, a missing key is `undefined` and `null` is `null`. A few functions are called through a small wrapper, the same in both suites:

- Functions that create rows receive ids `id-1`, `id-2`… starting again on every call.
- `process.processResponse` receives the body as text instead of bytes, and its result leaves the bytes out.
- `viewers.isBinary` receives the bytes as a list of numbers.
- `requestFile.createRequestFile` receives the date as ISO text.
- `codegen.generate` receives the target id and the prepared request.

### Updating the cases

When the web version changes on purpose, write the results again from what it does now:

```bash
cd web
UPDATE_SHARED=1 npx vitest run src/core/shared.test.ts
```

Then review the diff and port the change to `desktop/` until its tests pass. To add a case, add its arguments to a `calls/` file (the result is filled in by the update).

## How it maps to each version

Shared logic lives in a `core/` folder in each version, with no interface dependencies:

- Web: `web/src/core/` (TypeScript)
- Desktop: `desktop/api2data/core/` (Python)

A file in one `core/` has its counterpart in the other (`request/url.ts` / `request/url.py`), and both must pass the cases in `test-cases/`. In Python, drafts, requests and responses are dictionaries with the same keys as the JSON.

Not shared, because each version sends requests differently: the transport (`fetch` in the browser, the Python standard library on the desktop) and its failures (the browser's CORS and mixed content do not exist on the desktop), the handoff to Api2Class and reading a response pasted from curl, which only the web version needs.
