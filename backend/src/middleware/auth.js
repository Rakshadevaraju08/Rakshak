const crypto = require('crypto');

function signToken(user) {
  if (!process.env.JWT_SECRET) return null;
  const encoded = Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

// In local/demo mode (no JWT_SECRET), operations remain open. Configure a secret
// in deployed environments and use this signed token format: base64(payload).signature.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!process.env.JWT_SECRET) return next();
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const [encoded, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(encoded).digest('base64url');
    if (!encoded || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: 'Invalid token' });
    try {
      req.user = JSON.parse(Buffer.from(encoded, 'base64url').toString());
      if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient role' });
      next();
    } catch { res.status(401).json({ error: 'Invalid token' }); }
  };
}

module.exports = { requireRole, signToken };
