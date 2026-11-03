# Interoperability

Api2Data works alone. Three formats let a request or a response leave the tab: request files, the local history and the handoff to Api2Class.

| Format | What it holds | Used for |
|---|---|---|
| `api2data-request` | One request, without credentials | Saving a request to reopen or share it |
| History (`api2data.history`) | The latest 50 requests sent, with their result | Loading an earlier request in the same browser |
| `json-handoff` | A JSON response and where it came from | Opening a response in Api2Class |

## Request file (version 1)

Saved by **Save** as `<last part of the path>.api2data.json`, read by **Open**.

```json
{
  "format": "api2data-request",
  "version": 1,
  "exportedAt": "2026-11-03T10:00:00.000Z",
  "request": {
    "method": "POST",
    "url": "https://api.example.com/users?notify=true",
    "params": [{ "key": "notify", "value": "true", "enabled": true }],
    "headers": [{ "key": "Accept", "value": "application/json", "enabled": true }],
    "auth": {
      "type": "bearer",
      "settings": {
        "none": {},
        "bearer": { "token": "" },
        "basic": { "username": "", "password": "" },
        "apiKey": { "name": "X-API-Key", "value": "", "location": "header" }
      }
    },
    "body": {
      "mode": "json",
      "text": { "json": "{\n  \"name\": \"Raúl Estévez\"\n}", "text": "", "xml": "" },
      "form": []
    }
  }
}
```

- `params` mirrors the query string of `url`; the URL decides the enabled ones, and disabled rows are kept from `params`.
- Credentials are always removed before writing (`request/redact.ts`): tokens, passwords, API key values, user info in the URL, and the values of headers and parameters whose name looks secret. The authorization type, the API key name and location and the Basic user name are kept, so the request only needs its secret again.
- On reading, every field is checked (`request/draftFormat.ts`); missing optional parts take their defaults, and a different `version` is reported instead of guessed.
- **Open** also accepts a text file holding a cURL command.

## History (version 1)

Stored in `localStorage` under `api2data.history`, only while "Save the history in this browser" is on (the default).

```json
{
  "version": 1,
  "entries": [
    {
      "sentAt": "2026-11-03T10:00:00.000Z",
      "draft": { "method": "GET", "url": "https://api.example.com/users", "params": [], "headers": [], "auth": { "type": "none", "settings": {} }, "body": { "mode": "none" } },
      "outcome": { "status": 200 },
      "withCredentials": false
    }
  ]
}
```

- `outcome` is `{ "status": <code> }` or `{ "failure": "blocked" | "offline" | "mixedContent" | "interrupted" }`. Cancelled requests are not saved.
- Entries are redacted like request files unless "Also save tokens, passwords and keys" is on; those entries have `withCredentials: true`. Turning the option off redacts them again.
- A different `version` or damaged data is reported to the user, who then starts a new history; it is never dropped silently. Entries that cannot be read are skipped.
- Preferences: `api2data.history.enabled`, `api2data.history.credentials`.

## Handoff to Api2Class (json-handoff, version 1)

Implemented in `core/handoff/api2class.ts`; Api2Class reads it in `web/src/core/incoming.ts`. Following the continuity convention of `personal_web_style` (`patterns/tool-continuity.md`), the "Open in Api2Class" action is shown next to Copy and Download once the receiving version of Api2Class is published.

```json
{
  "format": "json-handoff",
  "version": 1,
  "from": "api2data",
  "text": { "format": "json", "content": "{ … the response body, as received … }" },
  "source": { "method": "GET", "url": "https://api.example.com/users" }
}
```

1. Api2Data stores it in `sessionStorage` under `api2class.incoming` and opens `/tools/Api2Class/` in the same tab (same origin: `raulesteveza.github.io`).
2. Api2Class reads it once, removes it, checks every field (format, version, sender, size up to 4 MB) and loads the content into its input as if it had been pasted, with the line "Response received from Api2Data (GET …)".
3. `source.url` never carries the query string or user info, which may hold credentials.

The URL is never used to pass the content: responses can be large and would stay in the browser history.
