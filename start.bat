@echo off
chcp 65001 >nul
echo Creating setup.ps1 from this file tail...
powershell -NoProfile -Command "Get-Content '%~f0' -Encoding UTF8 | Select-Object -Skip 11 | Set-Content 'setup.ps1' -Encoding UTF8"
echo Running setup.ps1...
powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1
del setup.ps1
echo Done! Now run: npm install
pause
exit /b
REM === POWERSHELL START ===
$ErrorActionPreference = 'Stop'

function Write-ProjectFile {
    param([string]$Path, [string]$Content)
    $full = Join-Path $PSScriptRoot $Path
    $dir = Split-Path $full -Parent
    if ($dir -and !(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
    Write-Host "Created: $Path" -ForegroundColor Green
}

# Root package.json
Write-ProjectFile 'package.json' @'
{
  "name": "messenger-mvp",
  "private": true,
  "workspaces": ["apps/*"]
}
'@

# .env.example
Write-ProjectFile '.env.example' @'
DATABASE_URL="postgresql://user:password@localhost:5432/messenger"
JWT_SECRET="dev-secret-change-me"
CORS_ORIGIN="http://localhost:5173,http://localhost:4173"
PORT=3001
VITE_API_URL="http://localhost:3001"
VITE_WS_URL="http://localhost:3001"
'@

# README.md
Write-ProjectFile 'README.md' @'
# Messenger MVP

## Локальный запуск

1. Скопируйте `.env.example` в `.env` в корне и в `apps/web/.env`.
2. Запустите локально PostgreSQL (например, через Docker):
   docker run -d --name pg -e POSTGRES_PASSWORD=password -e POSTGRES_USER=user -e POSTGRES_DB=messenger -p 5432:5432 postgres:16
3. Установите зависимости и прогоните миграции:
   npm install
   npx prisma generate
   npx prisma db push
4. Запустите сервер:
   cd apps/server && npm run dev
5. В другом терминале - фронт:
   cd apps/web && npm run dev
'@

# Prisma schema
Write-ProjectFile 'prisma/schema.prisma' @'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int                       @id @default(autoincrement())
  email        String                    @unique
  passwordHash String
  name         String
  createdAt    DateTime                  @default(now())
  messages     Message[]
  participants ConversationParticipant[]
}

model Conversation {
  id           Int                       @id @default(autoincrement())
  createdAt    DateTime                  @default(now())
  participants ConversationParticipant[]
  messages     Message[]
}

model ConversationParticipant {
  id             Int          @id @default(autoincrement())
  userId         Int
  conversationId Int
  lastReadAt     DateTime     @default(now())
  lastMessageAt  DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([userId, conversationId])
  @@index([userId])
  @@index([conversationId])
}

model Message {
  id             Int          @id @default(autoincrement())
  conversationId Int
  authorId       Int
  text           String?
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  author         User         @relation(fields: [authorId], references: [id], onDelete: Cascade)
  attachments    Attachment[]

  @@index([conversationId, createdAt(sort: Desc)])
}

model Attachment {
  id        Int     @id @default(autoincrement())
  messageId Int
  mimeType  String
  fileName  String
  size      Int
  data      Bytes
  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
}
'@

# Server package.json
Write-ProjectFile 'apps/server/package.json' @'
{
  "name": "server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate deploy"
  },
  "prisma": {
    "schema": "../../prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "prisma": "^5.18.0"
  }
}
'@

# Server: db.js
Write-ProjectFile 'apps/server/src/db.js' @'
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
'@

# Server: middleware/auth.js
Write-ProjectFile 'apps/server/src/middleware/auth.js' @'
import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) token = header.slice(7);
  else if (req.query && req.query.token) token = req.query.token;

  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
'@

