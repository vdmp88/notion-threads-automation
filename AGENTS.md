# Project guidance for Codex

## Start every task here

1. Read `PROJECT_CONTEXT.md` for the current goal, implementation state, and next checkpoint.
2. Read `README.md` for setup and commands.
3. Read only the relevant files under `docs/` for the task at hand.
4. Inspect the current working tree before changing code. Preserve unrelated or user-authored changes.

After a meaningful milestone, update `PROJECT_CONTEXT.md` so a new chat can continue without reconstructing previous conversations. Update `docs/roadmap.md` when phase status or sequencing changes. Record a new ADR under `docs/decisions/` only for an important decision that should remain understandable later.

## Product direction

Build an understandable, production-minded Node.js application for this flow:

`Notion-approved content → validation → safe Threads publication → publication state in MongoDB → result and later analytics back in Notion`

Optional AI work begins only after the core publishing workflow is stable. AI output must remain a draft until a human approves it.

## Safety boundaries

- Keep `DRY_RUN=true` as the default.
- Never publish a real Threads post or perform another external write without the user's explicit confirmation immediately before the action.
- Never expose or log tokens, credentials, `.env` contents, or other secrets.
- Prefer free tiers and open-source solutions. Ask before introducing a paid service.
- Do not deploy publicly, alter external schemas, or make destructive changes without explicit approval.
- Preserve idempotency: a retry must never intentionally publish the same Notion page twice.

## Teaching and collaboration style

- The user is a React frontend developer learning backend development from the beginning.
- Explain new concepts in plain Russian. Connect them to familiar frontend concepts when that makes the idea clearer.
- Keep explanations focused: what it is → why this project needs it → how the current code implements it.
- Work in small steps. Do not implement several major phases at once.
- Before a meaningful change, state the goal and files involved. Afterward, show what changed and explain the important code.
- Inspect files and the local environment instead of asking questions that can be answered directly.
- The user installs dependencies personally. Provide the exact command and explain why the dependency is needed; do not install it unless the user explicitly changes this preference.
- Do not run the development server, tests, builds, linters, or formatters unless the user explicitly asks. Never claim a check passed unless it was actually run.

## Engineering baseline

- Node.js 24, TypeScript, strict mode, ES modules, and npm.
- Fastify for HTTP, Zod for runtime validation, and Fastify/Pino structured logging.
- Official Notion SDK, native `fetch` for Threads, and the official MongoDB Node.js driver without Mongoose.
- Vitest, ESLint, and Prettier.
- One codebase with separate HTTP and finite CLI entry points.
- Keep HTTP routes thin. Put business rules in services and external API details in adapters.
- Map raw external responses to typed internal domain models.
- Add new folders only when real code needs them; do not create empty architecture scaffolding.

## Documentation ownership

- `AGENTS.md`: stable instructions for agents; keep concise.
- `PROJECT_CONTEXT.md`: changing handoff state and next checkpoint.
- `README.md`: human setup and usage.
- `docs/architecture.md`: approved system design and reliability model.
- `docs/roadmap.md`: phases, learning track, and completion criteria.
- `docs/decisions/`: durable explanations of important architectural choices.
