# ASL Bhavan — Homestay booking & property management

Production-structured booking platform for **ASL Bhavan**, a homestay in Kanyakumari with
8 private rooms and 1 dormitory. Public website, real-time availability, online (Razorpay)
and direct (WhatsApp / cash / UPI) payments, receipts, customer accounts, Instagram feed and
a full admin dashboard — all configurable from the admin panel, nothing business-specific
hard-coded.

| Layer      | Choice                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, React 19, TypeScript, Server Components)           |
| UI         | Tailwind CSS v4, shadcn/ui, Lucide icons, React Hook Form + Zod, sonner    |
| Database   | PostgreSQL on **Aiven**, Prisma 7 (`@prisma/adapter-pg`, small pool)       |
| Auth       | Cookie sessions stored in Postgres, bcrypt password hashes, RBAC           |
| Payments   | Razorpay Orders API + Checkout + signed webhooks                           |
| Email      | SMTP via nodemailer (Gmail, Zoho, Brevo, SES, …) with delivery log + resend |
| Files      | Local disk (dev) or any S3-compatible bucket (prod)                        |
| PDF        | pdfkit (receipts rendered server-side from a frozen snapshot)              |
| Hosting    | Render web service **or** Vercel (GitHub auto-deploy) + Aiven Postgres     |

---

## Contents

