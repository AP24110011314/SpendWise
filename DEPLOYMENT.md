# SpendWise — Production Deployment Guide (Vercel & Render)

This guide walks you through deploying **SpendWise** to production using:
- **Render**: Node.js / Express Backend API
- **Vercel**: React / Vite Frontend Application
- **MongoDB Atlas**: Managed Cloud Database (Free M0 Cluster)

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │              User Browser               │
                      └─────────────┬───────────────────────────┘
                                    │
                                    │ HTTPS API Calls (Bearer Token + Cookies)
                                    ▼
┌───────────────────────────┐             ┌───────────────────────────┐
│          Vercel           │             │          Render           │
│   (React / Vite Client)   │             │   (Express / Node API)    │
│  spendwise.vercel.app     │             │  spendwise-api.onrender.com│
└───────────────────────────┘             └─────────────┬─────────────┘
                                                        │
                                                        │ Mongoose connection
                                                        ▼
                                          ┌───────────────────────────┐
                                          │       MongoDB Atlas       │
                                          │     (Managed Database)    │
                                          └───────────────────────────┘
```

---

## Step 1: Create a Free MongoDB Database (MongoDB Atlas)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in or create a free account.
2. Click **Create Deployment** and select the **M0 Free Tier** (AWS or Google Cloud, choose a region close to your users).
3. **Database Access (User Credentials)**:
   - Create a database user (e.g., username: `spendwise_user`, and create a strong password).
   - *Save this password securely.*
4. **Network Access (IP Whitelist)**:
   - Go to **Network Access** > **Add IP Address**.
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`) so that Render's cloud servers can connect to your database.
5. **Get Connection String**:
   - Go to **Database** > **Connect** > **Drivers** (Node.js).
   - Copy your connection string. It will look like:
     ```
     mongodb+srv://spendwise_user:<password>@cluster0.xxxxx.mongodb.net/spendwise?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual database user password.

---

## Step 2: Deploy Backend on Render

1. Sign in to [Render](https://render.com/).
2. On your Render dashboard, click **New +** > **Web Service**.
3. Connect your GitHub repository (`SpendWise`).
4. Configure the service settings:
   - **Name**: `spendwise-api` (or any name you prefer)
   - **Region**: Choose a region near your database (e.g., Oregon or Frankfurt)
   - **Branch**: `main` (or your active branch)
   - **Root Directory**: *(leave blank to use repository root)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start -w server`
   - **Plan**: `Free`
5. **Add Environment Variables**:
   Under **Environment Variables**, add the following key-value pairs:

   | Key | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizations and secure cookies |
   | `PORT` | `10000` | Render default port |
   | `MONGODB_URI` | `mongodb+srv://.../spendwise?retryWrites=true&w=majority` | Your MongoDB Atlas connection string from Step 1 |
   | `JWT_SECRET` | *32+ random characters string* | e.g. `c94a5e31766bb4f15d90ec34a5d8b72e12f0` |
   | `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
   | `CLIENT_ORIGIN` | `https://*.vercel.app,http://localhost:5173` | Allowed origins (you will update this with your exact Vercel URL in Step 4) |
   | `COOKIE_NAME` | `sw_token` | Auth cookie name |
   | `ENABLE_CRON` | `true` | Runs daily recurring transaction processing |
   | `LOG_LEVEL` | `info` | Production log level |

6. Click **Create Web Service**.
7. Wait 2–3 minutes for the build and deployment to finish.
8. Once deployed, note down your Render service URL:
   `https://spendwise-api.onrender.com`
9. **Test Backend**: Open `https://spendwise-api.onrender.com/health` in your browser. You should see:
   ```json
   {"status":"ok","service":"SpendWise API"}
   ```

*(Optional: To seed demo data on your Render database, go to the Render dashboard > your Web Service > **Shell**, and run: `npm run seed -w server`)*

---

## Step 3: Deploy Frontend on Vercel

1. Go to [Vercel](https://vercel.com/) and sign in with your GitHub account.
2. Click **Add New...** > **Project**.
3. Import your `SpendWise` repository.
4. In the **Configure Project** screen:
   - **Project Name**: `spendwise` (or custom name)
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `client` (or leave as root `./`, both work seamlessly due to `vercel.json`!)
   - **Build and Output Settings**:
     - *If Root Directory is `client`:*
       - Build Command: `npm run build`
       - Output Directory: `dist`
     - *If Root Directory is root `./`:*
       - Build Command: `npm run build -w client`
       - Output Directory: `client/dist`
5. **Environment Variables**:
   Add the following environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://spendwise-api.onrender.com/api` |

   *(Note: Replace `spendwise-api.onrender.com` with your actual Render URL from Step 2, and ensure it ends with `/api`)*

6. Click **Deploy**.
7. In about 1 minute, your site will be live! Note your Vercel deployment URL (e.g., `https://spendwise.vercel.app`).

---

## Step 4: Final Connection (CORS Setup)

Now that you have your live Vercel URL, update the backend so it accepts requests from your production frontend:

1. Return to [Render](https://dashboard.render.com).
2. Open your `spendwise-api` service > **Environment**.
3. Update `CLIENT_ORIGIN` with your exact Vercel URL:
   ```
   CLIENT_ORIGIN=https://spendwise.vercel.app
   ```
   *(If you also want to test preview PR deployments or localhost, you can enter comma-separated values: `https://spendwise.vercel.app,https://*.vercel.app,http://localhost:5173`)*
4. Click **Save Changes**. Render will automatically redeploy in 30 seconds with the updated CORS rule.

---

## Step 5: Verification Checklist

- [ ] Open your live Vercel URL (e.g. `https://spendwise.vercel.app`).
- [ ] Try creating a new account via the **Register** page or sign in with demo credentials if seeded (`demo@spendwise.app` / `Sw!Demo-7rK2#vQ9xLm`).
- [ ] Test creating a transaction and a budget.
- [ ] Refresh the page on an inner route like `/transactions` or `/budgets` to verify that `vercel.json` SPA rewrite works properly.
- [ ] Toggle dark and light mode to ensure all styling displays correctly.

---

## Common Questions & Troubleshooting

### 1. Requests fail with CORS error in browser console
- Make sure `CLIENT_ORIGIN` in Render exactly matches your Vercel URL without trailing slashes (e.g. `https://spendwise.vercel.app`).
- Verify that `VITE_API_URL` in Vercel includes `https://` and ends with `/api` (e.g. `https://spendwise-api.onrender.com/api`).

### 2. Render free tier cold starts
- Render's free tier spins down web services after 15 minutes of inactivity. When a new request arrives, it may take 30–50 seconds to wake up. This is expected on the free tier.

### 3. Page reloads give 404 on Vercel
- Both `vercel.json` at root and `client/vercel.json` contain the rewrite rule `{ "source": "/(.*)", "destination": "/index.html" }` to ensure all client-side routes route directly to `index.html`.
