// Admin API endpoint — consolidated
const crypto = require('crypto');

const COOKIE_NAME = 'gl_admin';
const SESSION_HOURS = 8;

// Simple in-memory rate limiting
const attempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > 15 * 60 * 1000) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

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
  } catch (e) { return false; }
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

// Helper to check basic auth (extra security layer)
function checkBasicAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const base64 = authHeader.split(' ')[1];
  if (!base64) return false;
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');
  const expectedUser = process.env.BASIC_AUTH_USER || 'admin';
  const expectedPass = process.env.BASIC_AUTH_PASSWORD;
  if (!expectedPass) return false;
  return user === expectedUser && pass === expectedPass;
}

module.exports = async function handler(req, res) {
  console.log('[admin/index.js] handler called', req.method, req.url);

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/admin/, '').replace(/^\/api\/admin/, '') || '/';

  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(200).end();
  }

  // Root endpoint — health check
  if (path === '/' || path === '') {
    return json(res, 200, { ok: true, message: 'Admin API is working', authenticated: isAuthenticated(req) });
  }

  // Login endpoint
  if (path === '/login' && req.method === 'POST') {
    const clientIp = req.headers['x-forwarded-for'] || 'unknown';
    if (isRateLimited(clientIp)) {
      return json(res, 429, { error: 'Too many login attempts. Try again later.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!passwordMatches(body?.password)) {
      return json(res, 401, { error: 'Invalid password' });
    }
    setSessionCookie(res, createToken());
    return json(res, 200, { ok: true });
  }

  // Session endpoints
  if (path === '/session' && req.method === 'GET') {
    return json(res, 200, { authenticated: isAuthenticated(req) });
  }
  if (path === '/session' && (req.method === 'POST' || req.method === 'DELETE')) {
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  }

  // Check authentication for all other endpoints
  if (!isAuthenticated(req)) {
    // Allow basic auth as fallback (extra security)
    if (checkBasicAuth(req)) {
      setSessionCookie(res, createToken());
    } else {
      // Return 401 with WWW-Authenticate header for browser basic auth popup (optional)
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return json(res, 401, { error: 'Unauthorized' });
    }
  }

  // Content endpoints
  if (path === '/content' && req.method === 'GET') {
    try {
      const fallback = require('../_data/content.json');
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
};