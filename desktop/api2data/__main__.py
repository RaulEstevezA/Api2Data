"""Entry point: python -m api2data or the api2data command."""

import sys


def main() -> None:
    from .ui.app import run

    sys.exit(run())


if __name__ == "__main__":
    main()
