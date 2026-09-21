"""User-facing copy rules: no em dashes or emoji in text the UI or the video overlay shows."""

import io
import os
import sys
import tokenize
from pathlib import Path

os.environ.setdefault("GROQ_API_KEY", "test-key-not-used")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import gym_trainer as gt
from app.schemas.report import AIReportStructuredSchema
from app.services.ai_service import _plain, _plain_report, format_report_markdown

EM_DASH = "—"


def _strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from _strings(k)
            yield from _strings(v)
    elif isinstance(node, (list, tuple)):
        for item in node:
            yield from _strings(item)


def _engine_copy():
    """Every string held in the engine's module-level configuration tables."""
    for name, value in vars(gt).items():
        if name.isupper() and isinstance(value, (dict, list, tuple)):
            yield from _strings(value)


def test_engine_messages_have_no_em_dashes():
    """Scans every string literal in the engine source (feedback text lives in functions as well as tables).

    Comments and docstrings are developer prose, not user-facing copy, so they are skipped.
    """
    source = (Path(gt.__file__)).read_text(encoding="utf-8")
    offenders = [
        tok.string
        for tok in tokenize.generate_tokens(io.StringIO(source).readline)
        if tok.type == tokenize.STRING and not tok.string.startswith(('"""', "'''")) and EM_DASH in tok.string
    ]
    assert offenders == []


def test_engine_hud_units_are_drawable_by_opencv():
    """OpenCV's built-in fonts cannot draw the degree sign; it renders as '??'."""
    units = [c["unit"] for checks in gt.FORM_CHECKS.values() for c in checks]
    assert units, "expected form checks to define units"
    assert all("°" not in u for u in units)


def test_engine_overlay_messages_avoid_the_degree_sign():
    fails = [c["messages"]["fail"] for checks in gt.FORM_CHECKS.values() for c in checks]
    assert all("°" not in m for m in fails)


def test_ai_text_is_stripped_of_em_dashes():
    assert _plain(f"Depth was steady {EM_DASH} knees drifted late.") == "Depth was steady, knees drifted late."
    assert _plain(f"tight{EM_DASH}fast") == "tight, fast"

    report = AIReportStructuredSchema(
        overall_score=80,
        form_score=80,
        strengths=[f"a {EM_DASH} b"],
        mistakes=[f"c {EM_DASH} d"],
        improvements=[f"e {EM_DASH} f"],
        coach_summary=f"g {EM_DASH} h",
        next_session_focus=f"i {EM_DASH} j",
        motivation=f"k {EM_DASH} l",
    )
    cleaned = _plain_report(report)
    assert EM_DASH not in "".join(_strings(cleaned.model_dump()))


def test_stored_report_markdown_has_no_emoji():
    report = AIReportStructuredSchema(
        overall_score=80, form_score=80, strengths=["s"], mistakes=["m"], improvements=["i"],
        coach_summary="c", next_session_focus="n", motivation="x",
    )
    markdown = format_report_markdown("squat", report)
    assert all(ord(ch) < 0x2000 for ch in markdown)
