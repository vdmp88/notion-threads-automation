# ADR 003: Separate the roles of Notion and MongoDB

- Status: accepted
- Date: 2026-08-28
- Amended: 2026-09-08 — examples now target X (Twitter); the original storage decision remains accepted. See [ADR 004](004-target-x-twitter.md).

## Context

Earlier discussions used both Notion and MongoDB as possible places to store posts. Without a clear boundary, future implementation could duplicate ownership or spread technical workflow fields through the editorial interface.

The user needs a convenient place to write, approve, and review content. The application also needs durable internal state for claims, retries, ambiguous publication outcomes, and synchronization progress.

## Decision

Use Notion as the editorial source of truth and MongoDB as the internal publication ledger.

Notion owns:

- post title and text
- topic
- editorial status: `draft`, `ready`, or `published`
- published X ID, URL, and date shown to the user
- later, supported metrics shown to the user

MongoDB owns:

- atomic publication claims
- publication state transitions
- X post identifiers and publication progress needed for recovery
- attempt counts and sanitized errors
- reconciliation state
- later, synchronization leases or technical history when justified

## Alternatives considered

### Notion only

Simpler initially, but unsafe when an external publication succeeds and the Notion update fails. The visible `ready` status could cause the post to be submitted again.

### MongoDB as the editorial source

It would provide full control but would require building a separate editing interface. That is unnecessary because Notion already serves as the user's content workspace.

### Duplicating full post ownership

Keeping independently editable copies in both systems creates conflict and synchronization problems. MongoDB may store a content hash or snapshot needed for safety, but it is not a second editorial database.

## Consequences

- The ownership of each field and workflow state is explicit.
- The user continues working in Notion.
- MongoDB can protect idempotency without cluttering Notion with every internal transition.
- Adapters and mapping code are required between external Notion data and internal domain types.
- Reconciliation rules are still necessary because MongoDB and X cannot share one transaction.
