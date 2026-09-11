"""Focused tests for per-workout session state isolation in gym_trainer and main."""

import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

import gym_trainer as gt
from main import app


class TestSessionIsolation(unittest.TestCase):

    def setUp(self):
        # Reset any active sessions
        for sid in list(gt._sessions.keys()):
            if sid != gt.DEFAULT_SESSION_ID:
                gt.delete_session(sid)
        gt.reset_state(session_id=gt.DEFAULT_SESSION_ID)

    def test_session_state_independence(self):
        """Verify two sessions maintain completely separate rep counts, exercises, and form metrics."""
        sid_a = "session_A"
        sid_b = "session_B"

        # Start Session A (Squat, 5 reps)
        gt.start_session("squat", target_reps=5, target_sets=2, session_id=sid_a)
        
        # Start Session B (Pushup, 10 reps)
        gt.start_session("pushup", target_reps=10, target_sets=3, session_id=sid_b)

        sess_a = gt.get_session_state(sid_a)
        sess_b = gt.get_session_state(sid_b)

        # 1. Exercise configuration independence
        self.assertEqual(sess_a.state["current_exercise"], "squat")
        self.assertEqual(sess_b.state["current_exercise"], "pushup")
        self.assertEqual(sess_a.session["target_reps"], 5)
        self.assertEqual(sess_b.session["target_reps"], 10)

        # 2. Separate MediaPipe Pose tracker instances
        self.assertIsNot(sess_a.pose, sess_b.pose)

        # 3. Mutate rep counter & stage in Session A
        sess_a.state["counter"] = 3
        sess_a.state["stage"] = "down"
        sess_a.state["form_metrics"] = {"knee_cave": 12.5}
        sess_a.state["form_violations"] = [{"check": "knee_cave", "value": 12.5, "message": "Knee cave detected"}]

        # 4. Verify Session B is completely untouched
        self.assertEqual(sess_b.state["counter"], 0)
        self.assertIsNone(sess_b.state["stage"])
        self.assertEqual(sess_b.state["form_metrics"], {})
        self.assertEqual(sess_b.state["form_violations"], [])

        # 5. Mutate Session B
        sess_b.state["counter"] = 7
        sess_b.state["stage"] = "up"

        # 6. Re-verify Session A remains unchanged
        self.assertEqual(sess_a.state["counter"], 3)
        self.assertEqual(sess_a.state["stage"], "down")

    def test_session_cleanup(self):
        """Verify explicit ending and deletion of sessions."""
        sid = "temp_session_cleanup_test"
        gt.start_session("deadlift", target_reps=5, target_sets=1, session_id=sid)
        
        self.assertIn(sid, gt._sessions)
        initial_count = gt.get_active_session_count()

        # End session
        gt.end_session(sid)
        self.assertNotIn(sid, gt._sessions)
        self.assertEqual(gt.get_active_session_count(), initial_count - 1)

    def test_api_session_isolation_endpoints(self):
        """Verify FastAPI endpoints pass and isolate session_id correctly."""
        client = TestClient(app)

        # Start Session 1
        res1 = client.post("/start_session", json={"exercise": "lunge", "target_reps": 8, "target_sets": 2})
        self.assertEqual(res1.status_code, 200)
        sid1 = res1.json()["session_id"]

        # Start Session 2
        res2 = client.post("/start_session", json={"exercise": "bicep_curl", "target_reps": 12, "target_sets": 3})
        self.assertEqual(res2.status_code, 200)
        sid2 = res2.json()["session_id"]

        self.assertNotEqual(sid1, sid2)

        # Fetch stats for Session 1
        stats1 = client.get(f"/stats?session_id={sid1}").json()
        self.assertEqual(stats1["exercise"], "lunge")
        self.assertEqual(stats1["target_reps"], 8)
        self.assertEqual(stats1["session_id"], sid1)

        # Fetch stats for Session 2
        stats2 = client.get(f"/stats?session_id={sid2}").json()
        self.assertEqual(stats2["exercise"], "bicep_curl")
        self.assertEqual(stats2["target_reps"], 12)
        self.assertEqual(stats2["session_id"], sid2)

        # End Session 1
        end_res = client.post("/end_session", json={"session_id": sid1})
        self.assertEqual(end_res.status_code, 200)
        self.assertNotIn(sid1, gt._sessions)


if __name__ == "__main__":
    unittest.main()
