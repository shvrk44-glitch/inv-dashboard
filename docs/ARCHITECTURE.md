# Inventory Hub — Architecture Specification

This document details the architectural decisions, storage guarantees, failure modes, and security posture of Inventory Hub.

---

## 1. Storage & Persistence Gate

### Where Does Data Actually Live?
Data does **not** live in browser `localStorage`. Relying solely on client-side storage is unacceptable for a multi-user inventory system where shop-floor staff, warehouse managers, and procurement officers access stock counts concurrently on different devices.

**Storage Architecture:**
- **Primary Source of Truth**: A server-side durable data store managed by the Express backend (`/server/data/inventory_db.json`).
- **Atomic Disk Writes**: Every mutation (stock count adjustment, new SKU addition, PO creation, status change, and receipt) is written to a temporary swap file (`inventory_db.json.tmp`) and atomically renamed via `fs.renameSync`. This prevents partial write corruption if the server process terminates abruptly.
- **Client Cache Synchronization**: The React frontend fetches state from the REST API (`/api/items`, `/api/orders`, `/api/zapier/settings`, `/api/zapier/logs`). When offline or recovering from connection loss, the client uses an offline fallback cache and displays a visible connection status banner.
- **Data Longevity**: Data survives server restarts, browser cache wipes, container reboots, and multi-device access.

---

## 2. Secrets & Configuration Management

### Where Do Secrets & Webhook URLs Live?
All configuration and notification routes are managed server-side via environment variables:
- `NOTIFICATION_RECIPIENT_EMAIL`: The default email address to receive purchase order notifications (e.g. `procurement@yourcompany.com`). Seeded from `process.env.NOTIFICATION_RECIPIENT_EMAIL`.
- `ZAPIER_WEBHOOK_URL`: The production Zapier Catch Hook endpoint. Seeded from `process.env.ZAPIER_WEBHOOK_URL`.
- `PORT`: Hardcoded to port `3000` to conform to Cloud Run reverse-proxy container routing.

**Security Constraints:**
- No personal email addresses (e.g., `neurosync44@gmail.com`) or live webhook URLs are hardcoded in git or client bundles.
- Webhook dispatch requests (`POST /api/zapier/send`) validate that the target endpoint begins with `https://` to prevent Localhost/SSRF attacks against internal networks.
- `.gitignore` explicitly ignores `.env` and all `.env.*` variants except `.env.example`.

---

## 3. Resilience & Failure Modes

### What Happens When the Zapier Webhook Is Down or Times Out?
1. **Purchase Order Creation Is Uncoupled From Webhook Delivery**:
   - A Purchase Order is generated and committed to the durable database **before** any network call to Zapier is attempted.
   - Even if Zapier is down, DNS fails, or the network times out, the Purchase Order is **never lost**.
2. **Strict Request Timeout**:
   - The backend enforces an 8,000ms (`8s`) timeout using an `AbortController`. If Zapier does not respond within 8 seconds, the request is aborted.
3. **Honest Status Reporting**:
   - The PO status transitions to `dispatch_failed` (or remains `draft`), with `zapierStatus: 'failed'` and `zapierHttpCode: 504`.
   - The failure is appended to the persistent audit log with the exact error message and payload.
   - The UI displays an honest warning toast: *"PO-YYYY-XXXX created successfully — notification delivery failed (will retry)"*.
   - Staff can click **"Retry Webhook"** on any failed or pending PO at any time.

### What Happens When Simulation Mode Is Active?
- If no webhook URL is configured (or if the URL is set to an empty string / test domain), the system enters **Simulation Mode**.
- The PO is created normally, but instead of sending an external HTTP request, the backend performs a comprehensive schema validation check on the payload and records a `simulated` log with HTTP code `200`.
- The user interface displays a prominent **"SIMULATION MODE ACTIVE"** badge to prevent staff from mistaking test runs for live supplier transmissions.

---

## 4. Concurrency & Integrity Controls

### Race Conditions & Atomic Counters:
- **Atomic Stock Adjustments**: The endpoint `PATCH /api/items/:id/adjust` accepts a delta or absolute count and updates the database in a synchronized critical section. Negative stock is strictly bounded (`Math.max(0, newQty)`).
- **Atomic PO Numbers**: Purchase Order numbers (`PO-YYYY-XXXX`) are allocated by an atomic server-side sequence counter persisted in the database. Two staff members creating POs at the same millisecond will never receive colliding numbers.
- **Financial Arithmetic**: All line item costs, taxes, and totals are computed using integer cents (`Math.round(cost * 100)`) and divided back to 2 decimal places to prevent IEEE 754 floating-point drift.
