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
          include: { author: { select: { id: true, name: true, avatarMimeType: true } }, attachments: true }
        });

        const msg = { ...message, author: message.author ? { ...message.author, hasAvatar: !!message.author.avatarMimeType, avatarMimeType: undefined } : message.author };

        await prisma.conversationParticipant.updateMany({
          where: { conversationId: convId },
          data: { lastMessageAt: new Date() }
        });

        io.to('conv:' + convId).emit('messageCreated', msg);
        if (ack) ack({ ok: true, message: msg });
      } catch (e) {
        console.error(e);
        if (ack) ack({ error: 'Server error' });
      }
    });

    // Смена темы — рассылаем всем в комнате
    socket.on('themeChange', async ({ conversationId, themeName, num }) => {
      const convId = Number(conversationId);
      if (!(await checkAccess(convId, socket.userId))) return;

      io.to('conv:' + convId).emit('themeChanged', {
        themeName,
        num,
        changedBy: socket.userId
      });
    });
  });
}

async function checkAccess(convId, userId) {
  const p = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId, conversationId: convId } }
  });
  return !!p;
}
