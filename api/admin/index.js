// Admin API endpoint — consolidated (ES Module)
import crypto from 'crypto';
import { createRequire } from 'module';
import { handleUpload as blobHandleUpload } from '@vercel/blob/client';
import { readContent, writeContent, readMessages, writeMessages, appendMessage, normaliseMessage, isValidMessage, listMedia, deleteMediaByUrl } from '../_lib/store.js';

// Node ESM cannot import JSON statically; use CJS require instead.
const require = createRequire(import.meta.url);
const fallbackModule = require('../_data/content.json');const fallbackContent = fallbackModule.default || fallbackModule;

const COOKIE_NAME = 'gl_admin';
const SESSION_HOURS = 8;

// Password protection is switched off while the site is under construction;
// remove ADMIN_AUTH_DISABLED (or set it to 0) at launch to restore the gate.
function authDisabled() {
  return process.env.ADMIN_AUTH_DISABLED === '1';
}

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

// Client-upload handshake for @vercel/blob/client's upload(). This is called
// by the browser before the file bytes are sent directly to Blob storage.
async function handleUpload(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const jsonResponse = await blobHandleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async () => ({}),
    onUploadCompleted: async () => {},
  });
  return json(res, 200, jsonResponse);
}

export default async function handler(req, res) {
  console.log('[admin/index.js] handler called', req.method, req.url);

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/admin/, '').replace(/^\/api\/admin/, '') || '/';

  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Text,Authorization');
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
    return json(res, 200, { authenticated: authDisabled() || isAuthenticated(req) });
  }
  if (path === '/session' && (req.method === 'POST' || req.method === 'DELETE')) {
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  }

  // Check authentication for all other endpoints
  if (!authDisabled() && !isAuthenticated(req)) {
    // Allow basic auth as fallback (extra security)
    if (checkBasicAuth(req)) {
      setSessionCookie(res, createToken());
    } else {
      // Return 401 with WWW-Authenticate header for browser basic auth popup (optional)
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return json(res, 401, { error: 'Unauthorized' });
    }
  }

  // Content endpoints — stored in Vercel Blob so the homepage shows what the
  // admin last published.
  if (path === '/content' && req.method === 'GET') {
    try {
      const content = await readContent(fallbackContent);
      return json(res, 200, content);
    } catch (e) {
      return json(res, 500, { error: 'Failed to load content' });
    }
  }
  if (path === '/content' && (req.method === 'PUT' || req.method === 'POST')) {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object' || !body.company || !body.hero) {
        return json(res, 400, { error: 'Invalid content payload' });
      }
      await writeContent(body);
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error('[admin] content write failed', e);
      return json(res, 500, { error: 'Failed to save content' });
    }
  }

  // Messages — Blob-backed inbox shared with the public /api/messages route.
  if (path === '/messages') {
    if (req.method === 'GET') {
      const messages = await readMessages();
      return json(res, 200, { messages });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const entry = normaliseMessage(body);
      if (!isValidMessage(entry)) {
        return json(res, 400, { error: 'Name, email and message are required' });
      }
      await appendMessage(entry);
      return json(res, 201, { ok: true });
    }
    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'Missing id' });
      const messages = await readMessages();
      const next =
        req.method === 'PATCH'
          ? messages.map((m) => (m.id === id ? { ...m, read: true } : m))
          : messages.filter((m) => m.id !== id);
      if (next.length === messages.length && req.method === 'DELETE') {
        return json(res, 404, { error: 'Message not found' });
      }
      await writeMessages(next);
      return json(res, 200, { ok: true, messages: next });
    }
  }

  // Media — real Blob listing and deletion. Uploads go through
  // /api/admin/upload (client-upload flow), handled further below.
  if (path === '/media' && req.method === 'GET') {
    try {
      const media = await listMedia();
      return json(res, 200, { media });
    } catch (e) {
      console.error('[admin] media list failed', e);
      return json(res, 500, { error: 'Failed to list media' });
    }
  }
  if (path === '/media' && req.method === 'DELETE') {
    const mediaUrl = url.searchParams.get('url');
    if (!mediaUrl) return json(res, 400, { error: 'Missing url parameter' });
    try {
      await deleteMediaByUrl(mediaUrl);
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error('[admin] media delete failed', e);
      return json(res, 500, { error: 'Failed to delete media' });
    }
  }

  // Client-upload handshake for @vercel/blob/client upload().
  if (path === '/upload' && req.method === 'POST') {
    try {
      return await handleUpload(req, res);
    } catch (e) {
      console.error('[admin] upload handshake failed', e);
      return json(res, 500, { error: e?.message || 'Upload failed' });
    }
  }

  return json(res, 404, { error: 'Not found' });
}