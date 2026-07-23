# API v1 Migration Notes

The SvelteKit API keeps the same resource intent as the former Django REST endpoints:

- `/api/v1/fuel-records` — read only (writes stay on the fuel UI / offline queue)
- `/api/v1/maintenance-records`
- `/api/v1/tire-records`
- `/api/v1/reminders`
- `/api/v1/documents`
- `/api/v1/expenses`

## Auth

Endpoints accept either:

1. An authenticated Supabase browser session cookie, or
2. A personal API token (`Authorization: Bearer mt_live_…`) created via `POST /api/v1/tokens`.

Token lookups use the service-role client; data queries remain scoped by `owner_id`.

## Reads

`GET` returns:

```json
{
  "results": []
}
```

## Writes

Supported feature-backed resources accept:

- `POST` — create (`{ result }`, HTTP 201)
- `PATCH` — update (JSON body must include `id`)
- `DELETE` — delete (`?id=`)

Free-plan entitlement checks apply to reminder creates (and other gated resources as wired).

## Tokens

- `GET /api/v1/tokens` — list metadata (never returns the raw secret again)
- `POST /api/v1/tokens` — `{ "name": "optional" }` → `{ result, token }` (show `token` once)
- `DELETE /api/v1/tokens?id=` — revoke

## Field changes vs legacy

- Django integer primary keys are replaced by UUIDs.
- Money fields are integer minor units, for example `total_price_cents`.
- File fields are R2 object keys, for example `file_key`, `image_key`, or `receipt_file_key`.
