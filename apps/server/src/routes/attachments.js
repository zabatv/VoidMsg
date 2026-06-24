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