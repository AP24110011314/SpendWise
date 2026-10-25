# SpendWise

A personal finance tracker built with the MERN stack.

## Features

- **Transactions**: Track income and expenses with categories, notes, and dates
- **Categories**: Customizable income/expense categories with colors and icons
- **Budgets**: Set monthly budgets per category with alerts at configurable thresholds
- **Recurring Transactions**: Daily, weekly, monthly, yearly rules with automatic generation
- **Analytics**: Dashboard with charts for spending breakdown, trends, budget progress, and daily cumulative spend
- **Month Comparison**: Compare any two months side by side
- **Forecast**: Month-end spending projection based on current trends and history
- **CSV Import/Export**: Import bank statements with duplicate detection, export filtered data
- **Notifications**: In-app alerts when budgets are exceeded

## Tech Stack

- **Backend**: Node.js 20+, Express 4, Mongoose 8, MongoDB
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, TanStack Query, React Router 6
- **Testing**: Vitest, Supertest, React Testing Library, mongodb-memory-server
- **No Docker required** — runs with Node.js and MongoDB only

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment files
cp server/.env.example server/.env
cp client/.env.example client/.env

# Edit server/.env with your MongoDB URI and JWT secret
# Generate a secure JWT secret:
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Seed demo data (demo@spendwise.app / Demo@1234)
npm run seed

# Start development servers (API on :5000, client on :5173)
npm run dev
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API and client with hot reload |
| `npm run dev:server` | Start only the API server |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run build` | Build client for production |
| `npm start` | Run production server (serves API + built client) |
| `npm test` | Run all tests |
| `npm run lint` | Run ESLint |
| `npm run seed` | Create demo user with 6 months of sample data |

## Environment Variables

### Server (`server/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | API port | `5000` |
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

## Production Deployment

```bash
# Set production environment variables
export NODE_ENV=production
export MONGODB_URI="your-atlas-uri"
export JWT_SECRET="your-secure-secret"
export CLIENT_ORIGIN="https://yourdomain.com"

# Build and start
npm ci
npm run build
npm start
```

The production server serves both the API and the built React app on the same port.

## Project Structure

```
spendwise/
├── package.json           # Root workspace config
├── server/
│   ├── src/
│   │   ├── config/        # Env, DB, logger
│   │   ├── models/        # Mongoose models
│   │   ├── routes/        # Express routes
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth, validation, errors
│   │   ├── jobs/          # Cron jobs
│   │   ├── utils/         # Helpers
│   │   └── scripts/       # Seed script
│   └── tests/             # Server tests
└── client/
    ├── src/
    │   ├── api/           # Axios + API modules
    │   ├── components/    # Reusable components
    │   ├── context/       # React context
    │   ├── hooks/         # TanStack Query hooks
    │   ├── lib/           # Utilities
    │   └── pages/         # Page components
    └── tests/             # Client tests
```

## License

MIT