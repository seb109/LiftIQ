"""Request guard for the legacy /upload_video endpoint.

FastAPI parses (and spools to disk) a multipart body *before* the route handler or its
dependencies run, so limits enforced inside the handler cannot stop a large or anonymous
upload from consuming disk first. This pure-ASGI middleware sits in front of the framework
and, for the guarded path only:

  * answers 401 when there is no Authorization header (real token validation still happens
    in the route's dependencies; this only avoids reading a body nobody is entitled to send);
  * answers 413 when the body is larger than the limit, judged by Content-Length up front
    and by counting bytes while streaming when the client did not declare a length.

Every other request, including all WebSocket connections, passes through untouched.
"""
import json
from typing import Awaitable, Callable, Optional

# Multipart framing (boundaries, part headers) adds a little to the file size; the limit is
# for the file itself, so allow a small envelope. The handler enforces the exact file cap.
ENVELOPE_BYTES = 64 * 1024


class UploadGuardMiddleware:
    def __init__(self, app, path: str, max_bytes: Callable[[], int]):
        self.app = app
        self.path = path
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] != self.path:
            await self.app(scope, receive, send)
            return

        headers = {k.lower(): v for k, v in scope["headers"]}
        if b"authorization" not in headers:
            await self._respond(send, 401, "Not authenticated", {b"www-authenticate": b"Bearer"})
            return

        ceiling = self.max_bytes() + ENVELOPE_BYTES
        declared: Optional[bytes] = headers.get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > ceiling:
            await self._respond(send, 413, "Upload is too large.")
            return

        received = 0
        too_large = False

        async def counting_receive():
            nonlocal received, too_large
            if too_large:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > ceiling:
                    too_large = True
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message):
            if too_large:
                return  # the app is reacting to the truncated body; we answer 413 ourselves
            await send(message)

        try:
            await self.app(scope, counting_receive, guarded_send)
        except Exception:
            if not too_large:
                raise
        if too_large:
            await self._respond(send, 413, "Upload is too large.")

    @staticmethod
    async def _respond(send: Callable[[dict], Awaitable[None]], status: int, detail: str, extra: Optional[dict] = None):
        body = json.dumps({"detail": detail}).encode()
        headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
        headers += list((extra or {}).items())
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})
