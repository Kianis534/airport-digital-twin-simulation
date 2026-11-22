from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("streamlit")
from streamlit.testing.v1 import AppTest  # noqa: E402

APP = Path(__file__).resolve().parent.parent / "streamlit_app" / "app.py"


def test_app_renders_and_reacts_to_levers():
    at = AppTest.from_file(str(APP), default_timeout=120).run()
    assert not at.exception
    labels = [m.label for m in at.metric]
    assert "Security wait p95" in labels

    at.slider(key="security_lanes").set_value(3).run()
    assert not at.exception
    wait = next(m for m in at.metric if m.label == "Security wait p95")
    assert float(wait.value.split()[0]) > 15
