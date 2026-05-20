# Disaster Recovery & Backup Drills Log

This document serves as the historical record for all quarterly restore drills, as required by the [Backup & Disaster Recovery Runbook](BACKUP.md).

---

## Drill Template

Use this template to record the outcomes of each quarterly drill:

```markdown
### Drill Date: YYYY-MM-DD
- **Assessor**: [Name/Role]
- **Target Instance/Environment**: Staging DB (Postgres)
- **Backup Source Artifact**: `postgres/latest.dump` (S3)
- **Backup Timestamp**: YYYY-MM-DD HH:MM:SS
- **Recovery Point Objective (RPO) Observed**: [e.g., 42 minutes] (Target: ≤ 1 hour)
- **Recovery Time Objective (RTO) Observed**: [e.g., 18 minutes] (Target: ≤ 4 hours)
- **Smoke Tests Status**: [Passed / Failed] (Command: `DATABASE_URL=...staging... pytest -m smoke`)
- **Issues Observed**:
  - [List any issues or none]
- **Mitigation/Follow-ups**:
  - [List any actions required or none]
```

---

## Log History

*No drills have been logged yet. The first quarterly drill is scheduled for the first Monday of next quarter.*
