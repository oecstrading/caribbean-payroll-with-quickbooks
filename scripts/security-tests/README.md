# Pre-deployment security regression tests

## Permanent employee removal checks

After minting the requesting administrator session, apply `employee-removal-setup.sql` with the approved data tool, then run `bunx vitest run --config vitest.security.config.ts tests/security/employee-removal.live.test.ts`. Always apply `employee-removal-cleanup.sql` afterwards. These disposable account-free fixtures assert explicit confirmation, service-only authorization, self-deletion denial, directory removal, retained payslip totals/repayments, paused loans and permanent restoration denial. Never run against real employee identifiers or use privileged credentials for test assertions.

## Company onboarding checks

After minting the requesting platform administrator's session, run:

`RUN_COMPANY_ONBOARDING_SECURITY=1 bunx vitest run --config vitest.security.config.ts tests/security/company-onboarding.live.test.ts`

These five checks perform denied operations only: direct company creation, privileged assignment/edit RPC calls, reassignment of an existing member, and anonymous listing/invitation generation. They need no fixtures and intentionally remain opt-in. Successful customer activation additionally requires a real invited customer's verified account; reserved example-domain accounts cannot receive verification email.

`bun run test:security` runs local loan/period/workspace regression checks without contacting Cloud.

`bun run test:security:live` exercises actual RLS and approval functions, not mocks. It intentionally fails if the signed-in administrator session or prepared fixtures are missing. Never use a service-role token for these assertions.

## Live run (Lovable agent)

1. Mint the requesting user's session with `lovable auth-session --json --self`. Credentials remain in the protected session file, never this repository.
2. Apply `setup.sql` byte-for-byte through the approved data-change tool. The fixed fixture IDs deliberately fail on duplicate setup; clean up an earlier run before retrying. Fixtures target the initial Smiley's company. Do not change real account membership.
3. Run `bun run test:security:live`.
4. Always apply `cleanup.sql` through the data-change tool, even after failed assertions. Check fixture counts are zero. Real employees and payroll runs are not modified.

The suite creates one account-free employee, a second company and creditor, and a single future-dated test payroll. Tests assert company read/write isolation, cross-company relationships, stale salaries, duplicate rows, withheld/capped loan deductions, transaction rollback, successful approval, and repeat/overlap denial. No emails, AI calls, bank payments or QuickBooks posts occur. Audit history for the requesting company retains test actions by design.

Live suite execution is separate from normal tests to prevent accidental writes during routine CI. Cloud fixture setup/cleanup requires the approved data tool because the ordinary administrator's RLS intentionally forbids deleting approved payroll.