1. [Running the app: local development & production mode](#1-running-the-app-local-development--production-mode)
2. [Environment variables](#2-environment-variables)
3. [Database: Prisma, migrations, seed](#3-database-prisma-migrations-seed)
4. [Project structure](#4-project-structure)
5. [How bookings & availability work](#5-how-bookings--availability-work)
6. [Payments](#6-payments)
7. [Receipts & email](#7-receipts--email)
8. [Instagram, gallery & content](#8-instagram-gallery--content)
9. [Admin dashboard](#9-admin-dashboard)
10. [Scheduled jobs](#10-scheduled-jobs)
11. [Security notes](#11-security-notes)
12. [Testing & quality gates](#12-testing--quality-gates)
13. [Deploying](#13-deploying) — [Aiven database](#131-aiven-postgresql-both-hosts) · [Render](#132-render-web-service) · [Vercel](#133-vercel) · [Any VPS / Docker host](#134-any-vps-or-docker-host)
14. [Backups & restore](#14-backups--restore)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Running the app: local development & production mode

### 1.1 Prerequisites

- **Node.js 20+** (developed on Node 24) and npm 10+
- A **PostgreSQL 14+** database. There is no local-Postgres requirement — a free Aiven
  service works for development too. If you prefer local, `docker run --name asl-pg -e
  POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16` and use
  `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres` (drop `?sslmode=require`).
- Optional: Razorpay test keys, SMTP credentials, an Instagram Graph token. Without them the
  corresponding features are simply hidden/disabled — the app never shows broken buttons.

### 1.2 Start locally (development)

```bash
git clone <your-repo-url> asl-bhavan && cd asl-bhavan
npm install                       # also runs `prisma generate`
cp .env.example .env              # Windows PowerShell: Copy-Item .env.example .env
```

Edit `.env` — the minimum for a working dev setup:

```dotenv
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/defaultdb?sslmode=require"
SESSION_SECRET="<openssl rand -base64 48>"
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<a strong password, used only once by the seed>
```

Then:

```bash
npm run prisma:deploy             # apply migrations (creates btree_gist + exclusion constraint)
npm run prisma:seed               # settings, amenities, 8 rooms + 1 dorm, admin user (idempotent)
npm run dev                       # http://localhost:3000  ·  admin at /admin
```

Sign in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The seed only creates the admin if
that email does not exist yet and never overwrites a password. Uploaded images go to
`public/uploads/` (git-ignored) while `STORAGE_PROVIDER=local`.

To test Razorpay locally, add test-mode `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. For the
webhook, expose your dev server (`npx localtunnel --port 3000` or `ngrok http 3000`) and point a
Razorpay test webhook at `https://<tunnel>/api/payments/webhook`. Emails need the `SMTP_*` variables;
without it every send is logged as FAILED in Admin → Emails so you can still see what would go out.

### 1.3 Run the production build locally (or on any server)

Production mode is what Render, Vercel or a VPS runs. Try it locally before deploying:

```bash
npm ci                            # clean install from package-lock.json
npm run typecheck && npm run lint && npm test
npm run build                     # prisma generate + next build  (NODE_ENV=production is implied)
npm run prisma:deploy             # forward-only migrations against the production database
npm run start                     # serves the optimised build on http://localhost:3000
```

Set `PORT=8080 npm run start` (PowerShell: `$env:PORT=8080; npm run start`) to change the port.
In production you must also set `NODE_ENV=production`, a real `NEXT_PUBLIC_SITE_URL` (https),
`CRON_SECRET`, and — unless the host has a persistent disk — `STORAGE_PROVIDER=s3` with the
`S3_*` variables. Run `npm run prisma:seed` once against the production database to create the
admin, then change the password from `/profile` and remove `ADMIN_PASSWORD` from the environment.

Hosted step-by-step guides are in [section 13](#13-deploying).

### 1.4 Useful scripts

| Script                    | What it does                                                  |
| ------------------------- | ------------------------------------------------------------- |
| `npm run dev`             | Next.js dev server                                            |
| `npm run build`           | `prisma generate` + production build                          |
| `npm run start`           | Run the production build                                      |
| `npm run lint`            | ESLint (Next + React compiler rules)                          |
| `npm run typecheck`       | `tsc --noEmit`                                                |
| `npm test`                | Vitest unit tests (pure booking/pricing/availability logic)   |
| `npm run prisma:migrate`  | `prisma migrate dev` — create a new migration locally         |
| `npm run prisma:deploy`   | `prisma migrate deploy` — apply migrations (CI / production)  |
| `npm run prisma:seed`     | Idempotent seed                                               |
| `npm run prisma:studio`   | Prisma Studio                                                 |

---

## 2. Environment variables

See [`.env.example`](.env.example) for the annotated list. Summary:

| Variable                                             | Required | Notes                                                                  |
| ---------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                       | yes      | Aiven URI **with `?sslmode=require`**                                  |
| `DATABASE_POOL_MAX`                                  | no (5)   | Keep ≤ 5 on Aiven free/hobby tiers                                     |
| `DATABASE_CA_CERT`                                   | no       | Aiven CA certificate (PEM) for full TLS verification; otherwise encrypted-only |
| `SESSION_SECRET`                                     | yes      | ≥ 32 chars; signs the `asl_session` cookie                             |
| `NEXT_PUBLIC_SITE_URL`                               | yes      | Public origin, used in emails/receipts/sitemap                         |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`        | seed     | Used **only** by the seed to create the first admin                    |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`             | optional | Enables "Pay online". Without them the option is hidden, not broken     |
| `RAZORPAY_WEBHOOK_SECRET`                            | optional | Enables `/api/payments/webhook`                                        |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | optional | Enables email. Without them sends are logged as FAILED (visible in admin) |
| `OWNER_NOTIFICATION_EMAIL`                           | optional | Fallback owner inbox (override in Admin → Settings → Notifications)    |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_ACCOUNT_ID`     | optional | Enables the "Sync Instagram" button and cron sync                      |
| `CRON_SECRET`                                        | prod     | Bearer token for `/api/cron/expire-holds`                              |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_GOOGLE_MAPS_URL` | optional | Fallbacks; the values in Admin → Settings take precedence       |
| `STORAGE_PROVIDER` + `S3_*`                          | prod     | `s3` for persistent uploads (Render disk is ephemeral; Vercel is read-only) |

Only variables prefixed `NEXT_PUBLIC_` are ever shipped to the browser. `src/lib/env.ts`
validates the server env with Zod on first access and fails fast with a readable list.

---

## 3. Database: Prisma, migrations, seed

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma) (client generated into `src/generated/prisma`, git-ignored).
- Config: [`prisma.config.ts`](prisma.config.ts) (Prisma 7 style; reads `DATABASE_URL`).
- Connection: [`src/lib/db/prisma.ts`](src/lib/db/prisma.ts) — singleton `PrismaClient` over a
  `pg` Pool (`max = DATABASE_POOL_MAX`, SSL), reused across hot reloads via `globalThis`.
- Migrations: [`prisma/migrations`](prisma/migrations). The initial migration includes hand-written
  SQL Prisma cannot express:
  - `CREATE EXTENSION btree_gist`
  - `CHECK` constraints (dates half-open, positive guests/nights, non-negative money, capacity sanity)
  - **`Booking_no_overlap_excl`** — a GiST `EXCLUDE` constraint that makes it impossible for two
    inventory-holding bookings of the same private room to overlap, even under concurrent writes.

Creating a new migration during development:

```bash
# edit prisma/schema.prisma, then:
npm run prisma:migrate -- --name describe_change
```

Seed (`prisma/seed.ts`) is idempotent: it upserts settings groups, amenities, the 8 rooms and
the dormitory (with realistic INR prices you can change in Admin → Rooms & pricing), and creates
the admin from env if missing. No fake bookings or mock data are inserted.

### Schema overview

```
User ─┬─ Session            (cookie sessions, revocable)
      ├─ AuthToken          (email verification / password reset, hashed)
      └─ Booking ─┬─ BookingGuest[]   (primary + additional guests, optional ID refs)
Room ─┬─ RoomImage[]        │─ Payment[] ── PaymentEvent[] (Razorpay webhook idempotency)
      ├─ RoomAmenity[]      │─ Receipt (1:1, unique bookingId, frozen snapshot, PDF key)
      ├─ RoomPrice[]        └─ EmailLog[]
      ├─ RoomBlock[]
      └─ Booking[]
SiteSetting (JSON per group)   DailySequence (booking/receipt counters)
Post / InstagramSyncLog / GalleryImage / ContactMessage / AuditLog
```

Key enums: `BookingStatus` (DRAFT, PENDING_PAYMENT, OWNER_CONFIRMATION, CONFIRMED,
CHECKED_IN, CHECKED_OUT, CANCELLED, EXPIRED, NO_SHOW), `PaymentStatus` (PENDING, PAID,
PARTIAL, FAILED, REFUNDED, CASH, DIRECT_UPI, BANK_TRANSFER, PAY_ON_ARRIVAL),
`PaymentMethod`, `RoomType` (PRIVATE_ROOM, DORMITORY), `BookingSource`, `BlockType`.

---

## 4. Project structure

```
src/
  app/
    (public)/           marketing site, rooms, availability, booking flow, account pages, receipts
    admin/              admin dashboard (server-rendered lists, client components for actions)
    api/                route handlers: auth, bookings, payments, receipts, admin/*, cron
    layout.tsx, globals.css, not-found.tsx, proxy.ts (route protection)
  components/
    ui/                 shadcn primitives
    layout/, booking/, forms/, admin/, posts/, icons/
  lib/
    db/prisma.ts        Prisma singleton
    env.ts              validated env + integration flags
    settings/           SiteSetting groups (Zod schemas + defaults + cached loader)
    auth/               sessions, guards (requireUser / requireAdmin), password hashing
    booking/            dates, money, pricing, status machine, availability, booking service,
                        access control, notifications, serialisation
    payments/           razorpay.ts (orders, verify, webhook, refunds), signature.ts
    receipts/           snapshot type, PDF renderer, receipt service
    email/              SMTP (nodemailer) client + EmailLog, templates, branding, retry
    instagram/          Graph API sync
    admin/              dashboard, bookings list/CSV, rooms, content, reports services
    storage/            local / S3 abstraction, image validation
    audit.ts, logger.ts, rate-limit.ts, errors.ts, labels.ts, whatsapp.ts
prisma/                 schema, migrations, seed
tests/unit/             vitest suites for the pure domain logic
```

Conventions:

- Every API response is `{ ok: true, data } | { ok: false, error: { code, message, details? } }`
  (`src/lib/api/respond.ts`). Services throw `AppError` subclasses; anything else becomes a
  generic 500 without leaking internals.
- All admin routes/pages call `requireAdmin()` / `requireAdminOrRedirect()` server-side.
  `proxy.ts` is only a convenience redirect, never the security boundary.
- Dates are stored as UTC-midnight `DATE`-like values; ranges are half-open `[checkIn, checkOut)`.
- Money is `DECIMAL(10,2)`; arithmetic uses `roundMoney` / integer paise.

---

## 5. How bookings & availability work

**Overlap rule (used everywhere):** `existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn`.

- **Private rooms** are unavailable for a night if any inventory-holding booking
  (`PENDING_PAYMENT` with live hold, `OWNER_CONFIRMATION`, `CONFIRMED`, `CHECKED_IN`) or a
  `RoomBlock` overlaps.
- **Dormitory** availability per night = `capacity − Σ guestCount(overlapping bookings) − bedsBlocked(overlapping blocks)`.
  A request for *n* guests succeeds only if every night has ≥ *n* free beds.
- **Pricing** is computed server-side from `Room.basePrice` / `weekendPrice` / `pricePerPerson`
  plus `RoomPrice` overrides (priority-ordered), tax from settings, and snapshotted on the booking.

**Creating a booking** (`createBooking` in `src/lib/booking/booking-service.ts`) runs in one
transaction:

1. `SELECT … FOR UPDATE` on the `Room` row (serialises writers for that unit).
2. Expire stale `PENDING_PAYMENT` holds for that room.
3. Re-check availability and **recalculate the price** from the database (client totals are ignored).
4. Allocate `ASL-YYYYMMDD-A001` via the `DailySequence` counter.
5. Insert the booking + guests (+ payment for manual bookings).
6. The GiST exclusion constraint is the last line of defence; a violation is mapped to a friendly
   "no longer available" error.

Payment mode decides the initial state:

| Mode                              | Status              | Payment status | What happens next                                                  |
| --------------------------------- | ------------------- | -------------- | ------------------------------------------------------------------ |
| Pay online (Razorpay)             | `PENDING_PAYMENT`   | `PENDING`      | Hold for `booking.paymentHoldMinutes` (default 10) → `EXPIRED`     |
| Contact owner & pay directly      | `OWNER_CONFIRMATION`| `PENDING`      | wa.me link with pre-filled message; admin confirms with method     |
| Admin manual booking              | `CONFIRMED`         | as entered     | Optional payment recorded at creation                              |

Status transitions are enforced by `assertTransition` in `src/lib/booking/status.ts`.

Guests without an account can view/cancel a booking via the `?e=<guest email>` hint on the
confirmation link (`assertBookingAccess`); references alone never grant access.

---

## 6. Payments

### Razorpay (online)

1. `POST /api/payments/create-order` — amount is taken **from the booking row** (balance due), an
   order is created server-side and a `Payment(RAZORPAY, PENDING, razorpayOrderId)` row is stored.
2. Browser opens Razorpay Checkout (`components/booking/razorpay-checkout.tsx`) with the key id
   returned by the server.
3. `POST /api/payments/verify` — verifies `HMAC_SHA256(order_id|payment_id, KEY_SECRET)`, then
   `settleOnlinePayment` marks the payment `PAID`, sets the booking to `CONFIRMED`, clears the hold.
4. `POST /api/payments/webhook` — verifies `HMAC_SHA256(rawBody, WEBHOOK_SECRET)`, stores the
   event in `PaymentEvent` (unique per `x-razorpay-event-id` → idempotent), and runs the *same*
   settlement. Whichever arrives first confirms; the other is a no-op. Handles `payment.captured`,
   `payment.failed`, `refund.processed`.
5. Edge case — hold expired but payment captured: availability is re-checked under the room lock;
   if still free the booking is revived and confirmed, otherwise the payment is recorded as PAID
   on the EXPIRED booking and flagged (`SYSTEM_PAYMENT_NEEDS_ATTENTION` audit + Admin → Payments
   counter) so the owner can refund.
6. Refunds: Admin → Payments → **Refund** (full or partial) calls Razorpay and updates
   `refundedAmount` / `REFUNDED`.

Razorpay dashboard setup: create a webhook pointing at
`https://<your-domain>/api/payments/webhook` with events `payment.captured`, `payment.failed`,
`refund.processed`, and paste its secret into `RAZORPAY_WEBHOOK_SECRET`. Use test keys until
you are ready; the app behaves identically.

### Direct / WhatsApp payments

The guest picks "Contact owner & pay directly", gets an `OWNER_CONFIRMATION` booking and a
WhatsApp deep link (`bookingWhatsappUrl`) with the reference, dates, room and amount. The
admin then uses **Confirm booking** on the booking page, choosing the method (cash, UPI, bank
transfer, pay on arrival), amount received and a transaction reference. Partial amounts set
`PARTIAL`; further payments can be added with **Record payment**.

---

## 7. Receipts & email

- Receipt numbers are `ASL-RCP-YYYYMMDD-0001` (daily counter in `DailySequence`), one per
  booking (`Receipt.bookingId` is unique). Issuing is idempotent and race-safe.
- The receipt stores a **frozen JSON snapshot** (property details, guest, line items, totals,
  payments). The PDF and the HTML page (`/receipts/[number]`) are both rendered from it, so
  later price or settings changes never alter an issued receipt. PDFs are also written to storage
  under `receipts/…`.
- Automatic issuing: when a booking becomes fully paid (online capture or admin confirm/record
  payment) and *Settings → Notifications → "Automatically issue and email a receipt"* is on.
  Manual: Admin → Receipts (also lists paid bookings without a receipt) or the booking page.
- Guests download via `/api/receipts/[number]/pdf` with the same access rule as bookings.
- Emails (booking request / confirmed / cancelled, owner notification, receipt) go through
  `sendEmail`, which writes an `EmailLog` row first, then attempts delivery. Failures never break
  the calling flow. Admin → Emails shows the ledger and can **Resend** booking/receipt emails
  (they are re-rendered from current data). Security emails with one-time tokens are not resendable.

### SMTP setup

Any SMTP provider works; set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
and `EMAIL_FROM`, then use **Send test email** in Admin → Emails.

| Provider | Host / port | Notes |
| --- | --- | --- |
| Gmail / Google Workspace | `smtp.gmail.com` · 587 · `SMTP_SECURE=false` | Turn on 2-Step Verification → create an **App Password**; use it as `SMTP_PASS`. Gmail rewrites `EMAIL_FROM` to the account unless it is a verified "Send mail as" alias. ~500 mails/day (2 000 on Workspace) |
| Zoho Mail | `smtp.zoho.in` · 587 | Use an app-specific password if 2FA is on |
| Brevo (Sendinblue) | `smtp-relay.brevo.com` · 587 | Free 300/day; `SMTP_USER` is your login, `SMTP_PASS` the SMTP key |
| Amazon SES | `email-smtp.<region>.amazonaws.com` · 587 | Create SMTP credentials in the SES console; verify the sender domain |
| Mailgun / Postmark / SendGrid | see provider docs · 587 | Standard authenticated SMTP |

Port 465 requires `SMTP_SECURE=true` (implicit TLS); 587 uses STARTTLS with `SMTP_SECURE=false`.
For deliverability, send from a domain you own and add its SPF/DKIM records at your provider.

---

## 8. Instagram, gallery & content

- **Instagram**: uses the official Instagram Graph API (no scraping). Requires a Business/Creator
  account linked to a Facebook Page, a long-lived token and the IG user id. Admin → Instagram
  posts → **Sync Instagram**, or `GET /api/cron/expire-holds?instagram=1`. Posts are de-duplicated
  by `instagramPostId`, images are mirrored into storage (CDN URLs expire), captions refresh on
  re-sync, admin edits (title, visibility) are preserved, and "deleting" an Instagram post archives
  it so a later sync does not resurrect it.
- **Website posts**: written in the same admin screen (title, slug, caption, image, publish date).
- **Gallery**: multi-upload with category, alt text, featured/published toggles. Images are
  validated by magic number (JPEG/PNG/WebP/AVIF, ≤ 8 MB) and stored via the storage provider —
  never in Postgres.

---

## 9. Admin dashboard (`/admin`)

Dashboard (arrivals/departures/in-house, pending confirmations, occupancy tonight, month revenue),
Calendar (units × nights grid), Bookings (filters, CSV export, detail with confirm / record payment /
check-in / check-out / no-show / cancel / soft-delete, manual booking, modify), Rooms & pricing
(rooms, photos, amenities, seasonal overrides), Blocks (maintenance/owner use), Payments (with
refunds), Receipts, Reports (occupancy & revenue by day/month, by room, by source, CSV), Instagram
posts, Gallery, Users & guests (roles, deactivate, guest directory), Messages, Emails, Settings
(property, booking rules, content, policies, notifications) and Audit logs.

Everything an admin does is written to `AuditLog` with before/after JSON (sensitive keys redacted).
Bookings, payments and receipts are soft-deleted (`deletedAt`) — never physically removed.

---

## 10. Scheduled jobs

`GET|POST /api/cron/expire-holds` with header `Authorization: Bearer $CRON_SECRET`:

- flips stale `PENDING_PAYMENT` holds to `EXPIRED` (also done lazily inside booking transactions,
  so this is tidiness, not correctness),
- purges expired sessions,
- optionally `?instagram=1` runs an Instagram sync.

Run it every 5 minutes (holds) and every few hours with `?instagram=1`. On Render use a Cron Job
service; on Vercel the schedules in [`vercel.json`](vercel.json) are registered automatically and
Vercel adds the `Authorization: Bearer $CRON_SECRET` header itself; elsewhere use crontab or
cron-job.org. Details per host in section 13.

---

## 11. Security notes

- Secrets (`DATABASE_URL`, `RAZORPAY_*`, `SMTP_PASS`, `SESSION_SECRET`, Instagram token,
  S3 keys) are read only in server code; nothing but `NEXT_PUBLIC_*` reaches the browser.
- Passwords: bcrypt (cost 12). Sessions: random token, only its hash stored, HTTP-only, `Secure`
  in production, `SameSite=Lax`, revocable (role change / deactivation revokes all sessions).
- RBAC: `USER` / `ADMIN`; every admin API and page verifies the role server-side. The last active
  admin cannot be demoted or deactivated.
- Rate limiting on login, registration, password reset, contact, booking, payment and webhook
  endpoints (in-memory; swap for Redis if you scale horizontally).
- Zod validation on every input; Prisma parameterised queries; CSP, HSTS, frame and referrer
  headers in `next.config.ts`; CSV export guards against formula injection.
- Booking references and receipt numbers are sequential (guessable) and therefore never grant
  access by themselves.
- Government-ID references on guests are optional, stored as plain reference strings only, never
  displayed publicly, and only visible to admins.
- Audit logs never include passwords, tokens, signatures or secrets (`redact()`).

---

## 12. Testing & quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (react-hooks/compiler rules enabled)
npm test            # vitest: dates/overlap, pricing, availability maths, reference/status machine,
                    #         Razorpay signatures, CSV hardening, identifier validation
npm run build       # production build (works without a database; DB errors are logged)
```

Integration tests that need a live database are intentionally kept out of the default suite. To
exercise the booking engine end-to-end locally, point `DATABASE_URL` at a scratch Aiven database,
run `prisma:deploy` + `prisma:seed`, and use the site or the API (`POST /api/bookings`).

---

## 13. Deploying

The app is a standard Next.js server: it runs anywhere Node 20+ runs. Two first-class targets are
documented below — **Render** (a long-running server; simplest) and **Vercel** (serverless). Both
use the same Aiven PostgreSQL database and the same environment variables from section 2.

Whatever the host, the go-live checklist is the same:

1. Push the repository to GitHub (`git init && git add -A && git commit -m "Initial" && git push`).
2. Create the Aiven database (13.1) and copy its URI.
3. Create the web service, connect the GitHub repo, add the environment variables.
4. First deploy applies migrations. Run `npm run prisma:seed` once to create the admin.
5. Sign in, change the admin password at `/profile`, remove `ADMIN_PASSWORD` from the host env.
6. Point object storage (`STORAGE_PROVIDER=s3`), Razorpay webhook, email sender domain and cron at the
   final domain; set `NEXT_PUBLIC_SITE_URL=https://<your-domain>`.
7. Make a ₹1 test booking with Razorpay test keys, then switch to live keys.

### 13.1 Aiven PostgreSQL (both hosts)

1. Aiven console → **Create service → PostgreSQL** (any plan/region; Mumbai or Singapore for
   India). Copy the **Service URI** — it already ends in `?sslmode=require`.
2. Optionally create a dedicated database and user instead of `defaultdb` / `avnadmin`. The user
   must be able to run `CREATE EXTENSION btree_gist` (`avnadmin` can).
3. Mind the plan's connection limit. Keep `DATABASE_POOL_MAX=5` on Render (one process). On
   Vercel every function instance opens its own pool — use `DATABASE_POOL_MAX=2` **and** enable
   Aiven's built-in **connection pooling (PgBouncer)**: create a pool in *Connection pooling*,
   mode *Transaction*, and use the pool's URI as `DATABASE_URL`.
4. Enable automatic backups (on by default) — see section 14.

### 13.2 Render (web service)

1. Render → **New → Web Service** → connect the GitHub repo.
   - Runtime: **Node** · Region: Singapore (closest to Indian guests)
   - Build command: `npm ci && npm run build`
   - Start command: `npx prisma migrate deploy && npm run start`
   - Health check path: `/`
2. **Environment** → add every variable from section 2 (`NODE_ENV=production`, `DATABASE_URL`,
   `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL=https://<service>.onrender.com`, `CRON_SECRET`, …).
   Generate secrets with `openssl rand -base64 48`.
3. **Storage**: Render's disk is ephemeral → `STORAGE_PROVIDER=s3` with an S3-compatible bucket
   (Cloudflare R2 is free for this volume: set `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, keys,
   and `S3_PUBLIC_URL` to the bucket's public domain). Alternative: attach a **Persistent Disk**
   mounted at `/opt/render/project/src/public/uploads` and keep `STORAGE_PROVIDER=local`.
4. Deploy. The start command applies migrations; then open the service **Shell** and run
   `npm run prisma:seed` once.
5. **Cron**: Render → **New → Cron Job** (same repo, same env vars):
   - every 5 min: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/expire-holds`
   - every 6 h: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://<domain>/api/cron/expire-holds?instagram=1"`
6. Custom domain → **Settings → Custom Domains**, then update NEXT_PUBLIC_SITE_URL, EMAIL_FROM`r
   and the Razorpay webhook URL.

Auto-deploys on every push. Free-tier instances sleep after inactivity (first request is slow);
a paid instance avoids this and keeps the in-memory rate limiter warm.

### 13.3 Vercel

Vercel runs each route as a serverless function. The repo already includes a
[`vercel.json`](vercel.json) with the build command, region and cron schedules, and
`next.config.ts` marks `pdfkit`/`pg`/Prisma as server-external so receipt PDFs render correctly in
functions.

1. **Import**: [vercel.com/new](https://vercel.com/new) → import the GitHub repo. Framework is
   auto-detected as Next.js. Leave *Root Directory* as `.`; the build command
   `prisma migrate deploy && npm run build` comes from `vercel.json` (migrations run at build time,
   before the new version goes live).
2. **Environment variables** (Project → Settings → Environment Variables, scope *Production* — add
   *Preview* too if you want preview deployments to work against a separate database):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Aiven **pooled** URI (PgBouncer, transaction mode) with `?sslmode=require` |
   | `DATABASE_POOL_MAX` | `2` |
   | `SESSION_SECRET`, `CRON_SECRET` | `openssl rand -base64 48` each |
   | `NEXT_PUBLIC_SITE_URL` | `https://<project>.vercel.app` (update after adding a domain) |
   | `STORAGE_PROVIDER` | `s3` — **required**; the Vercel filesystem is read-only |
   | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | Cloudflare R2 / AWS S3 / Backblaze B2 |
   | `RAZORPAY_*`, `SMTP_*`, `EMAIL_FROM`, `OWNER_NOTIFICATION_EMAIL`, `INSTAGRAM_*` | as needed |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | only until the seed has run |

   `NODE_ENV` is set by Vercel automatically. Do **not** add `.env` to git — paste values in the
   dashboard or use `vercel env pull` locally.
3. **Deploy** (button, or push to `main`). Check the build log for `prisma migrate deploy` output.
4. **Seed the admin** once, from your machine, against the production database:

   ```bash
   npm i -g vercel && vercel login && vercel link
   vercel env pull .env.production.local          # downloads the production env (git-ignored)
   npx dotenv-cli -e .env.production.local -- npm run prisma:seed
   ```

   (`prisma.config.ts` loads `.env` automatically, so simply copying the production values into
   a local `.env` and running `npm run prisma:seed` works too — just don't forget to switch it back.)
5. **Cron**: `vercel.json` registers `/api/cron/expire-holds` every 5 minutes and the Instagram
   variant every 6 hours. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once the
   `CRON_SECRET` variable exists, which is exactly what the route expects. Note the plan limits:
   the **Hobby** plan allows 2 cron jobs at most once per day — change both schedules to e.g.
   `0 3 * * *` there (hold expiry also happens lazily inside every booking transaction, so this is
   safe); **Pro** supports the 5-minute schedule.
6. **Region**: `vercel.json` pins functions to `bom1` (Mumbai) to sit next to Indian guests and the
   Aiven service; change it to match your database region.
7. **Domain**: Project → Settings → Domains → add your domain, then update `NEXT_PUBLIC_SITE_URL`,
   `EMAIL_FROM` and the Razorpay webhook URL (`https://<domain>/api/payments/webhook`)
   and redeploy.

Vercel-specific behaviour to know:

- The in-memory rate limiter is per function instance, so limits are softer than on a single
  server. Swap `src/lib/rate-limit.ts` for an Upstash/Redis store if abuse becomes a concern.
- Post-payment side effects (emails, receipt PDF) run in the request that confirmed the booking;
  on Vercel keep an eye on function duration (default 10 s on Hobby, configurable on Pro). The
  webhook route is retried by Razorpay if it ever times out, and settlement is idempotent.
- Preview deployments share whatever `DATABASE_URL` you give them — use a separate scratch
  database for the *Preview* environment or leave it unset.

### 13.4 Any VPS or Docker host

```bash
# on the server (Ubuntu example)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
git clone <repo> /srv/asl-bhavan && cd /srv/asl-bhavan
npm ci && npm run build
cp .env.example .env && nano .env            # production values, STORAGE_PROVIDER=s3 or a persistent /public/uploads
npm run prisma:deploy && npm run prisma:seed
PORT=3000 NODE_ENV=production npm run start  # put behind nginx/Caddy for TLS; run under pm2 or systemd
```

Add two crontab entries mirroring the Render ones (`*/5 * * * *` and `0 */6 * * *`) with
`curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/expire-holds`.

Migrations are forward-only on every host: create them locally with `npm run prisma:migrate -- --name <change>`
and commit the generated SQL; deployments apply them with `prisma migrate deploy`.

---

## 14. Backups & restore

- **Aiven** takes automatic daily backups with point-in-time recovery on paid plans; use the Aiven
  console to fork/restore a service.
- Manual logical backup (recommended before schema changes):

```bash
pg_dump "$DATABASE_URL" --no-owner --format=custom --file=asl-bhavan-$(date +%F).dump
```

- Restore into an empty database:

```bash
pg_restore --no-owner --dbname="$NEW_DATABASE_URL" asl-bhavan-YYYY-MM-DD.dump
```

- Object storage (photos, receipt PDFs) should be versioned/replicated at the bucket level.
  Receipts can always be re-rendered from their database snapshot (Admin → Receipts → Re-render).
- Export bookings/payments/reports as CSV from the admin for offline records.

---

## 15. Troubleshooting

| Symptom                                                        | Fix                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Invalid server environment configuration` at boot             | Read the listed variables; `SESSION_SECRET` must be ≥ 32 chars                        |
| `too many connections` from Postgres                           | Lower `DATABASE_POOL_MAX`; close Prisma Studio; check for multiple instances          |
| Exclusion constraint error on migrate                          | Ensure the DB user can `CREATE EXTENSION btree_gist` (Aiven `avnadmin` can)           |
| "Pay online" option not shown                                  | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` missing, or disabled in Settings → Booking   |
| Webhook returns 400                                            | `RAZORPAY_WEBHOOK_SECRET` mismatch; the body must reach the app unmodified            |
| Emails show FAILED in Admin → Emails                           | Use **Send test email**; check `SMTP_*` (Gmail needs an App Password, port 587 + `SMTP_SECURE=false`); then **Resend** |
| `self-signed certificate in certificate chain`                 | Handled automatically for `sslmode=require`; for full verification set `DATABASE_CA_CERT` to Aiven's CA PEM |
| Uploaded images vanish after deploy                            | Local storage on Render is ephemeral — switch to `STORAGE_PROVIDER=s3`                |
| Instagram sync fails with 190                                  | Token expired; generate a new long-lived token                                        |

---

Reference material used for the property description: the owner's MakeMyTrip listing, the
[Instagram account](https://www.instagram.com/asl_bhavan_homestay/) and the
[Google Maps location](https://maps.app.goo.gl/NL45YLWuZRsR66wMA). All of it is editable in
Admin → Settings.
