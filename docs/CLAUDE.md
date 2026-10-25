# SpendWise — Project Guide for Claude Code

SpendWise is a personal finance tracker: income and expenses, categories, recurring transactions, budgets with alerts, spending forecasts, CSV import/export, and monthly comparisons. Stack: MERN with Recharts and MongoDB aggregation pipelines.

## Hard rules (never violate)
1. **No Docker.** Do not create Dockerfile, docker-compose.yml, .dockerignore, devcontainer configs, or mention containers in docs. MongoDB runs natively or on Atlas; tests use `mongodb-memory-server`.
2. **No multi-document transactions.** Use unique indexes and idempotent operations.
3. **Money = integer minor units** (12550 = 125.50). Convert only at the UI edge using `Intl.NumberFormat`.
4. **Every query is scoped by `userId`.** Never trust an id from the client without checking ownership.
5. **In aggregation pipelines, cast `userId` and other ids to `mongoose.Types.ObjectId`** — Mongoose does not auto-cast inside `aggregate()`.
6. **No secrets in git.** Only `.env.example` files are committed.
7. **No placeholder code.** No empty handlers, fake data in real paths, or `// TODO` left behind.

## Stack
- Server: Node 20+, Express 4, Mongoose 8, zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, cookie-parser, multer, csv-parse, fast-csv (or csv-stringify), node-cron, luxon, pino (+ pino-http)
- Client: React 18, Vite, React Router 6, TanStack Query 5, axios, Tailwind CSS 3, Recharts, react-hook-form + zod, react-hot-toast, date-fns, lucide-react
- Tests: Vitest + supertest + mongodb-memory-server (server); Vitest + React Testing Library (client)
- Tooling: ESLint + Prettier, npm workspaces, concurrently

## Layout
```
spendwise/
  package.json            # workspaces: server, client
  server/src/{config,models,routes,controllers,services,middleware,jobs,utils,scripts}
  server/tests/
  client/src/{api,components,pages,hooks,lib,context}
  docs/
```
Full tree is in `docs/ARCHITECTURE.md`.

## Commands
```
npm run dev        # API (:5000) + client (:5173) together
npm run dev:server / npm run dev:client
npm test           # all tests
npm run lint
npm run seed       # demo data
npm run build      # client build into client/dist
npm start          # production: Express serves API + client/dist
```

## Conventions
- ESM everywhere (`"type": "module"`). Named exports; file names camelCase for modules, PascalCase for React components.
- Server layering: `routes` → `controllers` (parse/validate, call service, shape response) → `services` (business logic, DB) → `models`.
- Validate every request body, query, and params with zod via the `validate` middleware.
- Errors: throw `ApiError(status, code, message, details?)`; one central error middleware formats them.
- Response envelope: success `{ "data": ..., "meta": ... }`, error `{ "error": { "code", "message", "details" } }`.
- Dates: stored as UTC `Date`. Month boundaries and grouping use the user's `timezone` (default `Asia/Kolkata`) via Luxon and the `timezone` option of `$dateToString`.
- Services that depend on the current time accept an optional `now` argument so tests can control the clock.
- Client data fetching only through TanStack Query hooks in `client/src/hooks`; no fetch calls inside components.
- Every page implements loading, empty, and error states.
- Commits: Conventional Commits, one per phase minimum.

## Definition of done for any task
Code works in the browser/API, tests added and passing, lint clean, `docs/PROGRESS.md` updated.

## Docs index
PRD.md · ARCHITECTURE.md · DATABASE.md · API.md · AGGREGATIONS.md · FRONTEND.md · TESTING.md · IMPLEMENTATION_PLAN.md · SETUP.md · PROGRESS.md
