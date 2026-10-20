# Application rules
- Simulation clocks and punches use dedicated tables and authenticated RPCs; never override device time or feed simulated records into live attendance, payroll, billing or compliance. Resets start a new retained run rather than deleting history.
- Treat src/lib/sample-data.ts records as fictional demonstrations, never as authentication users; this prevents invalid payslip links and accidental live payroll.
- Serve the versioned user manual from public/training and author it with scripts/generate-user-manual.py so public downloads do not depend on database availability.
- User creation and deletion authorization must be enforced server-side independently of operational access; hidden navigation is not a security boundary.
- Employee folders use live profiles with validated HR details, manager-edit/admin-create-and-delete controls, and reversible soft deletion; this preserves payroll history without deleting authentication accounts.
- Employee sample edits remain session-only and explicitly separate from live profiles so fictional identities never enter payroll or account APIs.