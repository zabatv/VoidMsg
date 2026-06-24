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
    other: other ? { id: other.user.id, name: other.user.name, email: other.user.email, hasAvatar: !!other.user.avatarMimeType } : null,
    lastMessage: lastMessage
      ? { text: lastMessage.text, createdAt: lastMessage.createdAt, authorId: lastMessage.authorId }
      : null,
    lastReadAt: me ? me.lastReadAt : null,
    lastMessageAt: me ? me.lastMessageAt : null
  };
}

export default router;