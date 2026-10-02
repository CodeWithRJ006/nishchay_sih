# Rules to Verify

To guarantee the integrity of the system, the following business logic rules must always hold true, and are actively tested via the `vitest` suite.

1. **State Machine Integrity:** Applications can only move forward in the defined lifecycle (`SUBMITTED` -> `PAID` -> `INSPECTED_PASS` -> `CERTIFIED`). Backwards movement or skipping states (e.g. `SUBMITTED` to `CERTIFIED`) must physically throw database/logic exceptions.
2. **Double Inspection Guard:** Once an inspection resolves to `PASS` or `FAIL`, it cannot be modified or re-submitted by the officer.
3. **Double Payment Guard:** `paymentsService` idempotent keys enforce that duplicate success webhooks do not result in double-receipts or state corruption.
4. **Strict Fee Gate:** A certificate absolutely cannot be issued unless there is a cryptographic guarantee of exactly one `PAID` payment with an amount strictly matching the `fee_amount` snapshotted on the application.
5. **Audit Immutability:** Any `UPDATE` or `DELETE` executed against the `audit_log` table will trigger a hard SQLite abort. The log is strictly append-only.
6. **Route Enforcement:** Every API route (except `/public` and `/auth`) must have an explicitly defined required role in `routeTable.ts`. If not, the application fails to boot.
