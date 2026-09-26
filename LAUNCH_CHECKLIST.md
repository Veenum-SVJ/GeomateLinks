# Geomate Links — Launch Checklist

Everything that must flip before the site goes live. Every step below is
verified against the current code (`api/admin/index.js`, `api/content.js`,
`api/messages.js`) — nothing here is guesswork.

Steps marked **[Dashboard]** are done in the Vercel dashboard by you.
Steps marked **[Check]** are verification commands — paste them in a
terminal, or ask the agent to run them.

---

## Phase 0 — Content & repo pre-flight

- [ ] **Final content pass in the admin** — every page edited to taste and
      **published** (publish bar → "Publish to live site"). The homepage
      reads the published document from Blob storage, not the bundled JSON.
- [ ] **Media audit** — `/media` currently contains `field.mp4` (2.7 MB)
      which nothing on the site references. Delete it from the repo (and/or
      the Media page) so dead weight doesn't ship.
- [ ] **Custom domain (if used)** — the site currently lives at
      `geomate-links.vercel.app`. If you buy a domain, add it in
      **[Dashboard]** Vercel → Settings → Domains, then update the
      canonical/OG URLs in `index.html` and the URL in `public/sitemap.xml`
      + `public/robots.txt` before going live.
- [ ] **Sitemap date** — `public/sitemap.xml` has a hardcoded `lastmod`
      (`2026-09-04`). Bump it on launch day.

## Phase 1 — Secrets & password

- [ ] **Choose the admin password.** You set this yourself; it lives only
      in Vercel's environment variables, never in code.
- [ ] **Confirm `ADMIN_PASSWORD` is set in [Dashboard]** — Vercel →
      Settings → Environment Variables, for Production (and Preview if you
      test there). The login endpoint rejects *empty* passwords
      (`passwordMatches` requires a non-empty env value), so the gate
      cannot silently open — but the variable must exist for login to work.
- [ ] **Recommended: add `SESSION_SECRET`** (any long random string, e.g.
      64+ hex chars). Session cookies are HMAC-signed with
      `SESSION_SECRET || ADMIN_PASSWORD`. A dedicated secret means you can
      rotate the password without invalidating your own active sessions —
      and rotating it instantly logs out every existing session.
- [ ] **Confirm `BLOB_READ_WRITE_TOKEN` is present** — it already is (all
      environments); just don't remove it. Content, messages and media all
      live in Blob storage.

## Phase 2 — The auth flip

- [ ] **[Dashboard]** Vercel → Settings → Environment Variables → delete
      **`ADMIN_AUTH_DISABLED`**. That single variable is the master switch:
      the write-protection checks in `api/admin/index.js`, `api/content.js`
      and `api/messages.js` all read it at runtime.
- [ ] **[Dashboard]** Redeploy (Deployments → ⋯ → Redeploy) so the running
      functions no longer see the variable. A push to `main` also triggers
      this automatically.
- [ ] **[Check]** Writes are now rejected without a session:
      ```
      curl -s -X PUT https://<your-domain>/api/content -d '{}' -H "Content-Type: application/json" -w "\n%{http_code}\n"
      ```
      Expected: `401 Unauthorized`. A `200` here means the flip failed.
- [ ] **[Check]** Session endpoint reports locked:
      ```
      curl -s https://<your-domain>/api/admin/session
      ```
      Expected: `{"authenticated":false}`.
- [ ] **[Check]** CRM is locked (leads, clients and notes are private):
      ```
      curl -s -o /dev/null -w "%{http_code}" https://<your-domain>/api/crm/dashboard
      ```
      Expected: `401`. While `ADMIN_AUTH_DISABLED=1` (dev mode) this
      returns `200` — flip the switch before storing real client data.
- [ ] **[Check]** Quotations are locked (pricing, discounts and notes are private):
      ```
      curl -s -o /dev/null -w "%{http_code}" https://<your-domain>/api/quotations/dashboard
      ```
      Expected: `401`. Same dev-mode caveat as the CRM check above.

### What flips automatically (no code changes needed)

- `/api/admin/*`, `/api/crm/*` (the whole CRM — leads, clients,
  activities, follow-ups, dashboard), `/api/quotations/*` (the whole
  quotations module — pricing, discounts, notes), content writes, and
  message read/mark/delete require the signed session cookie (HttpOnly ·
  Secure · SameSite=Strict, 8-hour expiry, HMAC-verified, timing-safe password
  compare). CRM data is private by construction: no public route touches
  the `crm/` Blob prefixes.
- Login attempts are rate-limited to **10 per 5 minutes** per IP.
- `/admin` frontend redirects to `/admin/login`, which returns to being a
  password screen (the current quick-links landing page is a dev-mode
  replacement). The public site is unaffected either way.

### One manual decision for you

- [ ] **The footer © mark links to `/admin`.** Once the gate is live this
      is safe (strangers just hit the login page) — but if you'd rather not
      advertise the admin URL at all, ask the agent to remove or change
      that link before launch.

## Phase 3 — Launch-day verification runbook

Run from the live domain, in order:

- [ ] Homepage loads: `curl -s -o /dev/null -w "%{http_code}" https://<domain>/` → `200`
- [ ] Content API serves published content: `GET /api/content` → `200`, contains your final copy
- [ ] Contact form works: submit a test enquiry from the site → `201`; it appears in admin Messages
- [ ] **Unauthenticated** `GET /api/messages` → `401` (inbox is private)
- [ ] Login with your password via the UI → dashboard opens
- [ ] Publish a small test edit → appears on the live site within ~30s
      (Blob read-after-write lag is real; allow up to 30s) → revert the edit
- [ ] `robots.txt` reachable and still disallows `/admin` and `/api/`
- [ ] Run a phone (375px), tablet (820px) and desktop (1440px) eyeball pass

## Phase 4 — Known limitations (accepted, revisit later)

- **Inbox concurrency**: messages are stored as one JSON document with
  last-write-wins. Two writes in the same moment (e.g. a new enquiry
  landing during a delete) can lose one of them. Fine for low volume;
  ask the agent to move to per-message Blob objects if enquiries become
  business-critical.
- **Blob read lag**: 5–30s between publishing in admin and seeing it on
  the live site. Not a bug.
- **No media CDN transforms**: uploads are served as-is. Keep hero-style
  assets under ~1 MB.

## Rollback

If anything goes wrong right after the flip: re-add
`ADMIN_AUTH_DISABLED=1` in **[Dashboard]** and redeploy — the site
returns to the current open-admin state immediately. Nothing in the
content store is affected by the flip in either direction.
