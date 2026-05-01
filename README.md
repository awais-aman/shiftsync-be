# ShiftSync — Backend

NestJS API for the ShiftSync multi-location staff-scheduling platform. The frontend lives in [`shiftsync-fe`](https://github.com/awais-aman/shiftsync-fe).

## Local development

```bash
npm install
cp .env.example .env   # then fill in Supabase + DB values
npx prisma migrate deploy
npm run seed           # creates demo locations, staff, shifts, etc.
npm run start:dev
```

API listens on `http://localhost:4000/api`. Swagger docs at `http://localhost:4000/api/docs`.

## Seed credentials

`npm run seed` creates the data set below (idempotent — safe to re-run). Same password for everyone:

```
password: CoastalEats!2026
```

| Role    | Email                              | Notes |
|---------|------------------------------------|-------|
| admin   | admin@coastaleats.test             | Sees everything; can edit audit |
| manager | east-manager@coastaleats.test      | Brooklyn + Boston |
| manager | west-manager@coastaleats.test      | Santa Monica + Berkeley |
| staff   | sarah@coastaleats.test             | West coast (PT), bartender + server, has 7th-day override |
| staff   | john@coastaleats.test              | Cross-tz (Brooklyn + Santa Monica), bartender — drives the Timezone Tangle scenario |
| staff   | maria@coastaleats.test             | East coast, server + host |
| staff   | alex@coastaleats.test              | Berkeley only, line cook |
| staff   | priya@coastaleats.test             | East coast, server + host |
| staff   | tom@coastaleats.test               | Santa Monica only, line cook + server, has a vacation exception |

The seed also creates ~10 shifts across the next 14 days (mix of draft + published, premium Fri/Sat 17:00+), ~9 assignments, one in-flight drop request (Tom), one in-flight swap request (John → Sarah), and one overtime override (Sarah, next Saturday).

## API contract

OpenAPI is exposed at `GET /api/docs-json` (used by the FE's `npm run gen:types`). All endpoints require a Supabase JWT bearer token; role-restricted endpoints use admin/manager guards.

## Decisions on intentional spec ambiguities

These are the decisions baked into the implementation:

1. **De-certified staff & history** — past assignments are preserved untouched. Future unpublished assignments at the de-certified location are not auto-cleaned, but the constraint engine will reject any new assignment.
2. **Desired hours vs availability** — availability is a hard constraint enforced by the engine; `desired_hours_per_week` is advisory and surfaces in fairness analytics (variance vs actual) and the suggestions ranker (lowest-hours staff first).
3. **Consecutive-days counting** — any shift `>= 1h` counts as a worked day. Overnight shifts (crossing midnight) count for the start day only when computing consecutive-days streaks.
4. **Edit after swap approval** — once approved, the swap is final; subsequent shift edits notify assignees but don't revert. An edit while a swap is in-flight auto-cancels the swap (`ShiftsService.update` → `cancelActiveForShift`).
5. **Location spanning timezone boundary** — out of scope; one IANA tz per location.

## Time, DST & overnight handling

- All persisted times are `timestamptz`. Display always uses the **shift's location timezone** via `date-fns-tz`.
- Recurring availability windows store a `timezone` per row; the engine interprets each window in that tz. DST transitions are handled because we convert the shift's UTC instant to local wall-clock using `toZonedTime` before comparing minute-of-day. Same wall-clock minutes match before and after a DST jump.
- **Overnight shifts** (e.g. 23:00–03:00) are split at midnight by the engine and each half is checked against the availability for its own weekday. Recurring availability windows themselves cannot cross midnight (CHECK `end_time > start_time`); to cover an overnight shift a staff member needs two windows (e.g. 22:00–24:00 on the start day and 00:00–03:00 on the end day).

## Known limitations / deferred

- Realtime is implemented for `notifications` only; other tables refresh via the notification side-channel (TanStack invalidations) rather than direct subscriptions.
- Email "delivery" is a Pino log line + `email_simulated=true` flag on the notification row. Per-user channel preference is honoured (`in_app` vs `in_app_email`).
- Seed wipes `shifts`, `shift_assignments`, `swap_requests`, `overtime_overrides`, `notifications`, and `audit_log` on every run — locations/skills/users are upserted.
- Concurrent assignment conflicts surface to the loser of the race via 409 (DB EXCLUDE GIST). The winner's update is propagated to the loser through the notification side-channel rather than a direct conflict toast.