# Server: routes/auth.js
Write-ProjectFile 'apps/server/src/routes/auth.js' @'
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const sign = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name, passwordHash } });
    res.status(201).json({
      token: sign(user.id),
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      token: sign(user.id),
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true }
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

export default router;
'@

# Server: routes/conversations.js
Write-ProjectFile 'apps/server/src/routes/conversations.js' @'
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const otherId = Number(req.body.userId);
    if (!otherId || otherId === req.userId) return res.status(400).json({ error: 'Invalid userId' });

    const other = await prisma.user.findUnique({ where: { id: otherId } });
    if (!other) return res.status(404).json({ error: 'User not found' });

    const all = await prisma.conversation.findMany({
      where: { participants: { some: { userId: req.userId } } },
      include: { participants: true }
    });
    const match = all.find(c =>
      c.participants.length === 2 &&
      c.participants.every(p => [req.userId, otherId].includes(p.userId))
    );

    if (match) {
      const full = await prisma.conversation.findUnique({
        where: { id: match.id },
        include: { participants: { include: { user: true } }, messages: { take: 1, orderBy: { createdAt: 'desc' } } }
      });
      return res.json(formatConversation(full, req.userId));
    }

    const conv = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: req.userId }, { userId: otherId }]
        }
      },
      include: { participants: { include: { user: true } } }
    });
    res.status(201).json(formatConversation(conv, req.userId));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const parts = await prisma.conversationParticipant.findMany({
      where: { userId: req.userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: true } },
            messages: { take: 1, orderBy: { createdAt: 'desc' } }
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });
    res.json(parts.map(p => formatConversation(p.conversation, req.userId)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

function formatConversation(conv, currentUserId) {
  const me = conv.participants.find(p => p.userId === currentUserId);
  const other = conv.participants.find(p => p.userId !== currentUserId);
  const lastMessage = conv.messages && conv.messages[0];
  return {
    id: conv.id,
    createdAt: conv.createdAt,
    other: other ? { id: other.user.id, name: other.user.name, email: other.user.email } : null,
    lastMessage: lastMessage
      ? { text: lastMessage.text, createdAt: lastMessage.createdAt, authorId: lastMessage.authorId }
      : null,
    lastReadAt: me ? me.lastReadAt : null,
    lastMessageAt: me ? me.lastMessageAt : null
  };
}

export default router;
'@

# Server: routes/messages.js
Write-ProjectFile 'apps/server/src/routes/messages.js' @'
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { getIO } from '../socket.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const convId = Number(req.params.id);
    if (!(await checkAccess(convId, req.userId))) return res.status(404).json({ error: 'Not found' });

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: convId,
        ...(cursor ? { id: { lt: cursor } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, name: true } },
        attachments: { select: { id: true, mimeType: true, fileName: true, size: true } }
      }
    });

    res.json({
      items: messages.reverse(),
      nextCursor: messages.length ? messages[messages.length - 1].id : null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/messages', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    if (!(await checkAccess(convId, req.userId))) return res.status(404).json({ error: 'Not found' });

    const text = req.body.text ? String(req.body.text).trim() : null;
    const file = req.file;
    if (!text && !file) return res.status(400).json({ error: 'Empty message' });

    const data = {
      conversationId: convId,
      authorId: req.userId,
      text: text
    };
    if (file) {
      data.attachments = {
        create: {
          mimeType: file.mimetype,
          fileName: file.originalname,
          size: file.size,
          data: file.buffer
        }
      };
    }

    const message = await prisma.message.create({
      data: data,
      include: {
        author: { select: { id: true, name: true } },
        attachments: { select: { id: true, mimeType: true, fileName: true, size: true } }
      }
    });

    await prisma.conversationParticipant.updateMany({
      where: { conversationId: convId },
      data: { lastMessageAt: new Date() }
    });

    try { const io = getIO(); if (io) io.to('conv:' + convId).emit('messageCreated', message); } catch (e) {}

    res.status(201).json(message);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const convId = Number(req.params.id);
    if (!(await checkAccess(convId, req.userId))) return res.status(404).json({ error: 'Not found' });

    await prisma.conversationParticipant.updateMany({
      where: { conversationId: convId, userId: req.userId },
      data: { lastReadAt: new Date() }
    });

    try {
      const io = getIO();
      if (io) io.to('conv:' + convId).emit('messageRead', { conversationId: convId, userId: req.userId });
    } catch (e) {}
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

async function checkAccess(convId, userId) {
  const p = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId, conversationId: convId } }
  });
  return !!p;
}

export default router;
'@

