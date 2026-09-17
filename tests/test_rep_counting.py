"""Deterministic tests for gym_trainer's rep-counting state machine
(_advance_rep_state), driven with synthetic angle sequences — no webcam,
no video file, no MediaPipe pose inference involved.

Added for Milestone 7.6 (rep-counting reliability fix) alongside:
- consistent left/right side selection for the primary rep-counting angle
  (previously picked per-landmark independently, which could mix sides)
- CONFIRM_FRAMES consecutive-sample hysteresis before a stage transition
  commits, replacing single-frame threshold crossing as the trigger
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

import gym_trainer as gt


class _FakeSession:
    """Minimal stand-in for WorkoutSessionState — _advance_rep_state and
    _reset_rep_form_tracking only ever need `.state`, never `.pose` or
    `.session_id`, so this avoids loading a real MediaPipe model per test."""
    def __init__(self, state):
        self.state = state


# Bicep curl config used throughout: up_angle=155, down_angle=45 (wide gap,
# representative of all six exercises' generic thresholds).
CONFIG = gt.EXERCISES["bicep_curl"]
EXERCISE = "bicep_curl"


def new_rep_state():
    return gt._create_default_rep_state(EXERCISE)


def new_session_state(target_reps=10, target_sets=1):
    return gt._create_default_session_state(EXERCISE, target_reps=target_reps, target_sets=target_sets)


def advance(st, sn, angle, t):
    """One state-machine tick at time t with the given (already-smoothed) angle."""
    sess = _FakeSession(st)
    return gt._advance_rep_state(st, sn, sess, angle, t, CONFIG, EXERCISE)


class TestRepCountingStateMachine(unittest.TestCase):

    def test_complete_repetition_counts_exactly_one(self):
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        advance(st, sn, 170, t)                     # start: enters "up"
        self.assertEqual(st["stage"], "up")
        for _ in range(gt.CONFIRM_FRAMES):
            t += 0.05
            advance(st, sn, 30, t)                   # confirm "down"
        self.assertEqual(st["stage"], "down")
        for _ in range(gt.CONFIRM_FRAMES):
            t += 0.05
            advance(st, sn, 170, t)                  # confirm "up" -> counts
        self.assertEqual(st["counter"], 1)
        self.assertEqual(st["stage"], "up")

    def test_incomplete_repetition_never_reaches_down_angle(self):
        """Angle dips toward the midpoint but never crosses down_angle — no rep."""
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        advance(st, sn, 170, t)
        for angle in [120, 100, 90, 80, 90, 100, 120, 150, 170]:
            t += 0.1
            advance(st, sn, angle, t)
        self.assertEqual(st["counter"], 0)
        self.assertEqual(st["stage"], "up")

    def test_partial_movement_below_confirm_frames_does_not_transition(self):
        """A single frame below down_angle, immediately followed by recovery,
        must not be enough to enter 'down' when CONFIRM_FRAMES > 1."""
        if gt.CONFIRM_FRAMES < 2:
            self.skipTest("CONFIRM_FRAMES < 2 makes this scenario impossible by design")
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        advance(st, sn, 170, t)
        t += 0.1
        advance(st, sn, 30, t)                       # 1 frame past down_angle
        self.assertEqual(st["stage"], "up")           # not yet confirmed
        t += 0.1
        advance(st, sn, 170, t)                       # recovers before confirming
        self.assertEqual(st["stage"], "up")
        self.assertEqual(st["consec_down"], 0)
        self.assertEqual(st["counter"], 0)

    def test_jitter_around_threshold_does_not_falsely_transition(self):
        """Angle oscillates just below/above down_angle without ever holding —
        must never accumulate enough consecutive frames to transition."""
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        advance(st, sn, 170, t)
        for i in range(20):
            t += 0.05
            angle = 40 if i % 2 == 0 else 50   # alternating below/above 45
            advance(st, sn, angle, t)
        self.assertEqual(st["stage"], "up")
        self.assertEqual(st["counter"], 0)

    def test_rapid_but_legitimate_reps_are_not_silently_dropped(self):
        """Two full cycles completed well under the old 0.8s cooldown (but
        above the new 0.3s sanity floor) must both count — the confirm-frame
        hysteresis is the anti-jitter guard now, not a large wall-clock gate."""
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        advance(st, sn, 170, t)
        for _ in range(2):
            for _ in range(gt.CONFIRM_FRAMES):
                t += 0.1
                advance(st, sn, 30, t)
            for _ in range(gt.CONFIRM_FRAMES):
                t += 0.1
                advance(st, sn, 170, t)
        self.assertEqual(st["counter"], 2)

    def test_repeated_threshold_crossings_count_each_rep_exactly_once(self):
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        advance(st, sn, 170, t)
        for _ in range(5):
            for _ in range(gt.CONFIRM_FRAMES):
                t += 0.2
                advance(st, sn, 30, t)
            for _ in range(gt.CONFIRM_FRAMES):
                t += 0.2
                advance(st, sn, 170, t)
        self.assertEqual(st["counter"], 5)

    def test_starting_mid_descent_does_not_count_a_phantom_rep(self):
        """If the very first sample is already past down_angle (e.g. camera
        starts mid-motion), the state machine must NOT treat that as a
        confirmed 'down' without first confirming a starting 'up' position."""
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        for _ in range(gt.CONFIRM_FRAMES + 2):
            t += 0.1
            advance(st, sn, 30, t)   # already "down" from frame 1, never seen "up"
        self.assertIsNone(st["stage"])
        self.assertEqual(st["counter"], 0)

    def test_starting_at_lockout_enters_up_immediately(self):
        st, sn = new_rep_state(), new_session_state()
        advance(st, sn, 170, 0.0)
        self.assertEqual(st["stage"], "up")
        self.assertEqual(st["counter"], 0)

    def test_one_complete_movement_cannot_produce_plus_two(self):
        """Holding the top position for many extra frames after a rep
        completes must not increment the counter again without a fresh
        confirmed down->up cycle."""
        st, sn = new_rep_state(), new_session_state()
        t = 1000.0
        advance(st, sn, 170, t)
        for _ in range(gt.CONFIRM_FRAMES):
            t += 0.1
            advance(st, sn, 30, t)
        for _ in range(gt.CONFIRM_FRAMES):
            t += 0.1
            advance(st, sn, 170, t)
        self.assertEqual(st["counter"], 1)
        for _ in range(30):
            t += 0.1
            advance(st, sn, 170, t)   # stays at lockout — no re-arm
        self.assertEqual(st["counter"], 1)

    def test_set_completion_returns_true_and_stops_at_target(self):
        st, sn = new_rep_state(), new_session_state(target_reps=1, target_sets=1)
        sn["active"] = True
        t = 1000.0
        advance(st, sn, 170, t)
        for _ in range(gt.CONFIRM_FRAMES):
            t += 0.1
            advance(st, sn, 30, t)
        completed = False
        # complete_set() itself (rest timer, set bookkeeping) is out of scope
        # here — only that _advance_rep_state correctly detects target-reached
        # and signals its caller to stop.
        with patch.object(gt, "complete_set") as mock_complete_set:
            for _ in range(gt.CONFIRM_FRAMES):
                t += 0.1
                completed = advance(st, sn, 170, t) or completed
        self.assertTrue(completed)
        self.assertEqual(st["counter"], 1)
        mock_complete_set.assert_called_once()


class TestProcessFrameNoLandmarks(unittest.TestCase):
    """Integration-level check: a frame with no detectable pose must not
    advance the rep counter or crash, exercised through the real
    process_frame() entrypoint (not the isolated state machine)."""

    def test_blank_frame_does_not_advance_or_crash(self):
        import numpy as np
        sid = "test_no_landmarks_session"
        gt.start_session("bicep_curl", target_reps=10, target_sets=1, session_id=sid)
        blank_frame = np.zeros((240, 320, 3), dtype=np.uint8)
        frame, state = gt.process_frame(blank_frame, session_id=sid)
        self.assertEqual(state["counter"], 0)
        gt.delete_session(sid)


if __name__ == "__main__":
    unittest.main()
