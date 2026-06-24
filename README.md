# Messenger MVP

1:1 messenger with real-time chat, image attachments (BYTEA in PostgreSQL), JWT auth.

## Stack

- **Backend:** Node.js + Express + Socket.IO + Prisma ORM
- **Frontend:** React + Vite
- **Database:** PostgreSQL
- **Images:** Stored as BYTEA in PostgreSQL, served via `/api/attachments/:id`

---

## Local Development

### 1. Prerequisites

- Node.js 18+
- PostgreSQL running locally (or via Docker)

### 2. Setup

Messenger uses a separate PostgreSQL schema `messenger` so it can co-exist with other projects in the same database.

```bash
# Copy env files
cp .env.example .env
cp apps/web/.env.example apps/web/.env

# Edit .env — set your DATABASE_URL (the same DB used by other projects)
# DATABASE_URL="postgresql://user:password@host:5432/db"

# Create the messenger schema in your database
# (the messenger.* tables live here, separate from public.* used by other projects)
npx prisma db execute --stdin <<< "CREATE SCHEMA IF NOT EXISTS messenger;"

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to DB (creates tables in messenger schema)
npx prisma db push
# OR create a migration:
# npx prisma migrate dev --name init

# Start both server (port 3001) and frontend (port 5173)
npm run dev
```

> **Note:** The Prisma schema uses `schemas = ["messenger"]` and `@@schema("messenger")` on every model. All tables are created in the `messenger` schema, so they won't conflict with tables in the default `public` schema used by other projects.

### 3. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Secret for signing JWT tokens | — |
| `CORS_ORIGIN` | Comma-separated allowed origins | `http://localhost:5173` |
| `PORT` | Server port | `3001` |
| `VITE_API_URL` | API URL for frontend | `http://localhost:3001` |
| `VITE_WS_URL` | WebSocket URL for frontend | `http://localhost:3001` |

### 4. Test with curl

```bash
# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","name":"Alice","password":"secret123"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"secret123"}'
# => save token from response

# Get current user
curl http://localhost:3001/me \
  -H "Authorization: Bearer <TOKEN>"

# Search users
curl "http://localhost:3001/users?q=bob" \
  -H "Authorization: Bearer <TOKEN>"

# Create conversation
curl -X POST http://localhost:3001/conversations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"userId": 2}'

# List conversations
curl http://localhost:3001/conversations \
  -H "Authorization: Bearer <TOKEN>"

# Get messages
curl "http://localhost:3001/conversations/1/messages?limit=50" \
  -H "Authorization: Bearer <TOKEN>"

# Send message with image
curl -X POST http://localhost:3001/conversations/1/messages \
  -H "Authorization: Bearer <TOKEN>" \
  -F "text=Hello!" \
  -F "image=@photo.jpg"
```

---

## Deploy to Render

### Architecture

| Service | Type | Notes |
|---|---|---|
| **PostgreSQL** | Managed PostgreSQL | Render creates and manages it |
| **API Server** | Web Service | Node.js Express + Socket.IO |
| **Frontend** | Static Site | Built with Vite, served by Render |

### Step-by-step

#### 1. Create PostgreSQL instance

1. In [Render Dashboard](https://dashboard.render.com), click **New + → PostgreSQL**
2. Choose name: `messenger-db`
3. Select instance type (Free tier works for MVP)
4. Click **Create Database**
5. After creation, copy the **Internal Database URL** (looks like `postgresql://user:pass@host:port/db`)

#### 2. Deploy API Server (Web Service)

1. **New + → Web Service**
2. Connect your Git repository (or use **Public Git Repository** with your repo URL)
3. Settings:
   - **Name:** `messenger-api`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate && npx prisma db push`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add environment variables (see below)
5. Click **Create Web Service**

#### Environment Variables for Web Service

| Variable | Value |
|---|---|
| `DATABASE_URL` | Internal Database URL from PostgreSQL step |
| `JWT_SECRET` | Generate a random secret (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | Your frontend URL (e.g., `https://messenger-front.onrender.com`) |
| `PORT` | `10000` (Render sets this automatically; omit or keep) |
| `NODE_VERSION` | `18` |

**Important:** Use the **Internal Database URL** (not the external one) so the Web Service connects within Render's network — faster and free.

#### 3. Deploy Frontend (Static Site)

1. **New + → Static Site**
2. Connect the same repository
3. Settings:
   - **Name:** `messenger-front`
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Add environment variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://messenger-api.onrender.com` |
| `VITE_WS_URL` | `https://messenger-api.onrender.com` |

5. Click **Create Static Site**

### After Deployment

1. Wait for both services to show **Live** status
2. Open the frontend URL (e.g., `https://messenger-front.onrender.com`)
3. Register a user and start chatting

### Troubleshooting

- **CORS errors:** Make sure `CORS_ORIGIN` on the backend contains the exact frontend URL
- **Database connection:** Use the Internal Database URL from the PostgreSQL dashboard
- **Image uploads failing:** Check attachment size is under 10 MB
- **WebSocket not connecting:** Client uses `VITE_WS_URL` — ensure it matches the API URL without trailing slash

---

## Project Structure

```
messenger/
├── apps/
│   ├── server/          # Express + Socket.IO backend
│   │   └── src/
│   │       ├── index.js          # Entry point
│   │       ├── db.js             # Prisma client
│   │       ├── socket.js         # Socket.IO setup
│   │       ├── middleware/
│   │       │   └── auth.js       # JWT middleware
│   │       └── routes/
│   │           ├── auth.js        # Register / Login
│   │           ├── conversations.js
│   │           ├── messages.js    # CRUD + upload
│   │           └── attachments.js # Serve images
│   └── web/             # React + Vite frontend
│       └── src/
│           ├── api.js             # API client
│           ├── socket.js          # Socket.IO client
│           ├── pages/
│           │   ├── Login.jsx
│           │   ├── Register.jsx
│           │   ├── ChatList.jsx
│           │   └── ChatView.jsx
│           └── index.css
├── prisma/
│   └── schema.prisma
├── package.json         # Workspace root
└── README.md
```
