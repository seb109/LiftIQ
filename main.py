import cv2
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
import gym_trainer as gt
import ai_trainer as ai
import tempfile
import os

app = FastAPI()
templates = Jinja2Templates(directory="templates")

uploaded_video_path = None

# ----------- PAGES ----------- #

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


# ----------- SESSION ----------- #

@app.post("/start_session")
async def start_session(data: dict):
    exercise = data.get("exercise", "squat")
    target_reps = int(data.get("target_reps", 10))
    target_sets = int(data.get("target_sets", 3))
    gt.start_session(exercise, target_reps, target_sets)
    return JSONResponse({"status": "ok"})


@app.get("/stats")
async def get_stats():
    s = gt.session
    rest_remaining = 0
    if s["is_resting"] and s["rest_start_time"]:
        import time
        rest_remaining = max(0, int(s["rest_duration"] - (time.time() - s["rest_start_time"])))

    return JSONResponse({
        # rep state
        "counter": gt.state["counter"],
        "stage": gt.state["stage"],
        "feedback": gt.state["feedback"],
        "ai_feedback": gt.state["ai_feedback"],
        "exercise": gt.state["current_exercise"],
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
    })


@app.get("/get_set_feedback")
async def trigger_set_feedback():
    """Called after a set completes to get Groq feedback"""
    if gt.session["completed_sets"]:
        last_set = gt.session["completed_sets"][-1]
        feedback_session = {
            "exercise": gt.session["exercise"],
            "current_set": last_set["set_number"],
            "target_sets": gt.session["target_sets"],
            "target_reps": gt.session["target_reps"],
            "current_set_depths": last_set["depths"],
            "current_set_rep_times": last_set["rep_times"],
            "target_depth": gt.session["target_depth"]
        }
        feedback = await ai.get_set_feedback(feedback_session)
        gt.session["set_feedback"] = feedback

        # Use the number of completed sets as the source of truth — not
        # last_set["set_number"], which depends on current_set being
        # incremented correctly and is wrong if this endpoint fires more
        # than once or a set completes outside the rest-timer flow.
        all_sets_done = (
            len(gt.session["completed_sets"]) >= gt.session["target_sets"]
        )
        if all_sets_done and not gt.session["session_complete"]:
            gt.session["session_complete"] = True
            gt.session["is_resting"] = False
            summary = await ai.get_session_summary(gt.session)
            gt.session["session_summary"] = summary

        return JSONResponse({"feedback": feedback})
    return JSONResponse({"feedback": ""})


# ----------- STREAMS ----------- #

def webcam_stream():
    import cv2
    # CAP_DSHOW is required on Windows to avoid silent camera open failures
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame, _ = gt.process_frame(frame)
            _, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    finally:
        cap.release()


@app.get("/webcam_feed")
async def webcam_feed():
    return StreamingResponse(
        webcam_stream(),
        media_type="multipart/x-mixed-replace;boundary=frame"
    )


def video_stream(video_path):
    import cv2
    import time
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = 1.0 / fps          # target seconds per frame
    try:
        while True:
            t0 = time.monotonic()
            ret, frame = cap.read()
            if not ret:
                break
            frame, _ = gt.process_frame(frame)
            _, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            # Sleep for whatever time is left in this frame's budget so the
            # stream plays back at the video's native frame rate instead of
            # at whatever speed MediaPipe happens to process frames.
            elapsed = time.monotonic() - t0
            sleep_for = frame_interval - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)
    finally:
        cap.release()
        if os.path.exists(video_path):
            os.remove(video_path)


@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    global uploaded_video_path
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        uploaded_video_path = tmp.name
    gt.reset_state()
    return JSONResponse({"status": "ok"})


@app.get("/uploaded_feed")
async def uploaded_feed():
    if not uploaded_video_path:
        return JSONResponse({"error": "No video uploaded"})
    return StreamingResponse(
        video_stream(uploaded_video_path),
        media_type="multipart/x-mixed-replace;boundary=frame"
    )