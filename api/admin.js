// Admin API endpoint — handles all /api/admin/* routes
import crypto from 'crypto';

console.log('[admin.js] loaded');

const COOKIE_NAME = 'gl_admin';
const SESSION_HOURS = 8;

function secret() {
  const value = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!value) throw new Error('SESSION_SECRET or ADMIN_PASSWORD missing');
  return value;
}
function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}
function createToken() {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch { return false; }
}
function readCookie(req) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE_NAME) return rest.join('=');
  }
  return undefined;
}
function isAuthenticated(req) {
  return verifyToken(readCookie(req) || '');
}
function setSessionCookie(res, token) {
  const maxAge = SESSION_HOURS * 60 * 60;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
function passwordMatches(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== 'string' || candidate.length === 0) return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(data);
}

export default async function handler(req, res) {
  console.log('[admin.js] handler called', req.method, req.url);
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/admin/, '').replace(/^\/api\/admin/, '') || '/';

  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(200).end();
  }

  // Root endpoint for testing
  if (path === '/' || path === '') {
    return json(res, 200, { ok: true, message: 'Admin API is working', authenticated: isAuthenticated(req) });
  }

  // Login
  if (path === '/login' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!passwordMatches(body?.password)) {
      return json(res, 401, { error: 'Invalid password' });
    }
    setSessionCookie(res, createToken());
    return json(res, 200, { ok: true });
  }

  // Session
  if (path === '/session' && req.method === 'GET') {
    return json(res, 200, { authenticated: isAuthenticated(req) });
  }
  if (path === '/session' && (req.method === 'POST' || req.method === 'DELETE')) {
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  }

  // Require authentication for all other routes
  if (!isAuthenticated(req)) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const base64 = authHeader.split(' ')[1];
      const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');
      const expectedUser = process.env.BASIC_AUTH_USER || 'admin';
      const expectedPass = process.env.BASIC_AUTH_PASSWORD;
      if (expectedPass && user === expectedUser && pass === expectedPass) {
        setSessionCookie(res, createToken());
      } else {
        return json(res, 401, { error: 'Unauthorized' });
      }
    } else {
      return json(res, 401, { error: 'Unauthorized' });
    }
  }

  // Content
  if (path === '/content' && req.method === 'GET') {
    try {
      const fallback = require('./_data/content.json');
      return json(res, 200, fallback);
    } catch (e) {
      return json(res, 500, { error: 'Failed to load content' });
    }
  }
  if (path === '/content' && req.method === 'PUT') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return json(res, 200, { ok: true });
  }

  // Messages
  if (path === '/messages') {
    if (req.method === 'GET') {
      return json(res, 200, { messages: [] });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      return json(res, 201, { ok: true });
    }
  }

  // Media
  if (path === '/media' && req.method === 'GET') {
    return json(res, 200, { media: [] });
  }
  if (path === '/media/upload' && req.method === 'POST') {
    return json(res, 200, { ok: true });
  }

  // Settings
  if (path === '/settings' && req.method === 'GET') {
    return json(res, 200, {});
  }
  if (path === '/settings' && req.method === 'PUT') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'Not found' });
}