# API v1 Migration Notes

The SvelteKit API keeps the same resource intent as the Django REST endpoints:

- `/api/v1/fuel-records`
- `/api/v1/maintenance-records`
- `/api/v1/tire-records`
- `/api/v1/reminders`
- `/api/v1/documents`
- `/api/v1/expenses`

All endpoints require an authenticated Supabase session and return:

```json
{
  "results": []
}
```

Known field changes:

- Django integer primary keys are replaced by UUIDs.
- Money fields are represented as integer minor units, for example `total_price_cents`.
- File fields are represented as R2 object keys, for example `file_key`, `image_key`, or `receipt_file_key`.
