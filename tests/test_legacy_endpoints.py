"""Security tests for the legacy (non /api/v1) workout endpoints.

/start_session, /end_session, /webcam_feed, /upload_video and /uploaded_feed used to be public.
They now require a signed-in user who owns the session_id, and /upload_video is size- and
type-limited with no temp-file leaks. The authenticated Next.js WebSocket path is not covered
here (see test_ws_pipeline.py / test_session_isolation.py).
"""
import asyncio
import io
import os
import tempfile

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import gym_trainer as gt
import main
from app.core.upload_limit import ENVELOPE_BYTES, UploadGuardMiddleware
from app.db.session import get_db
from app.models import Base

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(main.app)


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    main.app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    # Every temporary upload lands in tmp_path, so "no leftover file" is simply "tmp_path is empty".
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    main.uploaded_video_paths.clear()
    yield tmp_path
    main.uploaded_video_paths.clear()
    for sid in list(gt._sessions):
        if sid != gt.DEFAULT_SESSION_ID:
            gt.delete_session(sid)
    db = TestingSessionLocal()
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    db.close()


def _user(email: str) -> dict:
    client.post("/api/v1/auth/register", json={
        "name": "Legacy Tester", "email": email, "password": "TestPassword123!", "accept_terms": True,
    })
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "TestPassword123!"}).json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _owned_session(headers: dict) -> str:
    res = client.post("/api/v1/sessions/start", headers=headers, json={"exercise": "squat", "target_reps": 5, "target_sets": 1})
    return res.json()["data"]["session_id"]


def _upload(headers, sid, name="clip.mp4", data=b"v" * 2048):
    return client.post(f"/upload_video?session_id={sid}", headers=headers, files={"file": (name, data, "video/mp4")})


def _files(path) -> list:
    return sorted(os.listdir(path))


# ── Authentication and ownership ──────────────────────────────────────────────

def test_legacy_endpoints_reject_anonymous_callers(isolated):
    sid = _owned_session(_user("anon_owner@example.com"))
    assert client.post("/start_session", json={"session_id": sid}).status_code == 401
    assert client.post("/end_session", json={"session_id": sid}).status_code == 401
    assert client.get(f"/webcam_feed?session_id={sid}").status_code == 401
    assert client.get(f"/uploaded_feed?session_id={sid}").status_code == 401
    assert client.post(f"/upload_video?session_id={sid}", files={"file": ("a.mp4", b"v", "video/mp4")}).status_code == 401
    assert _files(isolated) == []


def test_upload_with_invalid_token_is_rejected_and_writes_nothing(isolated):
    sid = _owned_session(_user("badtoken_owner@example.com"))
    res = _upload({"Authorization": "Bearer not-a-real-token"}, sid)
    assert res.status_code == 401
    assert _files(isolated) == []


def test_legacy_endpoints_hide_other_users_sessions(isolated, monkeypatch):
    owner = _user("owner@example.com")
    intruder = _user("intruder@example.com")
    sid = _owned_session(owner)
    monkeypatch.setattr(main, "webcam_stream", lambda session_id=None: iter([b"--frame\r\n"]))

    assert client.post("/start_session", headers=intruder, json={"session_id": sid}).status_code == 404
    assert client.post("/end_session", headers=intruder, json={"session_id": sid}).status_code == 404
    assert client.get(f"/webcam_feed?session_id={sid}", headers=intruder).status_code == 404
    assert client.get(f"/uploaded_feed?session_id={sid}", headers=intruder).status_code == 404
    assert _upload(intruder, sid).status_code == 404
    assert _files(isolated) == []
    assert sid in gt._sessions, "an intruder's end_session must not destroy the owner's state"


def test_legacy_endpoints_require_a_session_id(isolated):
    headers = _user("nosid@example.com")
    assert client.post("/start_session", headers=headers, json={"exercise": "squat"}).status_code == 404
    assert client.post("/end_session", headers=headers, json={}).status_code == 404
    assert client.get("/webcam_feed", headers=headers).status_code == 404
    assert client.get("/uploaded_feed", headers=headers).status_code == 404
    res = client.post("/upload_video", headers=headers, files={"file": ("a.mp4", b"v", "video/mp4")})
    assert res.status_code == 404
    assert _files(isolated) == []


