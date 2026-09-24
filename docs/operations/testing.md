# Testing

119 tests across 21 files, run with vitest.

```bash
bun run test              # all suites
bun run test:watch        # watch mode
bun run test:coverage     # with v8 coverage
bun run test tests/unit   # one directory
```

## Layers

| Layer | Location | What it covers | Database |
| --- | --- | --- | --- |
| Unit | `tests/unit/` | domain state machines, services with fake repositories, utilities | none |
| Integration | `tests/integration/` | repositories, tenant isolation, health endpoints | in-memory SQLite |
| Security | `tests/security/` | IDOR, tenant escape, mass assignment, authn/authz, injection, error hygiene | in-memory SQLite |
| E2E | `tests/e2e/` | full HTTP flows through the real app | in-memory SQLite |

Unit tests use fake repositories and fake `Kysely` handles, so they run in
milliseconds. Everything above that level boots the real Fastify app against a
fresh in-memory database per test file.

## The database harness

`tests/fixtures/testDatabase.ts` starts an in-memory SQLite database, migrates
it, and registers it as the test database. It reuses the **production**
adapter (`src/shared/database/sqlite.ts`), so integration tests exercise the
same code path as development.

```ts
beforeAll(startTestDatabase)
afterAll(stopTestDatabase)
beforeEach(cleanupTestData)
```

Node's `node:sqlite` enforces foreign keys, so the test harness catches
referential-integrity bugs that a Bun dev server would not. That is why
`AuthService.register` is tested end-to-end: the organization insert is
asserted inside the transaction.

## Fixtures

| File | Purpose |
| --- | --- |
| `fixtures/testDatabase.ts` | database lifecycle and truncation |
| `fixtures/factories.ts` | `createTestOrganization`, `createTestUser`, `createTestSession`, CRM rows |
| `fixtures/repos.ts` | row factories and fake repositories for unit tests |
| `fixtures/app.ts` | builds the app against the test database |
| `fixtures/http.ts` | session-cookie extraction from responses |

## What the suites guarantee

- **Security suite:** a session from one organization cannot read, write, or
  delete another organization's rows (404, not 403); body fields like
  `organization_id`, `role`, and `deleted_at` are ignored; expired and revoked
  sessions are rejected; `MEMBER` can read but not write; oversized input is
  `422`; error bodies carry a request id and no stack traces.
- **E2E:** register → company → contact → lead → qualify → convert → advance →
  win, invalid transitions returning `422`, logout killing the session, and
  password change revoking other sessions.
- **Integration:** the OpenAPI document is served with the expected shape, and
  cross-organization repository reads return nothing.

## Conventions

- Test files mirror source layout: `tests/unit/crm/`, `tests/integration/`, …
- Import with explicit `.ts` extensions from tests; `src` uses `.js`.
- One behavior per test, named as the behavior
  (`it('throws NotFoundError when removing a missing company')`).
- Prefer real collaborators (app, database) over mocks. Only repository and
  Kysely boundaries are faked, and only in unit tests.

## In CI

`.github/workflows/ci.yml` runs lint, typecheck, and format check as one job;
the test suite as a second; and a build plus image build that gates on both.
Nothing is deployed from CI directly — Render builds on merge.
