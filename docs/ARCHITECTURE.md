# Architecture

## 1. Overview
Monorepo with npm workspaces. A REST API (Express + Mongoose) and a SPA (React + Vite). In development they run as two processes with a Vite proxy to avoid CORS. In production a single Node process serves the API and the built client. **No Docker at any stage.**

```
Browser (React SPA) ──/api──▶ Express API ──▶ MongoDB (local mongod or Atlas)
                                  │
                                  └── node-cron job (recurring transactions) inside the API process
```

## 2. Folder structure
```
spendwise/
├─ package.json                 # workspaces, root scripts
├─ .gitignore  .editorconfig  .prettierrc  eslint.config.js
├─ README.md
├─ CLAUDE.md
├─ docs/
├─ server/
│  ├─ package.json
│  ├─ .env.example
│  ├─ src/
│  │  ├─ server.js              # boot: connect DB, start cron, listen
│  │  ├─ app.js                 # express app (exported for supertest)
│  │  ├─ config/{env.js,db.js,logger.js}
│  │  ├─ models/{User,Category,Transaction,RecurringRule,Budget,Notification,ImportBatch}.js
│  │  ├─ routes/{index,auth,categories,transactions,recurring,budgets,notifications,analytics,import,export}.routes.js
│  │  ├─ controllers/*.controller.js
│  │  ├─ services/{auth,category,transaction,recurring,budget,notification,analytics,forecast,import,export}.service.js
│  │  ├─ middleware/{auth,validate,error,notFound,rateLimit,upload}.js
│  │  ├─ jobs/recurring.job.js
│  │  ├─ validators/*.schema.js  # zod schemas per resource
│  │  ├─ utils/{ApiError,asyncHandler,money,dates,escapeRegex,fingerprint}.js
│  │  └─ scripts/seed.js
│  └─ tests/{setup.js,helpers/,unit/,integration/}
└─ client/
   ├─ package.json  vite.config.js  tailwind.config.js  postcss.config.js  index.html  .env.example
   └─ src/
      ├─ main.jsx  App.jsx  routes.jsx  index.css
      ├─ api/{client.js,auth.js,transactions.js,categories.js,budgets.js,recurring.js,analytics.js,notifications.js,importExport.js}
      ├─ context/AuthContext.jsx
      ├─ hooks/              # useTransactions, useBudgets, useAnalytics, ... (TanStack Query)
      ├─ lib/{money.js,dates.js,csv.js,constants.js}
      ├─ components/
      │  ├─ layout/{AppShell,Sidebar,Topbar,NotificationBell,ProtectedRoute}.jsx
      │  ├─ ui/{Button,Input,Select,Modal,Card,Badge,Spinner,EmptyState,ErrorState,Pagination,MonthPicker,ConfirmDialog}.jsx
      │  ├─ charts/{CategoryDonut,TrendChart,BudgetBars,DailyCumulativeLine}.jsx
      │  └─ forms/{TransactionForm,CategoryForm,BudgetForm,RecurringForm}.jsx
      └─ pages/{Login,Register,Dashboard,Transactions,Categories,Budgets,Recurring,Compare,ImportExport,Settings,NotFound}.jsx
```

## 3. Environment variables
`server/.env.example`
```
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/spendwise
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
COOKIE_NAME=sw_token
ENABLE_CRON=true
RECURRING_CRON=5 0 * * *      # daily at 00:05 server time
LOG_LEVEL=info
```
`client/.env.example`
```
VITE_API_BASE=/api
```
`config/env.js` validates env with zod at startup and exits with a clear message if invalid.

## 4. Root scripts (package.json)
```
"dev":          "concurrently -n api,web -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
"dev:server":   "npm run dev -w server",
"dev:client":   "npm run dev -w client",
"build":        "npm run build -w client",
"start":        "npm run start -w server",
"test":         "npm test -w server && npm test -w client",
"lint":         "eslint .",
"seed":         "npm run seed -w server"
```
Server scripts: `dev` = `node --watch src/server.js`, `start` = `node src/server.js`, `test` = `vitest run`, `seed` = `node src/scripts/seed.js`.

## 5. Dev and production serving
- Dev: Vite on 5173 with `server.proxy: { '/api': 'http://localhost:5001' }`. Cookies work because the browser sees one origin.
- Production: when `NODE_ENV=production`, `app.js` serves `client/dist` with `express.static` and falls back to `index.html` for non-`/api` GET routes. Run with `npm run build && npm start`. For hosting, any Node host works (Render, Railway, a VPS with pm2) with `MONGODB_URI` pointing to Atlas. Do not add container files.

## 6. Security middleware order (app.js)
`pino-http` → `helmet` → `cors({ origin: CLIENT_ORIGIN, credentials: true })` → `express.json({ limit: '100kb' })` → `cookieParser` → `/api` routes (auth routes get `rateLimit`) → `notFound` → `errorHandler`.

## 7. Key design decisions
1. **Integer minor units** for money avoid floating-point drift in `$sum`.
2. **Denormalized `type` on Transaction** (validated equal to its category's type) keeps aggregation `$match` stages index-friendly.
3. **No multi-doc transactions**; idempotency via unique partial indexes (recurring) and import batches (undo).
4. **Time-zone aware months** using each user's IANA timezone.
5. **Services accept `now`** for deterministic tests (forecast, recurring, budgets).
6. **Budget evaluation is triggered by writes** (create/update/delete/import/recurring) through `budgetService.evaluate(userId, categoryId, date)`; notifications are deduped by a unique index.
7. **Cron runs in the API process**; the same `processDueRules(now)` function is exposed through `POST /api/recurring/process` so it is testable and manually triggerable.