# Server: routes/attachments.js
Write-ProjectFile 'apps/server/src/routes/attachments.js' @'
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const att = await prisma.attachment.findUnique({
      where: { id },
      include: { message: { select: { conversationId: true } } }
    });
    if (!att) return res.status(404).end();

    const part = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: req.userId, conversationId: att.message.conversationId } }
    });
    if (!part) return res.status(403).end();

    res.set('Content-Type', att.mimeType);
    res.set('Content-Length', String(att.size));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(att.data);
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

export default router;
'@

# Server: socket.js
Write-ProjectFile 'apps/server/src/socket.js' @'
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

let ioRef = null;
export function getIO() { return ioRef; }

export function setupSocket(io) {
  ioRef = io;

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake.headers.authorization || '').replace('Bearer ', '');
    if (!token) return next(new Error('Auth required'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinConversation', async (conversationId) => {
      if (await checkAccess(Number(conversationId), socket.userId)) {
        socket.join('conv:' + conversationId);
      }
    });

    socket.on('sendMessage', async (payload, ack) => {
      try {
        const convId = Number(payload && payload.conversationId);
        if (!(await checkAccess(convId, socket.userId))) return ack && ack({ error: 'No access' });

        const text = String((payload && payload.text) || '').trim();
        if (!text) return ack && ack({ error: 'Empty' });

        const message = await prisma.message.create({
          data: { conversationId: convId, authorId: socket.userId, text: text },
          include: { author: { select: { id: true, name: true } }, attachments: true }
        });

        await prisma.conversationParticipant.updateMany({
          where: { conversationId: convId },
          data: { lastMessageAt: new Date() }
        });

        io.to('conv:' + convId).emit('messageCreated', message);
        if (ack) ack({ ok: true, message: message });
      } catch (e) {
        console.error(e);
        if (ack) ack({ error: 'Server error' });
      }
    });
  });
}

async function checkAccess(convId, userId) {
  const p = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId, conversationId: convId } }
  });
  return !!p;
}
'@

# Server: index.js
Write-ProjectFile 'apps/server/src/index.js' @'
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import attachmentsRoutes from './routes/attachments.js';
import { authMiddleware } from './middleware/auth.js';
import { setupSocket } from './socket.js';
import { prisma } from './db.js';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const io = new Server(httpServer, { cors: corsOptions });

app.use('/auth', authRoutes);
app.use('/conversations', authMiddleware, conversationsRoutes);
app.use('/conversations', authMiddleware, messagesRoutes);
app.use('/attachments', authMiddleware, attachmentsRoutes);

app.get('/me', authMiddleware, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, name: true } });
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json(u);
});

app.get('/health', (_req, res) => res.json({ ok: true }));

setupSocket(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log('API listening on :' + PORT));
'@

# Web package.json
Write-ProjectFile 'apps/web/package.json' @'
{
  "name": "web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
'@

# Web vite.config.js
Write-ProjectFile 'apps/web/vite.config.js' @'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 }
});
'@

# Web index.html
Write-ProjectFile 'apps/web/index.html' @'
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Messenger MVP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
'@

# Web .env.example
Write-ProjectFile 'apps/web/.env.example' @'
VITE_API_URL="http://localhost:3001"
VITE_WS_URL="http://localhost:3001"
'@

# Web main.jsx
Write-ProjectFile 'apps/web/src/main.jsx' @'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
'@

# Web api.js
Write-ProjectFile 'apps/web/src/api.js' @'
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const getToken = () => localStorage.getItem('token');

async function request(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API_URL + path, Object.assign({}, options, { headers: headers }));
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) throw new Error((data && data.error) || res.statusText);
  return data;
}

