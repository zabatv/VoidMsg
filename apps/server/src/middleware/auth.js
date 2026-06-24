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