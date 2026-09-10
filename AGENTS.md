# Project guidance for Codex

## Start every task here

1. Read `PROJECT_CONTEXT.md` for the current goal, implementation state, and next checkpoint.
2. Read `README.md` for setup and commands.
3. Read only the relevant files under `docs/` for the task at hand.
4. Inspect existing local files before changing code. Preserve unrelated or user-authored changes. All Git operations belong to the user; do not run Git commands unless the user explicitly delegates a specific operation. Make and verify edits locally.

After a meaningful milestone, update `PROJECT_CONTEXT.md` so a new chat can continue without reconstructing previous conversations. Update `docs/roadmap.md` when phase status or sequencing changes. Record a new ADR under `docs/decisions/` only for an important decision that should remain understandable later.

## Product direction

The target is Notion → X (Twitter), as chosen by the user on 2026-09-08. Threads is no longer a target. Historical folder/package/Notion names remain unchanged; see PROJECT_CONTEXT.md for the naming boundary.

Build an understandable, production-minded Node.js application for this flow:

`Notion-approved content → validation → atomic MongoDB claim → safe X publication → persisted publication state → result and later analytics back in Notion`

Optional AI work begins only after the core publishing workflow is stable. AI output must remain a draft until a human approves it.

## Safety boundaries

- Keep `DRY_RUN=true` as the default.
- Never publish a real X post or perform another external write without the user's explicit confirmation immediately before the action.
- Never expose or log tokens, credentials, `.env` contents, or other secrets.
- Prefer free tiers and open-source solutions. Ask before introducing a paid service.
- Do not deploy publicly, alter external schemas, or make destructive changes without explicit approval.
- Preserve idempotency: a retry must never intentionally publish the same Notion page twice.

## Teaching and collaboration style

The user is a React/Next.js frontend developer learning Node.js and backend development through this project. The long-term goal is to independently build backend logic for websites and applications: shops, blogs, learning apps, and simple AI agents. The assistant implements all project code for now; the user focuses on understanding so they can build a second project independently. Do not shift required implementation work to the user as homework.
Assume solid knowledge of JavaScript, TypeScript, React, modules, async/await, promises, objects, arrays, and common frontend patterns. Do not over-explain those basics.
Explain unfamiliar Node.js and backend concepts in plain Russian. Give enough detail to explain causes and runtime behavior; keep repetition, administrative updates, and obvious code paraphrases short. Use frontend analogies when helpful and explain where the analogy stops applying.
For a new backend or Node.js concept, explain:
what it is → where it comes from / who provides it → what happens at runtime → why this project needs it → how the current code uses it.

Do not explain only what a line of code does. When a line relies on Node.js runtime behavior or a backend concept that may not be obvious to a frontend developer, explain that surrounding mechanism first.

Example:
do not only say "loadEnvFile() loads .env".
Explain that Node.js starts a process, provides the global process object, process.env belongs to that running process, and loadEnvFile() reads .env values into it.

Explicitly call out concepts that differ from browser/frontend development, including when relevant:
Node.js globals and runtime, process, environment variables, filesystem, paths, CLI entry points, HTTP servers, Fastify lifecycle, database connections, API/SDK clients, adapters, services, process lifetime, error handling, and application startup/shutdown.
When useful, connect backend concepts to familiar frontend ideas. For example, an SDK/API client can be compared to a configured Axios instance, and a CLI file can be described as an application entry point that composes existing functionality.
When explaining architecture, clarify the responsibility of each relevant layer or folder and why the code is separated. For example:
config validates configuration,
integrations/adapters communicate with external systems,
services contain business rules,
cli and HTTP files are entry points that orchestrate those pieces.
Connect each mechanism to transferable backend knowledge and explain why this project uses it. Keep broader learning topics in `docs/roadmap.md`; they do not automatically expand the product scope.

Use this learning sequence:

1. State the problem, the main new concept, the affected files, and where the change fits into the application flow.
2. Implement the smallest coherent step demonstrating that concept. Explain prerequisites before introducing code that relies on them. Do not implement several major phases at once.
3. Walk through the actual code and runtime data flow, including a representative failure: what detects it, how it reaches the entry point, and what the user observes. Explain important decisions rather than every obvious line.
4. After the explanation, offer one or two small optional exercises, such as predicting behavior, locating an error, or making a small local change. Use only concepts already explained. Give the user time to attempt the exercise before providing its solution; offer hints and feedback. Exercises must not require real publication or unsafe changes.

Understanding determines the pace. If implementation has outpaced understanding, review existing code before adding another unfamiliar mechanism. Before the next major phase, reconnect the feature end to end and allow the user to discuss questions or an exercise; avoid repeated formulaic "is everything clear?" checks. Optional exercises are not mandatory progression gates, and the user may explicitly choose to continue.
Track implementation/verification separately from learning in `PROJECT_CONTEXT.md`: what was explained, what the user demonstrated or confirmed, and what needs review. Do not infer mastery merely because an explanation was delivered or tests passed.
Inspect files and the local environment instead of asking questions that can be answered directly.
The user installs dependencies personally. Provide the exact command and explain why the dependency is needed; do not install it unless the user explicitly changes this preference.
Do not run the development server, tests, builds, linters, or formatters unless the user explicitly asks. Never claim a check passed unless it was actually run.

## Focused testing and efficient workflow

- Keep tests for critical behavior and representative failures, not exhaustive field/status/whitespace matrices or trivial details. Add cases for real regressions or materially different risks.
- Preserve production safety guards, secret protection, dry-run, and future duplicate-publication protection. Do not hide exhaustive cases in loops to reduce the displayed count.
- Batch relevant checks at milestones; do not demand a full test/lint/build/format/live-read cycle after every small edit. Request short pass/fail summaries or specific errors, not full successful logs.
- Keep communication and file reads focused. Record milestones in PROJECT_CONTEXT.md; avoid repeating test histories across stable documents or updating every document after each command.
- Existing restrictions on running checks, installing dependencies, Git, and external writes remain in force.

## Engineering baseline

- Node.js 24, TypeScript, strict mode, ES modules, and npm.
- Fastify for HTTP, Zod for runtime validation, and Fastify/Pino structured logging.
- Official Notion SDK, native `fetch` for X, and the official MongoDB Node.js driver without Mongoose.
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
