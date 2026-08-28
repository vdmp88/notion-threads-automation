# ADR 001: Use Fastify for the HTTP layer

- Status: accepted
- Date: 2026-08-28

## Context

Node.js can create an HTTP server with its built-in `node:http` module. This application will need a health route and may later need OAuth callbacks, webhooks, request validation, structured errors, and logging. Building those HTTP concerns manually would add work unrelated to the publishing business rules.

The user is also learning backend development, so the framework should remain understandable and should not hide the application behind a large opinionated abstraction.

## Decision

Use Fastify as the HTTP framework.

- Create the application in `src/app.ts`.
- Control startup and shutdown in `src/server.ts`.
- Register focused route modules under `src/routes/`.
- Keep publication logic outside route handlers.
- Use Fastify's Pino-based structured logging.

## Alternatives considered

### Built-in `node:http`

It would teach the lowest-level HTTP mechanics but requires manual routing, JSON handling, validation integration, logging, and error behavior. It is useful for small learning exercises but adds unnecessary application code here.

### Express

Express has a large ecosystem and simple fundamentals, but Fastify provides a stronger fit for typed, schema-oriented APIs and structured logging in this project.

### NestJS

NestJS provides extensive architecture and dependency injection, but it would introduce decorators, modules, and framework concepts before the project needs them.

## Consequences

- HTTP routes are concise and testable with `app.inject()`.
- The project gains consistent logging and plugin registration.
- Developers must learn Fastify's plugin and lifecycle model.
- Business logic still requires separate services; Fastify does not define the domain architecture by itself.
