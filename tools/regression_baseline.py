"""Create or verify regression metrics for the unchanged gym_trainer engine."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import cv2

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

import gym_trainer as trainer


BASELINE_PATH = REPOSITORY_ROOT / "tests" / "regression" / "baselines.json"
CANONICAL_VIDEOS = {
    "squat": "vids/squat/squat1.mp4",
    "pushup": "vids/pushups1.mp4",
    "bicep_curl": "vids/bicep_curls/bicep1.mp4",
    "lunge": "vids/lunges/lunges1.mp4",
    "deadlift": "vids/deadlift/deadlift1.mp4",
    "shoulder_press": None,
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def analyze_video(exercise: str, relative_path: str) -> dict[str, Any]:
    """Run the active trainer over one canonical clip and collect its outputs."""
    path = REPOSITORY_ROOT / relative_path
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Unable to open baseline video: {relative_path}")

    frames_per_second = capture.get(cv2.CAP_PROP_FPS) or 0.0
    source_frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    frame_interval = 1 / frames_per_second if frames_per_second else 1 / 30
    simulated_time = 0.0
    original_time = trainer.time.time

    def video_time() -> float:
        return simulated_time

    # The engine's cooldowns use wall-clock time. Replacing that source only
    # within this offline runner makes video playback reproducible regardless
    # of machine speed, while leaving gym_trainer.py unchanged.
    trainer.time.time = video_time
    trainer.start_session(exercise, target_reps=10_000, target_sets=1)

    correction_messages: Counter[str] = Counter()
    correction_events = 0
    processed_frames = 0
    try:
        while True:
            success, frame = capture.read()
            if not success:
                break
            simulated_time = processed_frames * frame_interval
            trainer.process_frame(frame)
            processed_frames += 1
            for violation in trainer.state["form_violations"]:
                correction_events += 1
                correction_messages[violation["message"]] += 1
    finally:
        capture.release()
        trainer.time.time = original_time

    form_scores = trainer.session["current_set_form_scores"]
    return {
        "status": "recorded",
        "source": relative_path,
        "source_sha256": sha256_file(path),
        "source_frame_count": source_frame_count,
        "processed_frame_count": processed_frames,
        "duration_seconds": round(source_frame_count / frames_per_second, 3)
        if frames_per_second
        else None,
        "reps": trainer.state["counter"],
        "form_score": round(sum(form_scores) / len(form_scores), 2)
        if form_scores
        else None,
        "per_rep_form_scores": form_scores,
        "corrections": {
            "event_count": correction_events,
            "messages": dict(sorted(correction_messages.items())),
        },
    }


def create_report(exercise_names: list[str] | None = None) -> dict[str, Any]:
    """Create a report for each supported exercise and its corpus state."""
    exercises: dict[str, Any] = {}
    selected = exercise_names or list(CANONICAL_VIDEOS)
    for exercise in selected:
        relative_path = CANONICAL_VIDEOS[exercise]
        if relative_path is None:
            exercises[exercise] = {
                "status": "missing_corpus",
                "reason": "No local shoulder-press video is available.",
            }
            continue
        exercises[exercise] = analyze_video(exercise, relative_path)

    return {
        "baseline_version": 1,
        "engine": "gym_trainer.py",
        "exercises": exercises,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="Write current metrics.")
    mode.add_argument("--verify", action="store_true", help="Compare metrics to baseline.")
    parser.add_argument(
        "--exercise",
        choices=sorted(CANONICAL_VIDEOS),
        help="Run one exercise, useful where the local runner has a short timeout.",
    )
    arguments = parser.parse_args()
    selected = [arguments.exercise] if arguments.exercise else None
    report = create_report(selected)

    if arguments.write:
        if BASELINE_PATH.exists() and selected:
            existing = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
            existing["exercises"].update(report["exercises"])
            report = existing
        BASELINE_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {BASELINE_PATH.relative_to(REPOSITORY_ROOT)}")
        return 0

    expected = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    if selected:
        expected = {**expected, "exercises": {
            name: expected["exercises"][name] for name in selected
        }}
    if report != expected:
        print("Regression baseline mismatch.", file=sys.stderr)
        return 1
    print("Regression baselines match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
