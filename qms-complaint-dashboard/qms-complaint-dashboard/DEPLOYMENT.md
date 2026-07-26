# QMS Complaint Dashboard — Hostinger Deployment Guide

## Package contents

| File / Folder               | Purpose                                          |
|-----------------------------|--------------------------------------------------|
| `server.mjs`                | Main server — Express API + serves React UI      |
| `pino-*.mjs`                | Logging worker threads (must stay alongside server.mjs) |
| `thread-stream-worker.mjs`  | Logging stream worker                            |
| `public/`                   | Built React frontend (static files)              |
| `package.json`              | Node project manifest (`npm start` → `node server.mjs`) |
| `migrate.mjs`               | One-time database setup script                   |
| `.env.example`              | Environment variable template                    |

---

## Prerequisites

- Hostinger Business or Cloud hosting plan with **Node.js support**
- A **PostgreSQL** database. Hostinger provides MySQL; for PostgreSQL use a
  free external provider:
  - **[Neon](https://neon.tech)** — recommended, free tier, serverless Postgres
  - **[Supabase](https://supabase.com)** — free tier
  - **[ElephantSQL](https://elephantsql.com)** — free tier (20 MB)

---

## Step-by-step deployment

### 1. Create a Node.js app in hPanel

1. Log in to **hPanel** → select your domain → **Advanced** → **Node.js**.
2. Click **Create Application**.
3. Fill in:
   | Field | Value |
   |-------|-------|
   | Node.js version | **20.x LTS** (or 18.x) |
   | Application mode | **Production** |
   | Application root | e.g. `/home/u123456789/qms` |
   | Application URL | Your domain or subdomain |
   | Application startup file | **`server.mjs`** |
4. Click **Create** and note the application root path.

---

### 2. Set environment variables

Still in the Node.js panel, click **Manage** on your app → **Environment Variables**. Add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your Postgres connection string |
| `SESSION_SECRET` | A 32+ character random string |

Leave `PORT` unset — Hostinger injects it automatically.

To generate SESSION_SECRET, run on any machine:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 3. Upload files

**Via hPanel File Manager:**
1. hPanel → **Files** → **File Manager**.
2. Navigate to your application root folder.
3. Upload `qms-complaint-dashboard.zip`, then right-click → **Extract**.
4. Make sure all files end up directly inside the application root (not in a subfolder).

**Via FTP/SFTP (FileZilla etc.):**
1. Connect using Hostinger FTP credentials.
2. Upload the extracted contents of `qms-complaint-dashboard/` into the application root.

Your application root should look like:
```
/home/u123456789/qms/
├── server.mjs
├── pino-worker.mjs
├── pino-pretty.mjs
├── pino-file.mjs
├── thread-stream-worker.mjs
├── public/
│   ├── index.html
│   └── assets/
├── package.json
├── migrate.mjs
└── .env.example
```

---

### 4. Run database migrations (first time only)

In hPanel → Node.js → your app → **Run JS script**, enter:
```
migrate.mjs
```
and click **Run**.

**Or via SSH:**
```bash
cd /home/u123456789/qms
DATABASE_URL="postgres://..." node migrate.mjs
```

This creates all tables. It is **safe to re-run** — uses `IF NOT EXISTS` throughout.

---

### 5. Start the app

In hPanel → Node.js → click **Restart** (or **Start**).

Open your domain in a browser. The login screen should appear.

**Default login:** username `admin`
You will need to set a password on first login via the admin panel
(User Management → edit admin user).

---

## Updating the app

1. Build a new package from Replit.
2. Upload and overwrite the files in your application root.
3. Run **Restart** in the Hostinger Node.js panel.
4. Run `migrate.mjs` again if there were schema changes.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `DATABASE_URL must be set` | Set DATABASE_URL in environment variables |
| App crashes on startup | Check logs in hPanel → Node.js → Logs; verify all env vars are set |
| 404 on page refresh | Confirm startup file is `server.mjs` (not `index.mjs`) |
| Blank page | Confirm `public/index.html` exists in the application root |
| Login always fails | Run `migrate.mjs` to ensure the users table was created |
| File uploads fail | Set `PRIVATE_OBJECT_DIR` and `PUBLIC_OBJECT_SEARCH_PATHS` to writable paths |
