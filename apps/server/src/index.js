import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import attachmentsRoutes from './routes/attachments.js';
import postsRoutes from './routes/posts.js';
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
app.use('/posts', authMiddleware, postsRoutes);

app.get('/me', authMiddleware, async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, avatarMimeType: true }
  });
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ ...u, hasAvatar: !!u.avatarMimeType, avatarMimeType: undefined });
});

app.get('/users', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: req.userId } },
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true, avatarMimeType: true },
    take: 10,
  });
  res.json(users.map(u => ({ ...u, hasAvatar: !!u.avatarMimeType, avatarMimeType: undefined })));
});

app.get('/users/:id/avatar', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: { avatar: true, avatarMimeType: true }
    });
    if (!user || !user.avatar) return res.status(404).end();
    res.set('Content-Type', user.avatarMimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(user.avatar);
  } catch (e) {
    res.status(500).end();
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

setupSocket(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log('API listening on :' + PORT));