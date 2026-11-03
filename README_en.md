# Api2Data

Api2Data sends HTTP requests to an API and shows the response, from the browser. Requests go straight from your browser to the API: there is no proxy and no server of its own, and nothing you type is sent anywhere else.

```text
Write the URL  →  Set up the request (if needed)  →  Send  →  Inspect the response
```

## What it does

1. **Builds the request.** Method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS), address and, one section at a time:
   - **Params**: key / value rows that stay in sync with the URL; a row can be switched off without deleting it.
   - **Headers**: the same rows, plus the headers added automatically (Content-Type from the body, Authorization from its section), so nothing is sent without being seen.
   - **Authorization**: No Auth, Bearer Token, Basic Auth or API Key (as a header or a query parameter). Only the fields of the chosen type are shown; secrets are hidden until "Show" is pressed.
   - **Body**, for the methods that carry one: JSON (with validation that says the line, the column and the cause), Text, XML or Form URL Encoded.
   - **Code**: the same request as cURL, JavaScript (fetch) or Python (requests), ready to copy.
2. **Checks it before sending.** An invalid address, a JSON body with an error or a header the browser cannot send stops the request with an explanation. A missing protocol is completed with `https://`, and the tool says so.
3. **Shows the response**: status with its text, time, size and Content-Type, and a redirect if there was one. Then:
   - **Body**: JSON and XML formatted and highlighted (numbers keep their exact digits), HTML and text as they came, binary content offered as a download.
   - **Headers**: the response headers the browser exposes.
   - **Raw**: status line, headers and body as text.
   - Search (Ctrl/Cmd+F), Copy and Download.
4. **Explains failures.** When there is no response, it says what probably happened instead of "Failed to fetch": CORS, no connection, an http address from an https page, or a cancelled request.

## CORS

Api2Data runs in your browser and sends requests with `fetch`, so the browser applies its rules: the API has to allow requests from other websites (the `Access-Control-Allow-Origin` header). Many public APIs do; others only accept requests from their own site or from servers.

When a request is blocked, the browser gives no details to the page, so Api2Data lists the likely causes: the API does not allow other websites (or not this method or these headers), the address does not exist or cannot be reached, or an extension or the network blocks it. **A blocked request does not mean the API is down.**

When the browser blocks a request, the error offers two ways to get the response anyway:

- **curl**: "Copy as cURL" copies the command (with `-i`, so it prints the status and the headers). Run it in a terminal and paste its output with "Paste response": it is shown like any other response (status, headers, formatted body), except for the time, which Api2Data did not measure.
- **The desktop version**, once it is released: it sends the requests itself, not through a browser, so CORS does not apply. The download button matches your system and processor.

Api2Data does not use a proxy on purpose: it would see your requests, tokens and responses.

## Privacy

- Requests go from your browser to the API, with no server in between. Cookies and credentials stored in the browser are never added (`credentials: 'omit'`).
- Tokens, passwords and API keys are kept in memory, in the open tab.
- The **history** is saved in this browser only, and can be turned off or cleared. It leaves out tokens, passwords, API key values and the values of headers and parameters that look secret (`Authorization`, `X-API-Key`, `token`, `api_key`, `password`…). Keeping them is a separate option, off by default; entries saved that way are labeled "with credentials", and turning the option off removes them.
- **Saved request files** never include credentials.
- Preferences (language, the history options, the code language) are remembered; what you type is not, except the history.

## History, files and cURL

- **History**: every request sent (except cancelled ones) is added at the top, with its result; sending the latest one again updates it instead of repeating it. Up to 50 entries. Click one to load it.
- **Paste a cURL command** in the URL bar, as copied from the browser's developer tools ("Copy as cURL") or from an API's documentation: method, address, headers, authorization and body are filled in. What cannot be brought over (a body read from a file, multipart forms) is listed.
- **Save / Open**: a request saved as `.api2data.json` reopens later or on another computer; Open also reads a text file with a cURL command.

## Work with other tools

Api2Data is the first step of the family:

```text
Api2Data  →  Api2Class  →  Mapper  →  Model2DB
```

The JSON an API returns here is what [Api2Class](https://github.com/RaulEstevezA/Api2Class) turns into typed models. Api2Class already accepts a response sent from Api2Data; the "Open in Api2Class" action will be shown here once that version is published. The contract is in [docs/interoperability.md](docs/interoperability.md).

## Development

The web version is in [`web/`](./web): React, TypeScript and Vite, with CodeMirror for the editors and no component libraries; its look follows the shared design of the portfolio and the other tools.

```bash
cd web
npm install
npm run dev      # development server
npm run check    # types, lint, format and tests
npm run build    # production build in web/dist
```

The tests cover the core (URL and params, authorization, bodies, request preparation, failures, responses, history, imports, code generation — also running the generated Python and shell when `python3` and `bash` are installed) and the main interface flows.

## Repository structure

```
web/                     Web version (React + TypeScript + Vite)
  src/core/              Logic without interface: requests, auth, bodies, execution, responses, history, imports, code
  src/app/               Interface state outside the components (draft, sending, history)
  src/components/        React interface
docs/                    Technical documentation and images
```

## Documentation

| Document | Content |
|---|---|
| [architecture.md](docs/architecture.md) | Layers, folders, the request flow and how to extend it |
| [interoperability.md](docs/interoperability.md) | Request files, history format and the handoff to Api2Class |

## Suggestions

Ideas for improvements or bugs: write to [contact.raulesteveza@gmail.com](mailto:contact.raulesteveza@gmail.com).

## Developer

**Raul Estevez**

- [Personal Website](https://raulesteveza.github.io/)
- [LinkedIn Profile](https://www.linkedin.com/in/raulesteveza/)

## License

[MIT](./LICENSE)
