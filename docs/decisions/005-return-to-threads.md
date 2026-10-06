# ADR 005: Return to Threads for the publishing target

- Status: accepted
- Date: 2026-10-05
- Supersedes: [ADR 004](004-target-x-twitter.md)

## Context

The user declined paid API usage for this learning project. Research into X access led to reviewing the official Threads documentation in the browser. The user explicitly approved returning to Threads and updating documentation.

The reviewed [Threads setup](https://developers.facebook.com/documentation/threads/get-started) does not specify a required subscription, credit purchase, or per-post charge. This supports choosing Threads as a no-paid-API path; it is not a guarantee of permanent free pricing. The user's actual developer account and access have not been configured or verified.

## Decision

The only publishing target is **Notion → Threads**, initially for one owner account. X implementation and billing setup are out of scope. No multi-platform abstraction is needed.

Retain the existing Notion adapter, Fastify foundation, planned MongoDB ledger, manual CLI execution, and approval-gated workflow. Phase 2 stays complete as a read-only adapter. Controlled Notion updates remain in Phase 4.

Phase 3 starts with an explanation of app identity, user authorization, permissions, and token lifecycle, then guided Meta app/Threads Tester setup. Use native `fetch` for the Threads adapter. Follow the [documented container-then-publish flow](https://developers.facebook.com/documentation/threads/posts); do not copy X endpoints, PKCE assumptions, or character-counting rules.

## Implementation boundary

This decision changes documentation only:

- Keep the existing folder, package, Notion connection, database, IDs, and secrets.
- Current code/CLI still use `xPostId` and `xUrl` as null placeholders. Rename them to `threadsPostId` and `threadsUrl` in a separate focused Phase 3 code step.
- Planned Notion properties become `Threads Post ID` and `Threads URL`. They have not been created; external schema changes require approval.
- Authentication configuration and environment-template changes follow the selected flow. No environment files changed here.
- No developer app, tester role, token, or publisher was configured by this decision.

## Consequences

- Backend learning and the reliability design remain useful without a paid X integration.
- Two-step publication requires tracking the container separately from the published post and reconciling ambiguous results.
- A Phase 3 test post is isolated and explicitly approved, not an automated Notion publication. The integrated workflow waits for Phase 4 persistence and duplicate protection.
- Keep `DRY_RUN=true`. Real publication or any external write requires explicit confirmation immediately before the action. Ask before introducing any paid service.
