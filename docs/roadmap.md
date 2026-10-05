# Roadmap

Last reviewed: 2026-10-05

This roadmap separates the short learning exercises from the production MVP. A learning exercise may introduce a concept without becoming part of the final architecture.

The active product target is **Notion → X (Twitter)**. The user replaced Threads on 2026-09-08; completed Notion work is retained. Historical repository and Notion names do not change the target. See [ADR 004](decisions/004-target-x-twitter.md).

## Learning track

Purpose: learn to independently build backend logic for web applications. The user clarified this goal on 2026-09-10, with shops, blogs, learning apps, and simple AI agents as examples. For now the assistant implements the project code, explains each new mechanism, and then offers small optional exercises.

Immediate priority: begin Phase 3 with X access/pricing and authentication research. Continue explaining adapter/domain boundaries and dependency passing through concrete backend work; these remain learning topics, not implementation blockers. Ask about architectural reasoning rather than obvious console output or exception flow. Product implementation and demonstrated understanding are tracked separately in PROJECT_CONTEXT.md.

Existing HTTP exercises:

- [x] Understand the Fastify application lifecycle.
- [x] Add and manually verify `GET /health`.
- [x] Add a temporary in-memory `GET /posts` route.
- [ ] Add temporary `POST /posts` and explain request bodies.
- [ ] Add `GET /posts/:id` and explain URL parameters.
- [ ] Add runtime validation for post input.
- [ ] Decide when the temporary Posts API has taught enough and stop extending in-memory storage.

The temporary route is not the production source of content. Notion remains the editorial source for the MVP.

Broader learning topics to revisit as prerequisites and understanding allow:

- HTTP request/response flow, methods, status codes, parameters, request bodies, validation, and connecting a React/Next.js UI to an API.
- Persistent data modeling, CRUD, indexes, atomic operations, transactions, and when relational versus document storage fits. Keep the approved MongoDB choice for this product.
- Business rules and service boundaries, authentication versus authorization, sessions/cookies, and ownership checks for user data.
- External APIs and background work: timeouts, retries, idempotency, partial failures, and later AI tool calls with controlled permissions.
- Debugging, useful tests and logs, application lifecycle, deployment configuration, and secrets.

These are learning directions, not additional MVP features or a requirement to cover every topic before finishing this project. Use current code when it demonstrates the concept; choose small separate exercises for gaps such as multi-user authorization. Plan the second project's scope with the user later.

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

Status: complete as a read-only adapter, with the scope clarification approved on 2026-10-05. The exit criterion is implemented and has recorded earlier manual verification; no new checks were run for closure. Publication fields remain reserved null values. Learning gaps and verification history are tracked separately in PROJECT_CONTEXT.md.

- re-check current official Notion API and SDK documentation
- create or connect the Notion integration
- retrieve the real data-source schema
- validate expected property names and types
- map eligible pages to `ContentPost`
- test mapping and invalid-schema cases with mocked responses

Exit criterion: the application can read and validate `ready` posts without publishing or changing external state in dry-run mode.

Approved scope clarification: controlled Notion-property updates move to Phase 4 alongside persisted publication results. X-specific text rules belong to Phase 3; publication metadata and duplicate protection belong to Phase 4. Current CLI commands are always read-only, including when DRY_RUN is false; a publishing dry-run workflow is not implemented. Existing tests are retained; the reduced suite remains unrun, and no tests were added or run for closure.

### Phase 3 — X (Twitter) adapter

Status: not started.

- re-check current official X API documentation, endpoint access, and pricing; confirm any cost with the user before paid calls
- configure the single-user developer app and choose supported user-context authentication with write permissions
- implement server-side authentication/token handling for that flow
- validate text using X-specific length/counting rules and validate API responses; do not reuse the former platform limit
- create one text post through the X API only after explicit approval
- normalize and sanitize API errors

Exit criterion: one approved test post can be published deliberately, with credentials protected and ordinary tests making no real API calls.

### Phase 4 — idempotent publishing workflow

Status: not started.

- confirm the local MongoDB approach before adding the dependency
- connect using the official MongoDB driver
- create the publication collection and unique indexes
- atomically claim a Notion page
- persist the publication state machine and external identifiers
- load publication metadata and implement controlled Notion-property updates after successful publication (write-adapter work moved from Phase 2)
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

- confirm available X metrics, read permissions, and API costs for the selected access level
- retrieve only supported and authorized X metrics
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
