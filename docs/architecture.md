# Architecture

Status: approved MVP design, recorded on 2026-07-28.

## Goals

- Publish only manually approved Notion content with status `ready`.
- Default to a no-write dry run.
- Never intentionally publish the same Notion page twice.
- Preserve enough state to recover when Threads succeeds but a later operation fails.
- Keep external API shapes at adapter boundaries rather than spreading them through business logic.
- Start with one understandable Node.js codebase and direct API calls.

## Non-goals for the MVP

- Notion webhooks
- scheduled posts or an internal cron loop
- queues or microservices
- multiple Threads users
- AI-generated content
- automatic publication of AI output
- a dashboard

## System context

```text
Notion data source
        |
        | manual CLI query; polling later
        v
Publishing workflow
  1. Map Notion page to ContentPost
  2. Validate schema and text
  3. Atomically claim publication in MongoDB
        |
        | DRY_RUN=false only
        v
Threads API
  1. Create a TEXT media container
  2. Publish the container
        |
        v
MongoDB publication record
  - container ID
  - Threads post ID
  - publication state
  - sanitized errors and retry information
        |
        | safe, repeatable update
        v
Notion page
  - Threads post ID and URL
  - publication date
  - Status = published

Later:

External scheduler
        |
        v
Analytics command
        |
        | Threads Insights API
        v
Notion metric properties
```

## Main components

### Fastify HTTP application

Provides the health check in Phase 1. OAuth callback and webhook routes are added only when needed. It owns HTTP-specific concerns such as request parsing and centralized error responses.

### CLI commands

The MVP publishing workflow runs as a manual, finite CLI command. Analytics later becomes a second command. A job should terminate with a meaningful exit code rather than requiring a permanently running server.

### Notion adapter

Uses the official Notion SDK. It retrieves the current data-source schema, queries eligible pages, maps Notion properties to domain values, and performs controlled page updates. Raw Notion objects do not leave this boundary.

### Threads adapter

Uses native `fetch` with an abort timeout. It creates and publishes text containers, retrieves post details, normalizes API errors, and redacts credentials from diagnostic information.

### Publication service

Contains the business rules for eligibility, validation, dry-run behavior, state transitions, and recovery. Tests can supply mock Notion, Threads, and publication-repository implementations.

### MongoDB publication repository

Uses the official MongoDB Node.js driver. It creates unique indexes, atomically claims a Notion page, and persists publication progress. Mongoose is intentionally omitted to avoid introducing an ODM before one provides a demonstrated benefit.

## Internal domain model

External responses are mapped to an internal model similar to:

```ts
type PostStatus = 'draft' | 'ready' | 'published';

interface ContentPost {
  notionPageId: string;
  title: string;
  text: string;
  topic: string | null;
  status: PostStatus;
  threadsPostId: string | null;
  threadsUrl: string | null;
  publishedAt: Date | null;
}
```

This model is the backend equivalent of converting an API response into stable frontend view-model props. Tests and business rules depend on our representation, not on every field returned by Notion.

## Notion data model

These are expected Notion UI property types. Phase 2 must retrieve the real schema and validate property names and types before mapping any page.

| Property             | Type      | Purpose                                       |
| -------------------- | --------- | --------------------------------------------- |
| `Name`               | Title     | Human-readable name                           |
| `Text`               | Rich text | Threads post text                             |
| `Topic`              | Select    | Consistent topic grouping                     |
| `Status`             | Status    | `draft`, `ready`, or `published`              |
| `Sync Status`        | Select    | `idle`, `processing`, `error`, or `published` |
| `Threads Post ID`    | Rich text | Stable Threads identifier                     |
| `Threads URL`        | URL       | Published post link                           |
| `Published At`       | Date      | Threads publication time                      |
| `Views`              | Number    | Views when available                          |
| `Likes`              | Number    | Lifetime likes                                |
| `Replies`            | Number    | Lifetime replies                              |
| `Reposts`            | Number    | Lifetime reposts                              |
| `Quotes`             | Number    | Lifetime quotes when available                |
| `Metrics Updated At` | Date      | Last successful metrics update                |
| `Last Error`         | Rich text | Bounded, sanitized failure explanation        |
| `Retry Count`        | Number    | Count of safe retry attempts                  |

`Scheduled At` is postponed until scheduled publishing is designed.

## Publication ledger

The `publications` collection will contain one document per Notion page. Its precise Zod and MongoDB schema will be introduced in Phase 4. Expected fields include:

- `notionPageId` with a unique index
- `contentHash` for detecting content changes during a run
- `state`
- `threadsContainerId`
- `threadsPostId`
- `threadsUrl`
- `publishedAt`
- `attemptCount`
- bounded and sanitized `lastError`
- `createdAt` and `updatedAt`

