from __future__ import annotations

import logging
import uuid

logger = logging.getLogger(__name__)


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get("HTTP_X_REQUEST_ID") or uuid.uuid4().hex
        request.request_id = request_id

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

        response["X-Request-ID"] = request_id
        return response
