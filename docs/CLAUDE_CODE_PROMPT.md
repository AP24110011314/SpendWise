# Master Prompt for Claude Code — SpendWise

> Setup: create an empty folder `spendwise/`, copy `CLAUDE.md` into its root and the `docs/` folder next to it, run `git init`, open Claude Code in that folder, and paste everything inside the block below.

```
You are building SpendWise, a full-stack MERN personal finance tracker, from scratch in this empty repository.

SOURCE OF TRUTH
Before writing any code, read these files completely and in this order:
1. CLAUDE.md                     (rules and conventions — always follow)
2. docs/PRD.md                   (what to build)
3. docs/ARCHITECTURE.md          (stack, folder layout, env, scripts)
4. docs/DATABASE.md              (Mongoose schemas and indexes)
5. docs/API.md                   (every endpoint, request/response shape)
6. docs/AGGREGATIONS.md          (analytics pipelines, recurring logic, forecast algorithm)
7. docs/FRONTEND.md              (pages, components, charts, UX states)
8. docs/TESTING.md               (test strategy and required cases)
9. docs/IMPLEMENTATION_PLAN.md   (phased build order with acceptance criteria)
10. docs/SETUP.md                (local run instructions)
11. docs/PROGRESS.md             (you maintain this)

HARD CONSTRAINTS
- NO Docker anywhere: no Dockerfile, docker-compose, .dockerignore, devcontainer, or container instructions. MongoDB runs natively on the machine or on MongoDB Atlas. Tests use mongodb-memory-server.
- Direct implementation: write real, working code. No placeholders, no "TODO: implement", no mocked data in production code paths, no stubbed endpoints.
- Stack is fixed: Node 20+, Express 4, Mongoose 8, MongoDB, React 18 + Vite, Tailwind CSS, Recharts, TanStack Query, React Router. JavaScript (ESM), not TypeScript. Do not swap libraries listed in docs/ARCHITECTURE.md without a written reason in docs/PROGRESS.md.
- Do not use MongoDB multi-document transactions (local standalone mongod does not support them). Use idempotent writes and unique indexes instead.
- Money is stored and transferred as integer minor units (e.g. 12550 = 125.50). Never use floating-point for stored money.

HOW TO WORK
1. Start in plan mode: summarize your understanding in under 15 lines, list any genuine ambiguities (only ask if a decision truly blocks you; otherwise choose the documented default), then proceed.
2. Follow docs/IMPLEMENTATION_PLAN.md phase by phase, in order. Do not start a phase until the previous phase's acceptance criteria pass.
3. For each phase: implement, write the tests listed in docs/TESTING.md for that phase, run them, run the linter, fix everything, then check off the phase in docs/PROGRESS.md (what was done, deviations, how to verify) and make one git commit using Conventional Commits (e.g. `feat(budgets): add budget progress and alerts`).
4. Keep controllers thin and put business logic in server/src/services. Every database query must be scoped by the authenticated userId.
5. After Phase 8, run the full verification checklist at the end of docs/IMPLEMENTATION_PLAN.md and report the results.

DEFINITION OF DONE
- `npm run dev` starts the API and the client together with only Node and a MongoDB connection string.
- `npm test` passes; `npm run lint` is clean; `npm run build && npm start` serves the app from a single Node process.
- `npm run seed` creates a demo user (demo@spendwise.app / Demo@1234) with about 6 months of realistic data so every chart and the forecast show real numbers.
- Every feature in docs/PRD.md marked MUST is working end to end in the browser.
- README.md explains setup and scripts, with zero Docker references.

Begin now by reading the files, then present your short plan and start Phase 0.
```
