# SpendWise

A personal finance tracker built with the MERN stack.

## Features

- **Transactions** — Track income and expenses with categories, notes, and dates
- **Categories** — Customizable income/expense categories with colors and icons
- **Budgets** — Set monthly budgets per category with alerts at configurable thresholds
- **Recurring Transactions** — Daily, weekly, monthly, yearly rules with automatic generation
- **Analytics** — Dashboard with charts for spending breakdown, trends, budget progress, and daily cumulative spend
- **Month Comparison** — Compare any two months side by side
- **Forecast** — Month-end spending projection based on current trends and history
- **CSV Import/Export** — Import bank statements with duplicate detection, export filtered data
- **Notifications** — In-app alerts when budgets are exceeded

## Tech Stack

- **Backend**: Node.js 20+, Express 4, Mongoose 8, MongoDB
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, TanStack Query, React Router 6
- **Testing**: Vitest, Supertest, React Testing Library, mongodb-memory-server
- **No Docker required** — runs with Node.js and a local MongoDB instance

---

## Prerequisites

Before you start, make sure you have the following installed:

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| MongoDB | 6+ | `mongod --version` |

> **macOS users**: Install MongoDB via Homebrew — `brew install mongodb-community` then `brew services start mongodb-community`.

---

## Getting Started

Follow these steps in order from the project root (`SpendWise/`):

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Set up environment files

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Step 3 — Configure the server environment

Open `server/.env` and update at minimum:

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/spendwise
JWT_SECRET=<paste-a-secure-random-string-here>
```

To generate a secure JWT secret, run:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> JWT_SECRET must be at least 32 characters or the server will refuse to start.

### Step 4 — Start MongoDB

Make sure MongoDB is running **before** starting the app:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Manual (any platform)
mongod --dbpath /data/db
```

### Step 5 — Seed demo data (optional but recommended)

```bash
npm run seed
```

This creates a demo account with 6 months of sample transactions:

| Field | Value |
|-------|-------|
| Email | `demo@spendwise.app` |
| Password | `Sw!Demo-7rK2#vQ9xLm` |

### Step 6 — Start the development servers

```bash
npm run dev
```

This starts both servers concurrently:

| Server | URL |
|--------|-----|
| API (Express) | http://localhost:5001 |
| Client (Vite) | http://localhost:5173 |

Open **http://localhost:5173** in your browser.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + client with hot reload |
| `npm run dev:server` | Start only the API server |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run build` | Build client for production |
| `npm start` | Run production server (serves API + built client) |
| `npm test` | Run all tests |
| `npm run lint` | Run ESLint |
| `npm run seed` | Create demo user with 6 months of sample data |

---

## Environment Variables

### Server (`server/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | API port | `5001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/spendwise` |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | **Required** |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `CLIENT_ORIGIN` | Frontend URL for CORS | `http://localhost:5173` |
| `COOKIE_NAME` | Auth cookie name | `sw_token` |
| `ENABLE_CRON` | Enable recurring transaction cron | `true` |
| `RECURRING_CRON` | Cron schedule (cron format) | `5 0 * * *` |
| `LOG_LEVEL` | Pino log level | `info` |

### Client (`client/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE` | API base path | `/api` |

---

## Production Deployment

```bash
export NODE_ENV=production
export MONGODB_URI="your-atlas-uri"
export JWT_SECRET="your-secure-secret"
export CLIENT_ORIGIN="https://yourdomain.com"

npm ci
npm run build
npm start
```

The production server serves both the API and the built React app on a single port.

---

## Troubleshooting

### `ECONNREFUSED` — API proxy errors in the browser

The Vite dev server proxies `/api/*` requests to the Express API on port **5001**. If you see proxy errors:

1. Confirm the API server is running: `npm run dev:server`
2. Confirm MongoDB is running (see Step 4 above)
3. Verify `server/.env` has `PORT=5001`
4. Verify `client/vite.config.js` proxy target is `http://localhost:5001`

A few proxy errors on startup are normal — they stop once Express finishes booting.

### `Failed to start server` — server crashes immediately

- `JWT_SECRET` must be at least 32 characters
- `MONGODB_URI` must point to a running MongoDB instance
- Run `npm run dev:server` alone for the full error output

### MongoDB connection error (port 27017)

MongoDB is not running. Start it first (see Step 4).

### Login redirects back to `/login` immediately

Clear your browser cookies for `localhost` and try logging in again. Also verify `CLIENT_ORIGIN` in `server/.env` matches your frontend URL exactly.

### Cookie not persisting

- `CLIENT_ORIGIN` in `server/.env` must exactly match the frontend URL (e.g., `http://localhost:5173`)
- In development, cookies use `SameSite=Lax`; in production they require `SameSite=None; Secure`

### Chrome "password found in a data breach" warning

Chrome may show a warning that a password has appeared in a public data breach. This is Chrome's built-in password check feature and **not an application error**. The demo password (`Sw!Demo-7rK2#vQ9xLm`) is unique and not on any known breach list, but if you use a weak password for your own account, Chrome will flag it. Do not attempt to suppress this warning in code — it is a browser security feature.

---

## Project Structure

```
spendwise/
├── package.json            # Root workspace config
├── server/
│   ├── .env.example        # Server environment template
│   └── src/
│       ├── config/         # Env, DB, logger setup
│       ├── models/         # Mongoose models
│       ├── routes/         # Express routes
│       ├── controllers/    # Request handlers
│       ├── services/       # Business logic
│       ├── middleware/     # Auth, validation, errors
│       ├── jobs/           # Cron jobs (recurring transactions)
│       ├── utils/          # Helpers
│       └── scripts/        # Seed script
│   └── tests/              # Server integration tests
└── client/
    ├── .env.example        # Client environment template
    └── src/
        ├── api/            # Axios + API modules
        ├── components/     # Reusable UI components
        ├── context/        # React context (auth, etc.)
        ├── hooks/          # TanStack Query hooks
        ├── lib/            # Utilities
        └── pages/          # Page components
    └── tests/              # Client unit tests
```

---

## License

MIT
