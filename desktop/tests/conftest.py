import json
import os
from pathlib import Path

# Interface tests run without opening windows
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

SHARED_CASES = Path(__file__).resolve().parents[2] / "shared" / "test-cases"


def as_json(value):
    """What JSON keeps of a value, as the files hold it (tuples become lists, None keys stay None)."""
    return json.loads(json.dumps(value, ensure_ascii=False))
