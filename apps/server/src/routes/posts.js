import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  }
});

function fmtAuthor(a) {
  return a ? { ...a, hasAvatar: !!a.avatarMimeType, avatarMimeType: undefined } : a;
}

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 50);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;

    const posts = await prisma.post.findMany({
      where: cursor ? { id: { lt: cursor } } : {},
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        author: { select: { id: true, name: true, avatarMimeType: true } },
        _count: { select: { comments: true } }
      }
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = items.length ? items[items.length - 1].id : null;

    res.json({
      items: items.map(p => ({ ...p, imageMimeType: p.imageMimeType || undefined, image: undefined, author: fmtAuthor(p.author) })),
      nextCursor,
      hasMore
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/image', async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: Number(req.params.id) },
      select: { image: true, imageMimeType: true }
    });
    if (!post || !post.image) return res.status(404).end();
    res.set('Content-Type', post.imageMimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(post.image);
  } catch (e) {
    res.status(500).end();
  }
});

router.post('/', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const text = req.body.text ? String(req.body.text).trim() : '';
    if (!text && !req.file) return res.status(400).json({ error: 'Text or image is required' });
    if (text.length > 1000) return res.status(400).json({ error: 'Text too long (max 1000)' });

    const data = { authorId: req.userId, text };
    if (req.file) {
      data.image = req.file.buffer;
      data.imageMimeType = req.file.mimetype;
    }

    const post = await prisma.post.create({
      data,
      include: {
        author: { select: { id: true, name: true, avatarMimeType: true } },
        _count: { select: { comments: true } }
      }
    });

    res.status(201).json({ ...post, image: undefined, imageMimeType: post.imageMimeType || undefined, author: fmtAuthor(post.author) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.authorId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.post.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Comments ---

router.get('/:id/comments', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, avatarMimeType: true } }
      }
    });
    res.json(comments.map(c => ({ ...c, author: fmtAuthor(c.author) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
    if (text.length > 500) return res.status(400).json({ error: 'Comment too long (max 500)' });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = await prisma.comment.create({
      data: { postId, authorId: req.userId, text: text.trim() },
      include: {
        author: { select: { id: true, name: true, avatarMimeType: true } }
      }
    });

    res.status(201).json({ ...comment, author: fmtAuthor(comment.author) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: 'Not found' });
    if (comment.authorId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.comment.delete({ where: { id: commentId } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
