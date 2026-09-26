// Admin API endpoint — consolidated (ES Module)
import { createRequire } from 'module';
import { handleUpload as blobHandleUpload } from '@vercel/blob/client';
import { readContent, writeContent, readMessages, appendMessage, normaliseMessage, isValidMessage, listMedia, deleteMediaByUrl, readActivity, logActivity, updateMessage, deleteMessageById } from '../_lib/store.js';
import { describeChanges } from '../_lib/describeChanges.js';
import { authDisabled, isAuthenticated, isRateLimited, createToken, setSessionCookie, clearSessionCookie, passwordMatches } from '../_lib/auth.js';

// Node ESM cannot import JSON statically; use CJS require instead.
const require = createRequire(import.meta.url);
const fallbackModule = require('../_data/content.json');const fallbackContent = fallbackModule.default || fallbackModule;

// Session helpers (cookie signing, auth checks, rate limiting) now live in
// _lib/auth.js — shared verbatim with the CRM API so every admin-area module
// enforces the identical session gate.

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
      const before = await readContent(fallbackContent);
      await writeContent(body);
      await logActivity({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'publish',
        summary: describeChanges(before, body),
        at: new Date().toISOString(),
      });
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error('[admin] content write failed', e);
      return json(res, 500, { error: 'Failed to save content' });
    }
  }

  // Activity feed — recent publishes plus the newest contact messages.
  if (path === '/activity' && req.method === 'GET') {
    try {
      const [activity, messages] = await Promise.all([readActivity(), readMessages()]);
      const newestMessages = messages
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          type: 'message',
          name: m.name,
          subject: m.subject,
          read: m.read,
          createdAt: m.createdAt,
        }));
      return json(res, 200, { activity: activity.slice(0, 8), messages: newestMessages });
    } catch (e) {
      console.error('[admin] activity failed', e);
      return json(res, 500, { error: 'Failed to load activity' });
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
      // Per-entry updates touch only the target blob — an enquiry landing at
      // the same moment is untouched. The returned list derives from the
      // pre-write read (no read-after-write staleness).
      const result =
        req.method === 'PATCH' ? await updateMessage(id, { read: true }) : await deleteMessageById(id);
      if (!(result.applied ?? result.deleted)) {
        return json(res, 404, { error: 'Message not found' });
      }
      return json(res, 200, { ok: true, messages: result.messages });
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