def test_owner_can_start_and_end_a_legacy_session(isolated):
    headers = _user("legacy_owner@example.com")
    sid = _owned_session(headers)

    res = client.post("/start_session", headers=headers, json={
        "session_id": sid, "exercise": "pushup", "target_reps": 4, "target_sets": 2,
    })
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "session_id": sid}
    assert gt.get_session_state(sid).state["current_exercise"] == "pushup"

    assert client.post("/end_session", headers=headers, json={"session_id": sid}).status_code == 200
    assert sid not in gt._sessions


def test_owner_can_open_webcam_feed(monkeypatch):
    headers = _user("cam_owner@example.com")
    sid = _owned_session(headers)
    # Never open a real camera from a test.
    monkeypatch.setattr(main, "webcam_stream", lambda session_id=None: iter([b"--frame\r\n"]))
    assert client.get(f"/webcam_feed?session_id={sid}", headers=headers).status_code == 200


# ── /upload_video behaviour ───────────────────────────────────────────────────

def test_owner_upload_is_stored_and_replaced_without_leaking(isolated):
    headers = _user("uploader@example.com")
    sid = _owned_session(headers)

    assert _upload(headers, sid, data=b"a" * 1500).status_code == 200
    first = main.uploaded_video_paths[sid]
    assert os.path.exists(first) and first.endswith(".mp4")

    assert _upload(headers, sid, name="second.webm", data=b"b" * 1500).status_code == 200
    second = main.uploaded_video_paths[sid]
    assert second != first
    assert not os.path.exists(first), "the replaced temp upload must be deleted"
    assert os.path.exists(second) and second.endswith(".webm")
    assert _files(isolated) == [os.path.basename(second)]


def test_unsupported_extension_is_415_and_writes_nothing(isolated):
    headers = _user("badext@example.com")
    sid = _owned_session(headers)
    for name in ("payload.exe", "noextension", "clip.mp4.sh", "script.php"):
        assert _upload(headers, sid, name=name).status_code == 415, name
    assert _files(isolated) == []
    assert sid not in main.uploaded_video_paths


def test_extension_check_is_case_insensitive(isolated):
    headers = _user("caseext@example.com")
    sid = _owned_session(headers)
    assert _upload(headers, sid, name="CLIP.MP4").status_code == 200


def test_oversize_upload_is_413_and_leaves_no_file(isolated, monkeypatch):
    headers = _user("bigfile@example.com")
    sid = _owned_session(headers)
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 1024)   # file cap; well inside the middleware envelope
    monkeypatch.setattr(main, "UPLOAD_CHUNK_BYTES", 256)

    res = _upload(headers, sid, data=b"z" * 4096)
    assert res.status_code == 413
    assert _files(isolated) == []
    assert sid not in main.uploaded_video_paths


def test_oversize_upload_keeps_the_previous_upload(isolated, monkeypatch):
    headers = _user("keepold@example.com")
    sid = _owned_session(headers)
    assert _upload(headers, sid, data=b"a" * 500).status_code == 200
    kept = main.uploaded_video_paths[sid]

    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 1024)
    assert _upload(headers, sid, data=b"z" * 4096).status_code == 413
    assert main.uploaded_video_paths[sid] == kept and os.path.exists(kept)


def test_upload_far_beyond_the_limit_is_rejected_by_the_guard_before_parsing(isolated, monkeypatch):
    headers = _user("hugefile@example.com")
    sid = _owned_session(headers)
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 1024)

    res = _upload(headers, sid, data=b"z" * (ENVELOPE_BYTES + 4096))   # over limit + envelope: turned away on Content-Length
    assert res.status_code == 413
    assert _files(isolated) == []


def test_uploaded_feed_streams_then_cleans_up(isolated):
    headers = _user("feed_owner@example.com")
    sid = _owned_session(headers)
    assert client.get(f"/uploaded_feed?session_id={sid}", headers=headers).json() == {"error": "No video uploaded for this session"}

    assert _upload(headers, sid).status_code == 200          # not a decodable video: OpenCV cannot open it
    res = client.get(f"/uploaded_feed?session_id={sid}", headers=headers)
    assert res.status_code == 200
    assert _files(isolated) == [], "the temp upload is removed once the stream ends"
    # Existing behaviour, deliberately unchanged: when OpenCV cannot open the file, video_stream
    # deletes it but leaves the (now stale) path entry until end_session or a replacement upload.