The initial state machine is:

```text
claimed
   |
   v
container_created
   |
   v
publish_started
   |
   v
published
   |
   v
notion_synced
```

Terminal or review states such as `validation_failed`, `failed`, and `needs_review` will be defined when their retry rules are implemented.

## Idempotency and failure policy

MongoDB and Threads cannot participate in one shared transaction, so the system cannot promise mathematical exactly-once delivery. The safe goal is to prevent automatic duplicate intent.

| Failure                                                 | MVP behavior                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Notion returns the same page repeatedly                 | Unique `notionPageId` and state check skip it                                  |
| Two workers see one `ready` page                        | Atomic MongoDB claim allows one winner                                         |
| Text is empty or too long                               | Reject before claiming or calling Threads                                      |
| Threads container creation succeeds                     | Persist its ID before proceeding                                               |
| Process crashes before publication starts               | Resume from the stored safe state                                              |
| Publication may have occurred but no response was saved | Mark/retain `publish_started`; require reconciliation and never auto-republish |
| Threads returns a post ID but Notion update fails       | Store the Threads result, then retry only the Notion update                    |
| Notion or Threads returns a rate limit                  | Respect retry guidance and back off only where retry is safe                   |
| Token expires                                           | Stop with a credential-specific error; do not treat it as a content failure    |
| Analytics runs overlap                                  | Add a MongoDB lease when analytics scheduling is introduced                    |
| A metric is unavailable                                 | Leave it unset and continue updating supported metrics                         |

Dry-run mode may read configuration and Notion data, but it must not create a Threads container, publish, update Notion, or write a publication record.

## Authentication and secrets

This is a single-user integration.

- Local secrets live in an ignored `.env` file.
- Production secrets will use the deployment platform's environment/secret facility.
- Notion and Threads tokens, the Threads app secret, and MongoDB credentials are server-only.
- Secrets are never included in structured log fields or user-facing errors.
- OAuth callback URLs must exactly match Meta configuration.
- OAuth `state` will be generated and validated to prevent login CSRF.
- Short-lived Threads tokens are exchanged server-side for long-lived tokens.

## Execution model

The repository is one codebase with multiple entry points:

- an HTTP entry point for health checks and future callbacks
- a finite publishing CLI command
- a later finite analytics CLI command

For the MVP, jobs run manually. In production, an external scheduler should invoke the finite command. An in-process `setInterval` is not reliable across restarts, deployments, or multiple replicas.

A queue is postponed. It adds infrastructure while not eliminating the ambiguous external side effect between Threads and MongoDB.

## Local and production environments

### Local development

- Node.js 24 and npm
- Fastify on loopback by default
- MongoDB starting in Phase 4; Docker versus a managed free cluster will be reconfirmed first
- `.env` for local secrets
- manual CLI execution

### Production direction

- the same build artifact and finite commands
- platform-managed secrets
- managed MongoDB only after its limits and cost are approved
- external scheduler with overlap protection
- centralized structured logs and basic availability monitoring
- current security-patched Node 24 LTS runtime

No deployment provider or paid infrastructure has been selected.

## API documentation baseline

Verified against official documentation on 2026-07-28:

- Notion API version: `2026-03-11`
- Notion SDK: current `@notionhq/client` 5.x line
- Notion query model: data sources rather than the deprecated database-query API
- Threads permissions for publishing: `threads_basic`, `threads_content_publish`
- Threads analytics permission: `threads_manage_insights`
- Threads publishing: create a container, then publish it
- Threads text limit: 500 characters
- Threads long-lived access token lifetime: 60 days
- Threads post metrics: `views`, `likes`, `replies`, `reposts`, and `quotes`

The Threads publishing documentation currently uses `graph.threads.com`, while some authentication and insights examples still use `graph.threads.net`. Each integration phase must re-check the endpoint reference and changelog before fixing a base URL in code.

## Decisions

| Decision             | MVP choice                                                |
| -------------------- | --------------------------------------------------------- |
| Package manager      | npm                                                       |
| Account model        | one owner/Threads account                                 |
| Trigger              | manual CLI, then polling                                  |
| Persistence          | MongoDB when Phase 4 begins                               |
| MongoDB client       | official driver, no Mongoose                              |
| Local MongoDB        | Reconfirm Docker versus a managed free cluster in Phase 4 |
| Process architecture | one codebase, separate entry points                       |
| Scheduling           | external scheduler later                                  |
| Queue                | postponed                                                 |
| AI                   | outside MVP and always approval-gated                     |
| Node version         | keep local `v24.1.0`; update before production            |
