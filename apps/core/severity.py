from __future__ import annotations

from dataclasses import dataclass


class Severity:
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"
    SUCCESS = "success"
    NEUTRAL = "neutral"


SEVERITY_PRIORITY = {
    Severity.CRITICAL: 0,
    Severity.WARNING: 1,
    Severity.INFO: 2,
    Severity.SUCCESS: 3,
    Severity.NEUTRAL: 4,
}

SEVERITY_LABELS = {
    Severity.CRITICAL: "Crítico",
    Severity.WARNING: "Atenção",
    Severity.INFO: "Informativo",
    Severity.SUCCESS: "Ok",
    Severity.NEUTRAL: "Neutro",
}


@dataclass(frozen=True)
class Alert:
    title: str
    message: str
    severity: str
    source: str
    date: object | None = None
    url: str = ""

    @property
    def priority(self) -> int:
        return SEVERITY_PRIORITY.get(self.severity, 99)

    @property
    def label(self) -> str:
        return SEVERITY_LABELS.get(self.severity, "Info")
