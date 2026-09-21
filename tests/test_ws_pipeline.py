"""Tests for the /ws/webcam frame pipeline: one response per frame, skipped-frame
acknowledgement, thread-safe MediaPipe tracker handling, and single Pose creation."""

import inspect
import logging
import sys
import threading
import unittest
from pathlib import Path
from unittest import mock

import cv2
import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

import gym_trainer as gt
import main
from main import app
from app.db.session import get_db
from app.models.base import Base

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _jpeg(width: int = 640, height: int = 480) -> bytes:
    rng = np.random.default_rng(0)
    frame = rng.integers(0, 255, size=(height, width, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    assert ok
    return buf.tobytes()


def _start_owned_session(client: TestClient, email: str) -> tuple[str, str]:
    client.post("/api/v1/auth/register", json={"name": "WS Tester", "email": email, "password": "TestPassword123!"})
    token = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "TestPassword123!"}
    ).json()["data"]["access_token"]
    res = client.post(
        "/api/v1/sessions/start",
        json={"exercise": "squat", "target_reps": 5, "target_sets": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    return res.json()["data"]["session_id"], token


class TestWsFramePipeline(unittest.TestCase):

    def setUp(self):
        for sid in list(gt._sessions.keys()):
            if sid != gt.DEFAULT_SESSION_ID:
                gt.delete_session(sid)
        app.dependency_overrides[get_db] = override_get_db
        Base.metadata.create_all(bind=engine)

    def tearDown(self):
        db = TestingSessionLocal()
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
        db.close()

    def test_every_frame_gets_exactly_one_annotated_jpeg_in_order(self):
        client = TestClient(app)
        sid, token = _start_owned_session(client, "ws_frames@example.com")

        with client.websocket_connect(f"/ws/webcam?session_id={sid}&token={token}") as ws:
            for _ in range(3):
                ws.send_bytes(_jpeg())
                reply = ws.receive_bytes()
                annotated = cv2.imdecode(np.frombuffer(reply, np.uint8), cv2.IMREAD_COLOR)
                self.assertIsNotNone(annotated)
                self.assertEqual(annotated.shape[:2], (480, 640))

    def test_undecodable_frame_is_acknowledged_with_empty_message(self):
        """The browser send loop is one-response-per-frame; a silent skip would stall it."""
        client = TestClient(app)
        sid, token = _start_owned_session(client, "ws_skip@example.com")

        with client.websocket_connect(f"/ws/webcam?session_id={sid}&token={token}") as ws:
            ws.send_bytes(b"this is not a jpeg")
            self.assertEqual(ws.receive_bytes(), b"")
            # The connection stays usable afterwards.
            ws.send_bytes(_jpeg())
            self.assertGreater(len(ws.receive_bytes()), 0)

    def test_response_jpeg_quality_is_below_opencv_default(self):
        """Guards the downstream payload size: cv2.imencode defaults to quality 95."""
        self.assertLess(main.WS_RESPONSE_JPEG_QUALITY, 95)

    def test_access_token_is_redacted_from_uvicorn_log_lines(self):
        flt = main._RedactTokenFilter()
        record = logging.LogRecord(
            "uvicorn.error", logging.INFO, __file__, 0,
            '%s - "WebSocket %s" [accepted]',
            (("127.0.0.1", 1234), "/ws/webcam?session_id=abc&token=eyJhbGciOi.secret.sig"),
            None,
        )
        self.assertTrue(flt.filter(record))
        rendered = record.getMessage()
        self.assertNotIn("eyJhbGciOi", rendered)
        self.assertIn("session_id=abc", rendered)
        self.assertIn("token=[redacted]", rendered)

    def test_stats_endpoint_runs_in_threadpool(self):
        """/stats does synchronous DB I/O; as `async def` it would block the event loop."""
        self.assertFalse(inspect.iscoroutinefunction(main.get_stats))

    def test_start_session_creates_one_pose_for_a_new_session(self):
        real_create = gt._create_pose
        created = []

        def counting_create():
            pose = real_create()
            created.append(pose)
            return pose

        with mock.patch.object(gt, "_create_pose", side_effect=counting_create):
            gt.start_session("squat", 5, 1, session_id="pose_count_sess")
            self.assertEqual(len(created), 1, "a new session must not build a second Pose")

            first_pose = gt.get_session_state("pose_count_sess").pose
            self.assertIs(first_pose, created[0])

            # Re-starting an existing session resets the tracker with a fresh Pose.
            gt.start_session("squat", 5, 1, session_id="pose_count_sess")
            self.assertEqual(len(created), 2)
            self.assertIsNot(gt.get_session_state("pose_count_sess").pose, first_pose)

    def test_delete_session_waits_for_frame_in_progress(self):
        """pose.close() must never run while another thread is inside process_frame()."""
        sid = "lock_sess"
        gt.start_session("squat", 5, 1, session_id=sid)
        sess = gt.get_session_state(sid)
        closed = threading.Event()
        real_close = sess.pose.close
        sess.pose.close = lambda: (closed.set(), real_close())

        in_frame = threading.Event()
        release_frame = threading.Event()

        def fake_frame_worker():
            with sess.lock:
                in_frame.set()
                release_frame.wait(timeout=5)

        worker = threading.Thread(target=fake_frame_worker)
        worker.start()
        self.assertTrue(in_frame.wait(timeout=5))

        deleter = threading.Thread(target=gt.delete_session, args=(sid,))
        deleter.start()
        self.assertFalse(closed.wait(timeout=0.3), "pose was closed while a frame held the session lock")

        release_frame.set()
        worker.join(timeout=5)
        deleter.join(timeout=5)
        self.assertTrue(closed.is_set())


if __name__ == "__main__":
    unittest.main()
