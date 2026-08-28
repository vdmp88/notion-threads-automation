# ADR 002: Use the official MongoDB Node.js driver

- Status: accepted for Phase 4
- Date: 2026-08-28

## Context

The publishing workflow needs durable technical state to prevent intentional duplicate publication and to recover when Threads succeeds but a later operation fails. MongoDB will store publication claims, state transitions, attempts, identifiers, and sanitized errors.

The main client choices considered were the official MongoDB Node.js driver and Mongoose.

## Decision

Use the official MongoDB Node.js driver when Phase 4 begins. Do not add the dependency or connection code before the workflow needs persistence.

- Use a dedicated repository boundary for publication records.
- Create a unique index on `notionPageId`.
- Use atomic operations for publication claims.
- Validate stored domain data explicitly with TypeScript and Zod where appropriate.

## Alternatives considered

### Mongoose

Mongoose provides schemas, models, middleware, and document methods. Those features are useful in some applications, but they add another abstraction layer while the user is still learning MongoDB itself. The current workflow needs direct collection operations and explicit state transitions more than ODM behavior.

### Notion as the only storage

Notion is the editorial source, but it cannot reliably represent every intermediate technical state. If Threads publishes and the process fails before Notion is updated, relying only on the visible Notion status can cause an unsafe retry.

### PostgreSQL

PostgreSQL could model the ledger correctly, but MongoDB was selected for the current project and its document model fits the publication record. Reconsider only if later requirements demonstrate a relational need.

## Consequences

- MongoDB operations remain explicit and easier to trace while learning.
- The application owns validation and mapping rather than relying on Mongoose models.
- Unique indexes and atomic updates can enforce the duplicate-protection rules.
- More repository code may be required than with an ODM.
- The local MongoDB execution method must be confirmed before Phase 4 implementation.
