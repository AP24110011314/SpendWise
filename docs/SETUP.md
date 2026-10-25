# Setup (no Docker)

## Prerequisites
- Node.js 20 or newer and npm 10+
- MongoDB — pick **one**:
  - **Option A: MongoDB Atlas (free M0 cluster)** — easiest. Create a cluster, a database user, allow your IP, copy the connection string.
  - **Option B: MongoDB Community Server installed natively** — install from mongodb.com (Windows installer runs as a service; macOS `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`; Ubuntu via the official apt repo then `sudo systemctl start mongod`). Default URI: `mongodb://127.0.0.1:27017/spendwise`.

## First run
```bash
npm install                      # installs both workspaces
cp server/.env.example server/.env
cp client/.env.example client/.env
# edit server/.env: set MONGODB_URI and a long random JWT_SECRET
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run seed                     # demo user: demo@spendwise.app / Demo@1234
npm run dev                      # API http://localhost:5000, web http://localhost:5173
```

## Everyday commands
| Command | Purpose |
|---|---|
| `npm run dev` | API + client with hot reload |
| `npm test` | all tests (uses mongodb-memory-server, no external DB needed) |
| `npm run lint` | ESLint |
| `npm run seed` | recreate demo data (idempotent: removes and recreates the demo user's data) |
| `npm run build` | build client to `client/dist` |
| `npm start` | production mode: Express serves API and the built client on `PORT` |

## Production without containers
1. Set `NODE_ENV=production`, `MONGODB_URI` (Atlas), strong `JWT_SECRET`, `CLIENT_ORIGIN` (your site URL, or same origin).
2. `npm ci && npm run build && npm start`.
3. Hosting: Render, Railway, or a plain VPS with `pm2 start server/src/server.js --name spendwise` behind nginx. Health check path: `/api/health`.

## Troubleshooting
- `MongooseServerSelectionError`: MongoDB isn't running or the URI/IP allow-list is wrong.
- Cookie not set in dev: use the Vite URL (`localhost:5173`) so requests go through the proxy; don't call `:5000` directly from the browser.
- `mongodb-memory-server` first run downloads a mongod binary (needs internet once); it is cached afterwards.
- Port in use: change `PORT` in `server/.env` and the Vite proxy target.
