import asyncio
import logging
import re
import time
import cv2
import numpy as np
import uuid
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect, status
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from sqlalchemy.orm import Session
import gym_trainer as gt
import ai_trainer as ai
import tempfile
import os

from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_v1_router
from app.api.deps import get_current_user
from app.core import ws_perf
from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.models.workout_session import WorkoutSession

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class _RedactTokenFilter(logging.Filter):
    """Masks `token=<jwt>` in uvicorn's request/WebSocket log lines.

    Browsers cannot set headers on a WebSocket handshake, so the access token travels
    in the /ws/webcam query string, and uvicorn logs the full path + query for every
    connection — which would put live JWTs into the hosting provider's log stream.
    """
    _TOKEN_RE = re.compile(r"([?&]token=)[^&\s\"']+")

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self._TOKEN_RE.sub(r"\1[redacted]", record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(
                self._TOKEN_RE.sub(r"\1[redacted]", a) if isinstance(a, str) else a
                for a in record.args
            )
        return True


for _uvicorn_logger in ("uvicorn.error", "uvicorn.access"):
    logging.getLogger(_uvicorn_logger).addFilter(_RedactTokenFilter())

VERSION = "0.1.0"

app = FastAPI()

# LiftIQ frontend always runs on port 3001.
# settings.FRONTEND_URL carries the production URL (e.g. https://liftiq.vercel.app).
_cors_origins = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
# FRONTEND_URL may hold several comma-separated origins. Browsers send the Origin
# header without a trailing slash, so normalise before comparing.
for _origin in settings.FRONTEND_URL.split(","):
    _origin = _origin.strip().rstrip("/")
    if _origin and _origin not in _cors_origins:
        _cors_origins.append(_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)


@app.on_event("startup")
def on_startup():
    try:
        from app.db.session import engine
        from app.models import Base
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Database table creation on startup skipped or failed: {e}")

templates = Jinja2Templates(directory="templates")


uploaded_video_paths: dict[str, str] = {}

# ----------- PAGES ----------- #

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


# ----------- HEALTH / VERSION ----------- #

@app.get("/health")
async def health():
    checks = {"mediapipe_pose_loaded": gt.pose is not None}
    ok = all(checks.values())
    return JSONResponse(
        {"status": "ok" if ok else "error", "checks": checks},
        status_code=200 if ok else 503,
    )


@app.get("/version")
async def version():
    return JSONResponse({"version": VERSION})


# ----------- SESSION ----------- #

@app.post("/start_session")
async def start_session(data: dict):
    exercise = data.get("exercise", "squat")
    target_reps = int(data.get("target_reps", 10))
    target_sets = int(data.get("target_sets", 3))
    session_id = data.get("session_id") or uuid.uuid4().hex
    gt.start_session(exercise, target_reps, target_sets, session_id=session_id)
    return JSONResponse({"status": "ok", "session_id": session_id})


@app.post("/end_session")
async def end_session(data: dict):
    session_id = data.get("session_id")
    if session_id:
        gt.end_session(session_id)
        if session_id in uploaded_video_paths:
            vpath = uploaded_video_paths.pop(session_id, None)
            if vpath and os.path.exists(vpath):
                try:
                    os.remove(vpath)
                except Exception:
                    pass
    return JSONResponse({"status": "ok"})


def _require_owned_session(session_id: Optional[str], current_user: User, db: Session) -> None:
    """Raises 404 unless session_id names a WorkoutSession row owned by current_user.

    Mirrors the "not found" response used by app/api/v1/endpoints/sessions.py for
    unowned sessions, so this never distinguishes "doesn't exist" from "not yours".
    """
    if not session_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout session not found.")
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout session not found.")
    session_entity = db.query(WorkoutSession).filter(WorkoutSession.id == session_uuid).first()
    if not session_entity or session_entity.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout session not found.")


@app.get("/stats")
def get_stats(
    session_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_owned_session(session_id, current_user, db)
    sess = gt.get_session_state(session_id)
    st = sess.state
    s = sess.session
    rest_remaining = 0
    if s["is_resting"] and s["rest_start_time"]:
        import time
        rest_remaining = max(0, int(s["rest_duration"] - (time.time() - s["rest_start_time"])))

    # Build live form violations list: [{check, value, message}]
    raw_violations = st.get("form_violations", [])
    form_violation_messages = [v.get("message", "") for v in raw_violations if v.get("message")]
    # Current rep form score (0–100), None before first rep
    form_score = None
    completed = s.get("completed_sets", [])
    if completed and completed[-1].get("form_scores"):
        form_score = completed[-1]["form_scores"][-1]

    return JSONResponse({
        # rep state
        "counter": st["counter"],
        "stage": st["stage"],
        "feedback": st["feedback"],
        "ai_feedback": st["ai_feedback"],
        "exercise": st["current_exercise"],
        # live form data (new in 6C)
        "form_violations": form_violation_messages,
        "form_score": form_score,
        # session state
        "session_active": s["active"],
        "session_complete": s["session_complete"],
        "current_set": s["current_set"],
        "target_sets": s["target_sets"],
        "target_reps": s["target_reps"],
        "completed_sets": s["completed_sets"],
        "is_resting": s["is_resting"],
        "rest_remaining": rest_remaining,
        "set_feedback": s["set_feedback"],
        "session_summary": s["session_summary"],
        "session_id": sess.session_id,
    })


@app.get("/get_set_feedback")
async def trigger_set_feedback(
    session_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Called after a set completes to get Groq feedback"""
    _require_owned_session(session_id, current_user, db)
    sess = gt.get_session_state(session_id)
    s = sess.session
    if s["completed_sets"]:
        last_set = s["completed_sets"][-1]
        feedback_session = {
            "exercise": s["exercise"],
            "current_set": last_set["set_number"],
            "target_sets": s["target_sets"],
            "target_reps": s["target_reps"],
            "current_set_depths": last_set["depths"],
            "current_set_rep_times": last_set["rep_times"],
            "target_depth": s["target_depth"]
        }
        try:
            feedback = await ai.get_set_feedback(feedback_session)
        except Exception:
            logger.exception("Groq set-feedback call failed; continuing without AI feedback")
            feedback = "Feedback unavailable right now — your set was recorded, keep going."
        s["set_feedback"] = feedback

        all_sets_done = (
            len(s["completed_sets"]) >= s["target_sets"]
        )
        if all_sets_done and not s["session_complete"]:
            s["session_complete"] = True
            s["is_resting"] = False
            try:
                summary = await ai.get_session_summary(s)
            except Exception:
                logger.exception("Groq session-summary call failed; continuing without AI summary")
                summary = "Session summary unavailable right now — your workout was recorded."
            s["session_summary"] = summary

        return JSONResponse({"feedback": feedback})
    return JSONResponse({"feedback": ""})


# ----------- STREAMS ----------- #

def webcam_stream(session_id: str = None):
    import cv2
    # CAP_DSHOW is required on Windows to avoid silent camera open failures
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        logger.error("Failed to open webcam (device index 0)")
        return
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                logger.info("Webcam stream ended (no more frames)")
                break
            frame, _ = gt.process_frame(frame, session_id=session_id)
            _, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    finally:
        cap.release()


@app.get("/webcam_feed")
async def webcam_feed(session_id: str = None):
    return StreamingResponse(
        webcam_stream(session_id=session_id),
        media_type="multipart/x-mixed-replace;boundary=frame"
    )


def _ws_authorize_session(session_id: Optional[str], token: Optional[str], db: Session) -> bool:
    """Validates the access token and confirms it owns session_id's WorkoutSession row.

    Browsers cannot set Authorization headers on a WebSocket handshake, so the access
    token travels as a query param instead (same token already held client-side for
    Bearer auth on every other request) — no new auth mechanism, no frontend rewrite.
    """
    if not token or not session_id:
        return False
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload.get("sub"))
        session_uuid = uuid.UUID(session_id)
    except Exception:
        return False

    session_entity = db.query(WorkoutSession).filter(WorkoutSession.id == session_uuid).first()
    return bool(session_entity and session_entity.user_id == user_id)


# JPEG quality of the annotated frame streamed back to the browser. cv2.imencode's
# default (95) yields ~2x the bytes of 75 for no visible gain on a video overlay,
# and the download leg is the largest payload in the pipeline.
WS_RESPONSE_JPEG_QUALITY = 75

# Sent instead of an image when a frame is skipped (undecodable / encode failure).
# The client protocol is strictly one response per frame; an empty message keeps that
# invariant so the browser's send loop never waits for a reply that will not come.
_WS_SKIPPED_FRAME = b""


def _process_ws_frame(session_id: str, data: bytes):
    """Decode -> gym_trainer.process_frame -> JPEG-encode one frame.

    Synchronous and CPU-bound (MediaPipe + OpenCV), so ws_webcam runs it on a worker
    thread; running it inline in the async handler would freeze the event loop for
    the whole frame (delaying /stats polls and every other socket).

    Returns (payload_or_None, decode_ms, cv_ms, encode_ms, "WxH").
    """
    t0 = time.perf_counter()
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return None, 0.0, 0.0, 0.0, "?"
    dims = f"{frame.shape[1]}x{frame.shape[0]}"
    t1 = time.perf_counter()
    sess = gt.get_session_state(session_id)
    with sess.lock:  # Pose is not thread-safe; also blocks delete_session() mid-frame
        processed_frame, _ = gt.process_frame(frame, session_id=session_id)
    t2 = time.perf_counter()
    ok, buffer = cv2.imencode(".jpg", processed_frame, [cv2.IMWRITE_JPEG_QUALITY, WS_RESPONSE_JPEG_QUALITY])
    t3 = time.perf_counter()
    payload = buffer.tobytes() if ok else None
    return payload, (t1 - t0) * 1000.0, (t2 - t1) * 1000.0, (t3 - t2) * 1000.0, dims


@app.websocket("/ws/webcam")
async def ws_webcam(
    websocket: WebSocket,
    session_id: str = None,
    token: str = None,
    db: Session = Depends(get_db),
):
    """Receives JPEG frames captured client-side from the browser's own
    camera, runs them through the gym_trainer engine for session_id, and
    streams the processed JPEG frames back. Exactly one response per frame,
    in order."""
    authorized = _ws_authorize_session(session_id, token, db)
    # The auth query leaves the SQLAlchemy session holding a pooled DB connection
    # (open transaction). Release it now: this handler lives for the whole workout
    # and would otherwise pin one Postgres connection per active workout.
    db.close()
    if not authorized:
        logger.warning("ws_webcam: rejected unauthorized connection (session_id=%s)", session_id)
        await websocket.close(code=4401)
        return
    await websocket.accept()

    perf = None
    if settings.PERF_LOG:
        ws_perf.ensure_lag_probe()
        perf = ws_perf.WsPerf(session_id)

    try:
        while True:
            data = await websocket.receive_bytes()
            if perf:
                perf.frame_received()
            payload, decode_ms, cv_ms, encode_ms, dims = await asyncio.to_thread(
                _process_ws_frame, session_id, data
            )
            if payload is None:
                logger.warning("ws_webcam: skipping undecodable/unencodable frame")
                await websocket.send_bytes(_WS_SKIPPED_FRAME)
                continue
            await websocket.send_bytes(payload)
            if perf:
                perf.frame_done(decode_ms, cv_ms, encode_ms, len(data), len(payload), dims)
    except WebSocketDisconnect:
        logger.info("ws_webcam: client disconnected (session_id=%s)", session_id)


def video_stream(video_path: str, session_id: str = None):
    import cv2
    import time
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("Failed to open uploaded video: %s", video_path)
        cap.release()
        if os.path.exists(video_path):
            os.remove(video_path)
        return
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = 1.0 / fps          # target seconds per frame
    try:
        while True:
            t0 = time.monotonic()
            ret, frame = cap.read()
            if not ret:
                logger.info("Uploaded video stream ended (no more frames)")
                break
            frame, _ = gt.process_frame(frame, session_id=session_id)
            _, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            elapsed = time.monotonic() - t0
            sleep_for = frame_interval - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)
    finally:
        cap.release()
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
            except Exception:
                pass
        if session_id and session_id in uploaded_video_paths:
            uploaded_video_paths.pop(session_id, None)


@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...), session_id: str = None):
    sid = session_id or gt.DEFAULT_SESSION_ID
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        uploaded_video_paths[sid] = tmp.name
    gt.reset_state(session_id=sid)
    return JSONResponse({"status": "ok", "session_id": sid})


@app.get("/uploaded_feed")
async def uploaded_feed(session_id: str = None):
    sid = session_id or gt.DEFAULT_SESSION_ID
    vpath = uploaded_video_paths.get(sid)
    if not vpath:
        return JSONResponse({"error": "No video uploaded for this session"})
    return StreamingResponse(
        video_stream(vpath, session_id=sid),
        media_type="multipart/x-mixed-replace;boundary=frame"
    )