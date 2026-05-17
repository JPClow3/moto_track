from __future__ import annotations

import contextvars
import logging
import uuid

logger = logging.getLogger(__name__)

# I-H3: bind the active request id to a contextvar so all log records — not
# just ones with explicit `extra` — can pick it up. Default is "-" so logs
# from background tasks / shell don't crash the formatter.
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class RequestIDFilter(logging.Filter):
    """Inject the current request_id (from the contextvar) onto every record."""

    def filter(self, record: logging.LogRecord) -> bool:  # pragma: no cover
        if not hasattr(record, "request_id"):
            record.request_id = request_id_var.get()
        return True


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get("HTTP_X_REQUEST_ID") or uuid.uuid4().hex
        request.request_id = request_id
        token = request_id_var.set(request_id)

        try:
            response = self.get_response(request)
        except Exception:
            logger.exception(
                "Unhandled exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.get_full_path(),
                    "user_id": getattr(getattr(request, "user", None), "id", None),
                },
            )
            raise
        finally:
            request_id_var.reset(token)

        response["X-Request-ID"] = request_id
        return response
