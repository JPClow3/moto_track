from __future__ import annotations


def get_density(request) -> str:
    density = (request.GET.get("density") or "").strip().lower()
    if density in {"compact", "comfortable"}:
        request.session["density"] = density
        return density
    return request.session.get("density", "comfortable")


def per_page_for_density(density: str, *, comfortable: int = 50, compact: int = 100) -> int:
    return compact if density == "compact" else comfortable
