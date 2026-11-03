# Api2Data · Desktop

Desktop version of Api2Data: Python + PySide6.

It does the same as the web version, on your computer and without a browser, so **CORS does not apply**: an API that only answers its own website or servers answers here too. The core passes the same test cases from [`shared/test-cases/`](../shared/README.md) as the web version, so requests are prepared, checked, formatted and saved the same way.

What the tool does and its philosophy are in the [main README](../README_en.md).

## Download

| System | File |
|---|---|
| macOS (Apple Silicon) | [Api2Data-macOS.dmg](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-macOS.dmg) |
| Windows (x64) | [Api2Data-Windows.zip](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Windows.zip) |
| Windows (ARM64) | [Api2Data-Windows-ARM64.zip](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Windows-ARM64.zip) |
| Linux (x64) | [Api2Data-Linux.tar.gz](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Linux.tar.gz) |
| Linux (ARM64, Ubuntu 24.04 or newer) | [Api2Data-Linux-ARM64.tar.gz](https://github.com/RaulEstevezA/Api2Data/releases/latest/download/Api2Data-Linux-ARM64.tar.gz) |

Every version is in [Releases](https://github.com/RaulEstevezA/Api2Data/releases).

> [!NOTE]
> The packaged app has been built and checked on **macOS** (Apple Silicon). The Windows and Linux builds are compiled by GitHub Actions and pass the tests and an automatic start-up check, but nobody has used them on a real computer yet. If you find a problem, write to [contact.raulesteveza@gmail.com](mailto:contact.raulesteveza@gmail.com).

- **macOS:** open the `.dmg` and drag Api2Data to Applications.
- **Windows:** unzip the `.zip` and run `Api2Data.exe` inside the `Api2Data` folder.
- **Linux:** extract with `tar -xzf Api2Data-Linux.tar.gz` (or `Api2Data-Linux-ARM64.tar.gz`) and run `Api2Data/Api2Data`. Some distributions need `libxcb-cursor0`. The ARM64 version needs a 2024 or newer distribution (glibc 2.39, like Ubuntu 24.04).

### Opening it the first time

The app is not signed (signing requires paid Apple and Microsoft accounts), so the system shows a warning the first time it is opened:

- **macOS** says it could not verify that the app is free of malware. Click **Done**, go to **System Settings → Privacy & Security**, scroll down to **Security** and click **Open Anyway**. This is only needed once.
- **Windows** shows "Windows protected your PC". Click **More info** and then **Run anyway**.

The code is the one in this repository, and the files are built by GitHub Actions ([workflow](../.github/workflows/release-desktop.yml)).

## Run locally

Requirements: Python 3.11 or newer.

```bash
cd desktop
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
python -m pytest                   # tests (shared cases from shared/test-cases/)
ruff check .                       # static analysis
python -m api2data                 # run the application
```

## Build the executable

```bash
pip install -e ".[build]"
pyinstaller packaging/api2data.spec
dist/Api2Data.app/Contents/MacOS/Api2Data --smoke-test   # macOS; dist/Api2Data/Api2Data elsewhere
```

The result is in `dist/`: `Api2Data.app` on macOS and an `Api2Data` folder with the executable on Windows and Linux. PyInstaller does not cross-compile: each system is built on its own operating system. `--smoke-test` opens the window, loads every example, writes every code target, sends a real request to a server on the same computer (compressed, with accents), and saves and opens a request file, to check that nothing was left out of the package.

## Structure

```
api2data/
  core/            Logic without interface: each module is the counterpart of one in web/src/core/
    request/       URL and params, headers, preparation, redaction, stored drafts
    auth/, body/   Authorization types and body modes
    response/      Content type and charset, views, status, processing
    history/       History entries and their storage
    importing/     cURL commands and request files
    codegen/       cURL, JavaScript and Python
    execute/       Sending with the standard library (desktop only)
  app/             The request being edited (counterpart of web/src/app/draft.ts)
  ui/              Interface with PySide6
  assets/          Icon and check mark
packaging/         PyInstaller configuration, app icons and smoke test
tests/             Tests with pytest, reading the cases from shared/test-cases/
pyproject.toml     Dependencies and configuration
```

## Tests

The core is checked against [`shared/test-cases/`](../shared/README.md), the same files the web version's tests read: 221 calls of the core (URL and params, headers, authorization, bodies, request preparation, redaction, JSON and XML formatting, charsets, response processing, cURL commands, request files, history and the generated code). Every one gives the same result as the web version. Sending is tested against an HTTP server on the same computer (methods, headers and body as written, error statuses, redirects, compression, an unreachable server, timeouts, cancelling), and the interface tests open the window without showing it (`QT_QPA_PLATFORM=offscreen`).

## Differences with the web version

- **No CORS and no mixed content**: requests do not go through a browser. Every header is sent as written (`Cookie`, `Host`, `User-Agent`…), and the failures are the ones of a network: the server cannot be reached, it takes more than 60 seconds, or its certificate is not valid.
- **The history** is kept on this computer, in the system's settings, instead of the browser's storage. The same options apply: it can be turned off or cleared, and credentials are left out unless chosen.
- **Request files** are opened and saved with the system's dialogs; the format is the same, so a request saved in one version opens in the other.
- **No links**: the app works on its own. The credit opens the portfolio in the browser.

## Privacy

Requests go from this computer to the API, with no server in between. Nothing else is sent anywhere. The history is kept in the system's settings, without tokens, passwords or keys unless chosen; preferences (language, history options, code language) are kept there too.

[Back to main README](../README_en.md)
