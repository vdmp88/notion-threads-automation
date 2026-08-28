# Roadmap

Last reviewed: 2026-08-28

This roadmap separates the short learning exercises from the production MVP. A learning exercise may introduce a concept without becoming part of the final architecture.

## Learning track

Purpose: understand HTTP and backend data flow before external integrations add complexity.

- [x] Understand the Fastify application lifecycle.
- [x] Add and manually verify `GET /health`.
- [x] Add a temporary in-memory `GET /posts` route.
- [ ] Add temporary `POST /posts` and explain request bodies.
- [ ] Add `GET /posts/:id` and explain URL parameters.
- [ ] Add runtime validation for post input.
- [ ] Decide when the temporary Posts API has taught enough and stop extending in-memory storage.

The temporary route is not the production source of content. Notion remains the editorial source for the MVP.

## Product phases

### Phase 0 — discovery and architecture

Status: complete.

- repository and environment inspected
- MVP and non-goals defined
- primary technologies selected
- safety, idempotency, and failure policies documented
- external account prerequisites identified

### Phase 1 — application foundation

Status: complete.

- TypeScript and ES modules
- Fastify application and server lifecycle
- Zod configuration validation
- structured logging
- health route
- initial configuration and health tests
- ESLint, Prettier, and build scripts

Completion note: the temporary `GET /posts` route is a later learning exercise, not a Phase 1 product feature.

### Phase 2 — Notion adapter

Status: not started.

- re-check current official Notion API and SDK documentation
- create or connect the Notion integration
- retrieve the real data-source schema
- validate expected property names and types
- map eligible pages to `ContentPost`
- update controlled Notion properties
- test mapping and invalid-schema cases with mocked responses

Exit criterion: the application can read and validate `ready` posts without publishing or changing external state in dry-run mode.

### Phase 3 — Threads adapter

Status: not started.

- re-check current official Threads/Meta documentation
- configure the single-user app and permissions
- implement server-side authentication/token handling
- validate post text and API responses
- create and publish one text post only after explicit approval
- normalize and sanitize API errors

Exit criterion: one approved test post can be published deliberately, with credentials protected and ordinary tests making no real API calls.

### Phase 4 — idempotent publishing workflow

Status: not started.

- confirm the local MongoDB approach before adding the dependency
- connect using the official MongoDB driver
- create the publication collection and unique indexes
- atomically claim a Notion page
- persist the publication state machine and external identifiers
- update Notion after successful publication
- handle ambiguous outcomes without automatic republishing
- test eligibility, dry-run, duplicate protection, and recovery rules

Exit criterion: the manual CLI workflow can publish safely without intentionally duplicating a Notion page.

### Phase 5 — recurring execution

Status: postponed until the MVP workflow is stable.

- finite publishing command
- external scheduler rather than an in-process interval
- overlap protection and graceful termination
- safe retry policy

### Phase 6 — analytics synchronization

Status: postponed.

- retrieve only currently supported Threads metrics
- normalize unavailable metrics
- write metrics and the synchronization timestamp to Notion
- avoid excessive requests and overlapping runs

### Phase 7 — production reliability

Status: postponed.

- timeouts, backoff, and rate-limit handling
- token-expiration strategy
- bounded sanitized errors
- operational logs and job history
- failure-recovery runbooks

### Phase 8 — deployment

Status: postponed.

- choose a free or low-cost platform with explicit approval
- use platform-managed secrets
- upgrade to a current security-patched Node 24 LTS release
- configure health monitoring and the external scheduler
- document deployment and rollback

### Phase 9 — optional AI

Status: outside MVP.

- replaceable AI provider boundary
- generation and improvement remain drafts
- manual approval before publication
- later analysis of tone and performance

## How to update this file

- Mark a phase complete only when its exit criterion is met.
- Keep implementation detail in code, tests, and relevant documentation rather than turning the roadmap into a changelog.
- When sequencing changes, update `PROJECT_CONTEXT.md` in the same change.
