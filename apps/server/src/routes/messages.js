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
        author: { select: { id: true, name: true, avatarMimeType: true } },
        attachments: { select: { id: true, mimeType: true, fileName: true, size: true } }
      }
    });

    const items = messages.reverse().map(m => ({
      ...m,
      author: m.author ? { ...m.author, hasAvatar: !!m.author.avatarMimeType, avatarMimeType: undefined } : m.author
    }));

    res.json({
      items,
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
        author: { select: { id: true, name: true, avatarMimeType: true } },
        attachments: { select: { id: true, mimeType: true, fileName: true, size: true } }
      }
    });

    const msg = { ...message, author: message.author ? { ...message.author, hasAvatar: !!message.author.avatarMimeType, avatarMimeType: undefined } : message.author };

    await prisma.conversationParticipant.updateMany({
      where: { conversationId: convId },
      data: { lastMessageAt: new Date() }
    });

    try { const io = getIO(); if (io) io.to('conv:' + convId).emit('messageCreated', msg); } catch (e) {}

    res.status(201).json(msg);
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