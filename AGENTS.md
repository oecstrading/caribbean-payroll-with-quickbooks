# Application rules
- Treat src/lib/sample-data.ts records as fictional demonstrations, never as authentication users; this prevents invalid payslip links and accidental live payroll.
- Serve the versioned user manual from public/training and author it with scripts/generate-user-manual.py so public downloads do not depend on database availability.
- User creation and deletion authorization must be enforced server-side independently of operational access; hidden navigation is not a security boundary.