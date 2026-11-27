# Development handoff

Updated 2026-11-27. Source code and migrations remain authoritative.

## Pilot decisions

- Web: `chamcong.petshophanoi.com`; API: `/api/v1`.
- Target clients: Chrome on Android and desktop, Safari on iOS. Overnight shifts are out of scope.

## Still needed

- Operations: pilot branch, employee IDs/count, dates, shifts, device/browser versions, and testers.
- POS/KPI owner: provider, technical contact, environment, employee-ID mapping, HTTPS webhook URL, and secret handoff.
- Capture acceptance evidence for attendance check-in/out, camera/GPS permissions, approvals, overtime, missing-punch correction, timesheet recalculation, and POS/KPI idempotency, HMAC, retries, and dead-letter handling.

Do not call the pilot complete until each item has recorded evidence. Use only synthetic demo data. Calculate time and payroll in the configured company timezone (`Asia/Ho_Chi_Minh` by default).
