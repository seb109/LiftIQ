import logging
import cv2
import numpy as np
import uuid
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
import gym_trainer as gt
import ai_trainer as ai
import tempfile
import os

from app.api.v1.router import api_v1_router
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

VERSION = "0.1.0"

app = FastAPI()
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


@app.get("/stats")
async def get_stats(session_id: str = None):
    sess = gt.get_session_state(session_id)
    st = sess.state
    s = sess.session
    rest_remaining = 0
    if s["is_resting"] and s["rest_start_time"]:
        import time
        rest_remaining = max(0, int(s["rest_duration"] - (time.time() - s["rest_start_time"])))

    return JSONResponse({
        # rep state
        "counter": st["counter"],
        "stage": st["stage"],
        "feedback": st["feedback"],
        "ai_feedback": st["ai_feedback"],
        "exercise": st["current_exercise"],
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
async def trigger_set_feedback(session_id: str = None):
    """Called after a set completes to get Groq feedback"""
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


@app.websocket("/ws/webcam")
async def ws_webcam(websocket: WebSocket, session_id: str = None):
    """Receives JPEG frames captured client-side from the browser's own
    camera, runs them through the gym_trainer engine for session_id, and
    streams the processed JPEG frames back."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            frame_arr = np.frombuffer(data, dtype=np.uint8)
            frame = cv2.imdecode(frame_arr, cv2.IMREAD_COLOR)
            if frame is None:
                logger.warning("ws_webcam: received undecodable frame, skipping")
                continue
            processed_frame, _ = gt.process_frame(frame, session_id=session_id)
            ok, buffer = cv2.imencode('.jpg', processed_frame)
            if not ok:
                logger.warning("ws_webcam: failed to encode processed frame, skipping")
                continue
            await websocket.send_bytes(buffer.tobytes())
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