export const api = {
  register: (d) => request('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login:    (d) => request('/auth/login',    { method: 'POST', body: JSON.stringify(d) }),
  me:       () => request('/me'),
  listConversations: () => request('/conversations'),
  openConversation: (userId) =>
    request('/conversations', { method: 'POST', body: JSON.stringify({ userId: Number(userId) }) }),
  getMessages: (convId, opts) => {
    opts = opts || {};
    const limit = opts.limit || 50;
    const cursor = opts.cursor;
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set('cursor', String(cursor));
    return request('/conversations/' + convId + '/messages?' + q.toString());
  },
  sendMessage: (convId, payload) => {
    payload = payload || {};
    const fd = new FormData();
    if (payload.text) fd.append('text', payload.text);
    if (payload.image) fd.append('image', payload.image);
    return request('/conversations/' + convId + '/messages', { method: 'POST', body: fd });
  },
  markRead: (convId) => request('/conversations/' + convId + '/read', { method: 'POST' }),
  attachmentUrl: (id) => API_URL + '/attachments/' + id + '?token=' + encodeURIComponent(getToken() || '')
};
'@

# Web socket.js
Write-ProjectFile 'apps/web/src/socket.js' @'
import { io } from 'socket.io-client';

const WS_URL = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io(WS_URL, {
      auth: { token: token },
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
'@

# Web App.jsx
Write-ProjectFile 'apps/web/src/App.jsx' @'
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ChatList from './pages/ChatList.jsx';
import ChatView from './pages/ChatView.jsx';

function Private({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Private><ChatList /></Private>} />
      <Route path="/chat/:id" element={<Private><ChatView /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
'@

# Web Login.jsx
Write-ProjectFile 'apps/web/src/pages/Login.jsx' @'
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const data = await api.login({ email: email, password: password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      nav('/');
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="auth">
      <h2>Вход</h2>
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        {err && <div className="err">{err}</div>}
        <button type="submit">Войти</button>
      </form>
      <Link to="/register">Нет аккаунта? Регистрация</Link>
    </div>
  );
}
'@

# Web Register.jsx
Write-ProjectFile 'apps/web/src/pages/Register.jsx' @'
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const data = await api.register({ name: name, email: email, password: password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      nav('/');
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="auth">
      <h2>Регистрация</h2>
      <form onSubmit={submit}>
        <input placeholder="Имя" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input placeholder="Пароль (>=6)" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        {err && <div className="err">{err}</div>}
        <button type="submit">Создать аккаунт</button>
      </form>
      <Link to="/login">Уже есть аккаунт? Войти</Link>
    </div>
  );
}
'@

# Web ChatList.jsx
Write-ProjectFile 'apps/web/src/pages/ChatList.jsx' @'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function ChatList() {
  const [list, setList] = useState([]);
  const [userId, setUserId] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const me = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { load(); }, []);

  async function load() {
    try { setList(await api.listConversations()); } catch (e) {}
  }

  async function open(e) {
    e.preventDefault();
    setErr('');
    try {
      const conv = await api.openConversation(userId);
      nav('/chat/' + conv.id);
    } catch (e) { setErr(e.message); }
  }

  function logout() {
    localStorage.clear();
    nav('/login');
  }

  return (
    <div className="container">
      <header>
        <h2>Привет, {me.name}</h2>
        <button onClick={logout}>Выйти</button>
      </header>

      <form onSubmit={open} className="new-chat">
        <input
          placeholder="ID пользователя"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          required
        />
        <button type="submit">Начать чат</button>
      </form>
      {err && <div className="err">{err}</div>}

      <ul className="conv-list">
        {list.map(c => (
          <li key={c.id} onClick={() => nav('/chat/' + c.id)} className="conv-item">
            <div className="name">{(c.other && c.other.name) || 'Unknown'} <span className="muted">#{(c.other && c.other.id)}</span></div>
            <div className="last">{(c.lastMessage && c.lastMessage.text) || '(нет сообщений)'}</div>
          </li>
        ))}
        {list.length === 0 && <li className="empty">Нет диалогов - введите ID выше</li>}
      </ul>
    </div>
  );
}
'@

# Web ChatView.jsx
Write-ProjectFile 'apps/web/src/pages/ChatView.jsx' @'
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { getSocket } from '../socket.js';

export default function ChatView() {
  const { id } = useParams();
  const convId = Number(id);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const nav = useNavigate();
  const me = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const sock = getSocket();
    sock.emit('joinConversation', convId);

    const onMsg = (msg) => {
      if (msg.conversationId !== convId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return prev.concat([msg]);
      });
    };
    sock.on('messageCreated', onMsg);

    load();
    api.markRead(convId).catch(() => {});

    return () => { sock.off('messageCreated', onMsg); };
  }, [convId]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function load() {
    try {
      const data = await api.getMessages(convId);
      setMessages(data.items);
      const list = await api.listConversations();
      setConv(list.find(x => x.id === convId));
    } catch (e) {}
    setLoading(false);
  }

  async function send(e) {
    if (e) e.preventDefault();
    if (!text.trim() && !file) return;
    try {
      const msg = await api.sendMessage(convId, { text: text.trim(), image: file });
      setMessages(prev => prev.filter(m => m.id !== msg.id).concat([msg]));
      setText(''); setFile(null);
    } catch (e) {}
  }

  if (loading) return <div className="container">Загрузка...</div>;

  return (
    <div className="chat">
      <header className="chat-header">
        <Link to="/">Назад</Link>
        <h3>{(conv && conv.other && conv.other.name) || ('Чат #' + convId)}</h3>
      </header>

      <div className="messages">
        {messages.map(m => (
          <div key={m.id} className={'msg ' + (m.authorId === me.id ? 'mine' : '')}>
            <div className="author">{m.author && m.author.name}</div>
            {m.text && <div className="text">{m.text}</div>}
            {m.attachments && m.attachments.map(a => (
              <a key={a.id} href={api.attachmentUrl(a.id)} target="_blank" rel="noreferrer">
                <img src={api.attachmentUrl(a.id)} alt={a.fileName} />
              </a>
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="composer">
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Сообщение..."
        />
        <button type="submit">Отправить</button>
      </form>
    </div>
  );
}
'@

# Web index.css
Write-ProjectFile 'apps/web/src/index.css' @'
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f5f7fb; color: #222; }
a { color: #4f46e5; text-decoration: none; }

.auth { max-width: 360px; margin: 80px auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
.auth h2 { margin-top: 0; }
.auth input { display: block; width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
.auth button { width: 100%; padding: 10px; background: #4f46e5; color: #fff; border: 0; border-radius: 8px; cursor: pointer; font-size: 15px; }
.auth a { display: block; text-align: center; margin-top: 12px; font-size: 14px; }
.err { color: #c00; margin: 8px 0; font-size: 14px; }

.container { max-width: 720px; margin: 0 auto; padding: 20px; }
header { display: flex; justify-content: space-between; align-items: center; }
header button { padding: 8px 14px; background: #eee; border: 0; border-radius: 8px; cursor: pointer; }

.new-chat { display: flex; gap: 8px; margin: 16px 0; }
.new-chat input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 8px; }
.new-chat button { padding: 8px 14px; background: #4f46e5; color: #fff; border: 0; border-radius: 8px; cursor: pointer; }
.muted { color: #888; font-size: 12px; }

.conv-list { list-style: none; padding: 0; margin: 0; }
.conv-item { background: #fff; padding: 12px; margin-bottom: 8px; border-radius: 8px; cursor: pointer; }
.conv-item:hover { background: #eef; }
.conv-item .name { font-weight: 600; }
.conv-item .last { color: #666; font-size: 14px; margin-top: 4px; }
.empty { color: #888; padding: 16px; text-align: center; }

.chat { display: flex; flex-direction: column; height: 100vh; max-width: 720px; margin: 0 auto; }
.chat-header { padding: 12px; background: #fff; border-bottom: 1px solid #eee; display: flex; gap: 12px; align-items: center; }
.chat-header h3 { margin: 0; }
.messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 70%; padding: 8px 12px; border-radius: 12px; background: #e5e7eb; align-self: flex-start; word-wrap: break-word; }
.msg.mine { background: #4f46e5; color: #fff; align-self: flex-end; }
.msg .author { font-size: 12px; opacity: 0.7; margin-bottom: 2px; }
.msg .text { white-space: pre-wrap; }
.msg img { max-width: 240px; border-radius: 8px; display: block; margin-top: 4px; }

.composer { display: flex; gap: 8px; padding: 12px; background: #fff; border-top: 1px solid #eee; align-items: center; }
.composer input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
.composer button { padding: 10px 14px; background: #4f46e5; color: #fff; border: 0; border-radius: 8px; cursor: pointer; }
'@

Write-Host ""
Write-Host "All files created successfully!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy .env.example to .env and apps/web/.env"
Write-Host "  2. npm install"
Write-Host "  3. npx prisma generate"
Write-Host "  4. npx prisma db push"
Write-Host "  5. cd apps/server && npm run dev"
Write-Host "  6. cd apps/web && npm run dev"