def test_end_session_deletes_the_temp_upload(isolated):
    headers = _user("end_cleanup@example.com")
    sid = _owned_session(headers)
    assert _upload(headers, sid).status_code == 200
    assert len(_files(isolated)) == 1

    assert client.post("/end_session", headers=headers, json={"session_id": sid}).status_code == 200
    assert _files(isolated) == []
    assert sid not in main.uploaded_video_paths


# ── _save_upload_to_temp: failure paths ───────────────────────────────────────

def test_partial_file_is_deleted_when_reading_fails(isolated):
    class FailingUpload:
        filename = "clip.mp4"

        def __init__(self):
            self.calls = 0

        async def read(self, size=-1):
            self.calls += 1
            if self.calls == 1:
                return b"x" * 10
            raise RuntimeError("connection dropped")

    with pytest.raises(RuntimeError):
        asyncio.run(main._save_upload_to_temp(FailingUpload(), 1000))
    assert _files(isolated) == []


def test_partial_file_is_deleted_when_the_cap_is_crossed(isolated, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_CHUNK_BYTES", 100)
    upload = UploadFile(file=io.BytesIO(b"q" * 950), filename="clip.mov")
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(main._save_upload_to_temp(upload, 300))
    assert excinfo.value.status_code == 413
    assert _files(isolated) == []


def test_file_exactly_at_the_cap_is_accepted(isolated, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_CHUNK_BYTES", 100)
    upload = UploadFile(file=io.BytesIO(b"q" * 300), filename="clip.mov")
    path = asyncio.run(main._save_upload_to_temp(upload, 300))
    assert os.path.getsize(path) == 300


# ── UploadGuardMiddleware (ASGI level) ────────────────────────────────────────

def _run_guard(headers, body_chunks, limit=1000, path="/upload_video", method="POST", scope_type="http"):
    """Drive the middleware with a fake app that reads the whole body, then answers 200."""
    sent, app_state = [], {"called": False}

    async def app(scope, receive, send):
        app_state["called"] = True
        while True:
            message = await receive()
            if message["type"] != "http.request" or not message.get("more_body"):
                break
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"app-response"})

    queue = [{"type": "http.request", "body": c, "more_body": i < len(body_chunks) - 1} for i, c in enumerate(body_chunks)]

    async def receive():
        return queue.pop(0) if queue else {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    scope = {"type": scope_type, "method": method, "path": path, "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()]}
    asyncio.run(UploadGuardMiddleware(app, "/upload_video", lambda: limit)(scope, receive, send))
    status = next((m["status"] for m in sent if m["type"] == "http.response.start"), None)
    body = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
    return status, body, app_state["called"]


def test_guard_answers_401_without_reading_the_body_or_calling_the_app():
    status, _, called = _run_guard({}, [b"x" * 10])
    assert (status, called) == (401, False)


def test_guard_answers_413_from_declared_content_length():
    status, _, called = _run_guard({"authorization": "Bearer t", "content-length": str(10_000_000)}, [b"x"])
    assert (status, called) == (413, False)


def test_guard_counts_streamed_bytes_when_no_length_is_declared():
    chunk = b"x" * 40_000
    status, body, _ = _run_guard({"authorization": "Bearer t"}, [chunk, chunk, chunk])   # 120 KB > 1000 B + 64 KiB
    assert status == 413
    assert b"app-response" not in body, "the app's own reply must be suppressed once the limit is exceeded"


def test_guard_passes_small_authenticated_bodies_through():
    status, body, called = _run_guard({"authorization": "Bearer t", "content-length": "20"}, [b"x" * 20])
    assert (status, body, called) == (200, b"app-response", True)


def test_guard_ignores_other_paths_methods_and_websockets():
    for kwargs in ({"path": "/api/v1/sessions/start"}, {"method": "GET"}):
        status, _, called = _run_guard({}, [b"x"], **kwargs)
        assert (status, called) == (200, True), kwargs
    # WebSocket scopes (the Next.js workout path) are never inspected.
    ws_called = {"v": False}

    async def app(scope, receive, send):
        ws_called["v"] = True

    scope = {"type": "websocket", "method": "GET", "path": "/upload_video", "headers": []}
    asyncio.run(UploadGuardMiddleware(app, "/upload_video", lambda: 1)(scope, None, None))
    assert ws_called["v"] is True
