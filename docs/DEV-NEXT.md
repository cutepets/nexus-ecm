# Development handoff

Updated 2026-11-25. This is the short list for ongoing work; source and migrations remain authoritative.

## Done / still needs evidence

- Phase 0–1 settings migration and configuration are present. Keep a successful acceptance run as release evidence; the previous long phase sheet has been retired.
- Pilot decisions recorded: web `chamcong.petshophanoi.com`, API under `/api/v1`; Chrome Android, Safari iOS, Chrome desktop; overnight shifts are out of scope.

## Before the pilot

- Admin/operations must supply pilot branch, employee IDs/count, dates and shifts, device/OS/browser versions and testers.
- POS/KPI owner must supply provider, technical owner, sandbox/production environment, employee ID mapping, public HTTPS webhook URL and secret handoff.
- Run attendance check-in/out, camera/GPS permission and approval flows on every target device. Verify OT approval, missing-punch correction and timesheet recalculation.
- Verify POS KPI idempotency (`Idempotency-Key`) and webhook HMAC, retry, and dead-letter evidence.
- Capture pilot results; do not call the pilot complete until each item has evidence.

## Avoid these failures

- Use only synthetic demo data. `SEED_DEMO_DATA=true pnpm db:seed` creates idempotent `HN-DEMO`, `HCM-DEMO`, and `DEMO-001`; it contains no real biometrics, GPS, credentials, or usable API keys.
- Time and payroll calculations must use the configured company timezone (default `Asia/Ho_Chi_Minh`), including timestamps around UTC midnight.
- Back up PostgreSQL before production migrations. Never edit an applied migration; rollback only after confirming no running app uses the new columns/types.
- Local development needs `.env`, Node 20+, pnpm 9+, and the compose services; see `docs/system-map.md`.
