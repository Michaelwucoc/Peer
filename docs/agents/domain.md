# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: single-context

This repository is **single-context**: one app, one vocabulary, one decision log. There is a
single `CONTEXT.md` at the repo root and a single `docs/adr/` next to it — no
`CONTEXT-MAP.md` and no per-package context files, because no monorepo boundary exists here.

```
/
├── CONTEXT.md          ← the shared domain vocabulary for the whole repo
├── docs/adr/           ← architecture decisions for the whole repo
└── src/
```

Both are created lazily, the first time a term or a decision actually gets resolved. Do not
create them upfront, and do not flag their absence during normal exploration.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain vocabulary for the whole app (roles,
  signup/roster records, scheduling and hour concepts, policy and approval terms).
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If either file doesn't exist yet, **proceed silently**. Don't flag the absence; don't suggest
creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and
`/improve-codebase-architecture`) creates them when terms or decisions actually get resolved.

(Some skills name the root vocabulary file `GLOSSARY.md`. In this repo it is `CONTEXT.md`.)

The maintained human guides under `docs/` (`technical-report.md`, `program-reference.md`,
`user-guide.md`, `CONTRIBUTING`-style guides) explain current behavior. They are evidence
about intent, not the domain vocabulary: read them, then check the code. A term that already
lives in the guides and matters for reasoning about the system belongs in `CONTEXT.md`.

## Use the vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis,
a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the file
explicitly avoids.

If the concept you need isn't in `CONTEXT.md` yet, that's a signal: either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
