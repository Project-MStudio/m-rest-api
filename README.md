# mRestApi

mRestApi is a lean, browser-honest HTTP API testing tool — a smaller alternative to Postman/Insomnia, built with Next.js (App Router) and deployable to Vercel. Unlike native API clients, mRestApi can send a request as a **real browser fetch from the page origin**, so CORS, preflight, and mixed-content behave exactly like they will in your React app — and when a request is blocked, it tells you the exact missing header and the fix line.

## Setup & run locally

```bash
cd m-rest-api
yarn install
yarn dev
```

Open http://localhost:3000. (Uses Yarn only — there is a `yarn.lock`, no `package-lock.json`.)

Build for production:

```bash
yarn build
yarn start
```

## Deploy to Vercel

### GitLab CI/CD → Vercel

Pipeline: **build** on every push/MR; **deploy** to Vercel when CI variables are set (see `.gitlab-ci.yml`).

1. **Vercel:** create/import project `mrestapi` (install: `yarn install`, build: `yarn build`). Add production env vars in the Vercel dashboard if you use Firebase sync.
2. **Link once locally** (needs [Vercel CLI](https://vercel.com/docs/cli)):

```bash
cd m-rest-api
npx vercel link
```

Copy `orgId` and `projectId` from `.vercel/project.json` (do not commit that folder).

3. **GitLab** → Project → **Settings → CI/CD → Variables** (masked, protected for production):

| Variable | Description |
|----------|-------------|
| `VERCEL_TOKEN` | [Account token](https://vercel.com/account/settings/tokens) |
| `VERCEL_ORG_ID` | From `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` → `projectId` |

Vercel CLI reads `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from these variable names automatically.

4. Push to `main` → pipeline runs `build`, then `deploy:production`. Merge requests get `build` + manual **deploy:preview** (optional).

Without `VERCEL_TOKEN`, only the **build** job runs (useful for verifying CI before linking Vercel).

### Manual import (no GitLab deploy)

1. Push this repo to GitLab.
2. In Vercel, **Import** the GitLab project (root = repo root).
3. Install command: `yarn install`. Build command: `yarn build` (defaults work).
4. (Optional) For cloud sync, add the public Firebase env vars below. **Without them the login button is hidden and the app runs fully local — no env vars required.**

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET          # optional
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID     # optional
```

The proxy and CORS-check are normal route handlers, so it deploys as-is.

## How to use

### Workspace tab
- Pick a **method**, type a **URL**, add **query params** and **headers** (toggle rows on/off), and set a **body** (None / JSON / Raw). JSON mode has a **Format** button and shows inline parse errors.
- **Mode toggle** on the request bar:
  - **Browser** — a real client-side `fetch()` from the page origin. CORS/preflight/mixed-content behave exactly like your React app. This is the headline feature.
  - **Server proxy** — the request is forwarded by a Next.js route (no CORS, like Postman). The proxy can also set headers the browser forbids (e.g. `User-Agent`).
- Every log entry is labeled with the mode used.

### CORS diagnostic
When a **Browser**-mode request fails with the opaque `TypeError: Failed to fetch`, mRestApi calls its `cors-check` route, inspects the target's `Access-Control-*` headers, and prints a plain verdict, e.g.:
- `CORS blocked: no Access-Control-Allow-Origin. Backend must add: Access-Control-Allow-Origin: <origin>`
- `CORS blocked: method PUT not in Access-Control-Allow-Methods`
- `CORS blocked: header authorization not in Access-Control-Allow-Headers`
- `Not CORS: server proxy also failed -> host down or wrong URL`

### Collections (export / import)
- **Save to collection** stores method/url/params/headers/body/mode under a named collection. The sidebar lists collections; click a request to load it into the builder.
- **Export** writes a documented `.json` (`{ version, collections: [...] }`); **Import** reads it back.
- Each saved request has **Copy as cURL**.
- Collections persist in `localStorage`. If you sign in (Firebase configured), they also mirror to Firestore and merge on login. The sidebar shows **Local only** vs **Synced as &lt;email&gt;**.

### Benchmark
Runs the current request N times (1–50), sequential and abortable, defaulting to **Server** mode. Shows min / avg / p50 / p95 / max, success rate, average size, and a simple bar distribution.

### FCM tab
A preset on top of the same engine:
- Enter a **Domain** (e.g. `http://103.109.101.226:7981`) and a **Match code**, and pick an **API version** (v1/v2/v3) — the live send path `/api/{version}/fcm/send` is shown. Version applies to **send** only.
- On match-code change (debounced 500ms) it decodes via the proxy: `GET https://opta-api.uniscore.vn/api/v1/decode/{code}` with `User-Agent: insomnia/11.0.2`. **The decode endpoint returns a plain id string**, not JSON; the decoded `matchId` is shown read-only.
- A grid of **22 event buttons** POSTs the editable sample body to `{domain}/api/{version}/fcm/send`, injecting the clicked `type` and the decoded `matchId`. Every call is logged.

## Why mRestApi beats Postman/Insomnia

- **They hide real CORS.** Postman/Insomnia send from a native context, so browser CORS never triggers — you get false confidence, then your React app breaks with "Failed to fetch". mRestApi's **Browser mode** is a true page-origin fetch, so it shows the truth.
- **They bury the missing header.** A failed browser request only says "Failed to fetch". mRestApi **names the exact missing `Access-Control-*` header and gives the fix line** to add on the backend.
- **They are heavy.** mRestApi is lean and fast: no UI kit, no state library, no chart library — just Next.js, Tailwind, and native APIs. Logs are capped (200 entries) and bodies are truncated (~256 KB), in-flight requests are aborted, and benchmarks are bounded loops, so it stays low-RAM in Chrome.
- **Forbidden headers.** Browsers block headers like `User-Agent`. mRestApi's **server proxy** sets them — which is exactly why the FCM decode call works here and fails in a plain browser fetch.

## Tech notes
- Next.js App Router (JavaScript), TailwindCSS theme in `tailwind.config.js`.
- Path aliases: `@/*`, `@lib/*`, `@components/*`, `@features/*`.
- Firebase is the only optional extra, dynamically imported and env-gated; the app never touches it when unconfigured.
