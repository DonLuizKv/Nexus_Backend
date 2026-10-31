# Nexus API contract (v1)

Contract between the Nexus SvelteKit frontend and this backend. It replaces the mock data in
`Nexus/src/lib/entries/{seed,library.svelte,simulate}.ts` and `Nexus/src/lib/auth.svelte.ts`.
The data model behind it is in `src/providers/db/schema/` and `db/schema.sql`.

## 1. Conventions

- Base URL: `{BACKEND_URL}/api/v1`. All bodies are JSON (`Content-Type: application/json`, UTF-8)
  except file uploads (`multipart/form-data`).
- Successful responses return the resource itself, with no wrapper. Lists use the page shape in
  section 4.
- Timestamps are ISO 8601 strings in UTC (`2026-10-21T18:40:00.000Z`).
- Public keys: users are addressed by `handle`, entries by `slug`, comments by `id` (UUID v4).
  Internal user and entry ids are never returned.
- `204 No Content` responses have no body.
- Every response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`. Caching happens
  server-side in Redis and is invisible to clients. Search engines should index the frontend
  pages, not the API.

## 2. Authentication, cookies and CSRF

### Cookies set by the API

| Cookie       | Content                              | Flags                                                                   | Lifetime |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------- | -------- |
| `nexus_at`   | Access JWT (HS256, `sub` = user id)  | `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`             | 15 min   |
| `nexus_rt`   | Opaque refresh token (256-bit random) | `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/api/v1/auth` | 30 days  |
| `nexus_csrf` | Signed CSRF token                    | `Secure` in production, `SameSite=Lax`, `Path=/` (readable by JS)        | session  |

`SameSite` and the cookie `Domain` are configurable (`COOKIE_SAMESITE`, `COOKIE_DOMAIN`). The
recommended deployment puts frontend and API on the same site (for example `nexus.app` and
`api.nexus.app`) so `Lax` works. If they end up on different sites, `SameSite=None; Secure` is
required.

Tokens are never returned in response bodies and never accepted from `Authorization` headers or
query strings.

### Session lifecycle

1. `POST /auth/register` or `POST /auth/login` sets `nexus_at` and `nexus_rt`.
2. When a request fails with `401` and `code: "TOKEN_EXPIRED"`, call `POST /auth/refresh` once and
   retry the original request. Any other `401` means "signed out".
3. Each refresh rotates the refresh token: the old one is revoked and a new one is issued in the
   same family. Presenting an already-rotated refresh token revokes the whole family (every device
   that descends from that login) and returns `401 SESSION_REVOKED`.
4. `POST /auth/logout` revokes the current refresh token and clears all three cookies.

Passwords are hashed with argon2id.

### CSRF

Every unsafe request (`POST`, `PUT`, `PATCH`, `DELETE`), including login and register, must:

- send the header `X-CSRF-Token` with the value returned by `GET /auth/csrf`, which must match the
  `nexus_csrf` cookie and carry a valid server signature;
- come from an allowed origin: the `Origin` header (or `Referer` when `Origin` is absent) must be
  one of `ORIGINS`.

Otherwise the API answers `403 CSRF_INVALID` or `403 ORIGIN_NOT_ALLOWED`. The frontend calls
`GET /auth/csrf` once on startup and keeps the token in memory. After logout or a
`403 CSRF_INVALID` it fetches a new one.

### CORS

Only the origins listed in `ORIGINS` get CORS headers, always with
`Access-Control-Allow-Credentials: true`. Browser calls must use `credentials: 'include'`. Allowed
request headers: `Content-Type`, `X-CSRF-Token`.

### Calls from the SvelteKit server (SSR)

`Nexus/src/lib/server/api/client.ts` runs on the SvelteKit server. For SSR calls:

- Public reads (entry pages, search, profiles) can be made without cookies. This is what search
  engines see.
- To act on behalf of a signed-in user, the SvelteKit server must forward the browser's `Cookie`
  and `X-CSRF-Token` headers, send an allowed `Origin`, and copy any `Set-Cookie` from the API
  response back to the browser.
- Send the visitor's IP in `X-Forwarded-For`. The API trusts that header only from the addresses
  in `TRUST_PROXY`. Without it every SSR visitor shares the SvelteKit server's IP and hits the
  per-IP rate limits together.

## 3. Errors

Every error uses the same shape and an HTTP status that matches `code`:

```json
{
  "message": "Human-readable English description, for logs and fallback display",
  "code": "VALIDATION_ERROR",
  "fields": { "handle": "taken", "files[1].path": "unsafe_path" }
}
```

`fields` only appears on `422` and `409`. Its keys are body paths and its values are stable codes.
The frontend shows localized text based on `code` and the field codes, not on `message`.

| Status | `code`                   | When                                                                 |
| ------ | ------------------------ | -------------------------------------------------------------------- |
| 400    | `BAD_REQUEST`            | Malformed JSON, unknown query parameter values, invalid cursor       |
| 401    | `UNAUTHENTICATED`        | No valid session on an endpoint that needs one                       |
| 401    | `TOKEN_EXPIRED`          | Access token expired; refresh and retry                              |
| 401    | `SESSION_REVOKED`        | Refresh token missing, expired, revoked or reused                    |
| 401    | `INVALID_CREDENTIALS`    | Login failed (same answer for unknown user and wrong password)       |
| 403    | `CSRF_INVALID`           | Missing or wrong `X-CSRF-Token`                                      |
| 403    | `ORIGIN_NOT_ALLOWED`     | `Origin`/`Referer` not in `ORIGINS`                                  |
| 403    | `FORBIDDEN`              | Signed in but not allowed (for example, editing someone else's entry) |
| 403    | `BOT_BLOCKED`            | Request rejected by the bot heuristics (section 5)                   |
| 404    | `NOT_FOUND`              | Missing, or exists but the caller may not see it                     |
| 409    | `CONFLICT`               | Unique value already used (`fields.handle` or `fields.email` = `taken`) |
| 413    | `PAYLOAD_TOO_LARGE`      | Body or file over the limit                                          |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | Upload is not an allowed text file                                   |
| 422    | `VALIDATION_ERROR`       | Body failed validation; see `fields`                                 |
| 429    | `RATE_LIMITED`           | Too many requests; see `Retry-After`                                 |
| 502    | `AI_PROVIDER_ERROR`      | The AI provider failed or timed out (section 9)                      |
| 500    | `INTERNAL_ERROR`         | Unexpected server error                                              |

Field codes: `required`, `invalid`, `too_short`, `too_long`, `too_many`, `duplicate`, `taken`,
`unsafe_path`, `env_file`, `secret_detected`, `not_text`.

## 4. Pagination

List endpoints use cursor pagination:

- Query: `limit` (default 20, maximum 50; larger values are clamped to 50) and `cursor` (opaque
  string from a previous page).
- Response: `{ "items": [...], "nextCursor": "string" | null }`. `null` means there are no more pages.

There are no total counts and no offset or page numbers, so the catalogue can't be walked by page
number. Aggregate counts for the filters come from `GET /entries/stats`.

## 5. Rate limits and anti-scraping

Limits are enforced in Redis with `rate-limiter-flexible`. Values are defaults and can be tuned by
env. A `429` response includes `Retry-After` (seconds).

| Scope                                     | Key                     | Default             |
| ----------------------------------------- | ----------------------- | ------------------- |
| Any request                               | IP                      | 300 / 5 min         |
| Any request with a session                | user                    | 600 / 5 min         |
| `GET /entries` (list and search)          | IP                      | 60 / min            |
| `POST /auth/login`                        | IP + identifier         | 5 / 15 min          |
| `POST /auth/register`                     | IP                      | 5 / hour            |
| `POST /auth/refresh`                      | IP                      | 30 / 15 min         |
| Entry writes (create, update, delete)     | user                    | 30 / hour           |
| `POST /entries/:slug/comments`            | user                    | 10 / 10 min         |
| `POST /entries/:slug/files`               | user                    | 20 / hour           |
| `POST /ai/run`                            | user / IP               | 10 / min and 100 / day per user; 30 / hour per IP |

`POST /entries/:slug/uses` is not rate-limited with a `429`. Repeated calls for the same entry from
the same user (or IP when signed out) within 24 hours are accepted and not counted.

Other measures:

- Every endpoint that returns private data requires a session: email, starred list, your own
  unlisted and burn entries, and Probar.
- Unlisted and burn entries are only reachable by their slug, which ends in 10 random base-36
  characters (about 3.6 × 10^15 combinations). They never appear in lists, search, counts,
  profiles, the webring, `random` or realtime events.
- Requests for entries the caller may not see return `404` (never `403`) so existence isn't revealed.
- Responses carry only the fields listed in section 6. List items never include file contents or
  comments.
- Security headers on every response: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and
  `Strict-Transport-Security` in production.
- Bot heuristics: requests with no `User-Agent`, or with a `User-Agent` on a configurable denylist
  of scraping tools and headless browsers (`BOT_UA_DENYLIST`), get `403 BOT_BLOCKED` on list,
  search and detail endpoints. Clients that exceed list limits repeatedly are blocked for longer
  periods.

What this does not do: anything the site shows publicly to anonymous visitors (public entries,
public profiles) can still be copied by a determined scraper that behaves like a browser, as with
any website. These measures keep private data behind authentication and make bulk copying of
public content slow and noisy. They cannot make public content unscrapeable.

## 6. Types

```ts
type Kind = 'prompt' | 'skill' | 'agent' | 'settings' | 'context';
type Visibility = 'public' | 'unlisted' | 'burn';
type CategoryId = 'escritura' | 'codigo' | 'imagen' | 'datos' | 'aprendizaje' | 'negocio';

/** Ids for the frontend TARGETS list. The frontend keeps the labels and translations. */
type AiTarget =
  | 'chatgpt'      // ChatGPT
  | 'claude'       // Claude
  | 'gemini'       // Gemini
  | 'llama'        // Llama
  | 'midjourney'   // Midjourney
  | 'claude-code'  // Claude Code
  | 'cursor'       // Cursor
  | 'kiro'         // Kiro
  | 'copilot'      // Copilot
  | 'codex';       // Codex

interface Page<T> { items: T[]; nextCursor: string | null }

/** Public view of a person. */
interface Author { handle: string; name: string }

interface Profile extends Author {
  bio: string;
  joinedAt: string;
}

/** Only ever returned to the account owner. */
interface Me extends Profile {
  email: string;
}

interface UserProfile extends Profile {
  /** Totals over the user's public entries. */
  stats: { entries: number; stars: number; uses: number; kinds: Partial<Record<Kind, number>> };
}

interface EntryFile {
  path: string;      // relative POSIX path, the first file is the main one
  content: string;   // UTF-8 text
  sizeBytes: number;
}

/** List and card shape. No file contents, no comments. */
interface EntrySummary {
  slug: string;
  kind: Kind;
  title: string;
  summary: string;
  category: CategoryId;
  tags: string[];
  targets: AiTarget[];
  author: Author;
  visibility: Visibility;
  mainFile: string;      // path of files[0]
  fileCount: number;
  stars: number;
  uses: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Detail shape. */
interface Entry extends EntrySummary {
  files: EntryFile[];
  /** Webring neighbours among public entries; null for non-public entries or when there are fewer than 2. */
  ring: { prev: { slug: string; title: string }; next: { slug: string; title: string } } | null;
  viewer: { isOwner: boolean; starred: boolean };
}

/** Returned instead of Entry when a non-owner opens a burn link. Nothing is consumed yet. */
interface SealedEntry {
  sealed: true;
  slug: string;
  kind: Kind;
  visibility: 'burn';
}

interface Comment {
  id: string;
  author: Author;
  message: string;
  createdAt: string;
}

/** Create and update body. Same fields as the frontend EntryDraft, with target ids. */
interface EntryDraft {
  kind: Kind;
  title: string;          // trimmed, 4..90 chars
  summary: string;        // trimmed, 0..200 chars
  category: CategoryId;
  tags: string[];         // 0..8, each trimmed, lowercased, 1..30 chars, unique
  targets: AiTarget[];    // 1..10, unique
  visibility: Visibility;
  files: { path: string; content: string }[]; // 1..12
}
```

File rules (same as `Nexus/src/lib/entries/bundle.ts`, enforced again on the server):

- `path`: relative POSIX path of safe segments (`[A-Za-z0-9_.-]` separated by `/`), no `..`, no
  leading `/`, at most 255 chars, unique within the entry (`unsafe_path`, `duplicate`).
- Real env files (`.env`, `.env.local`, ...) are rejected (`env_file`). `.env.example`,
  `.env.sample` and `.env.template` are allowed.
- `content`: 1..200,000 bytes of UTF-8 without NUL bytes (`required`, `too_long`, `not_text`).
- Content that matches common credential patterns (OpenAI/Anthropic, GitHub, AWS, Google, Slack
  keys, PEM private keys) is rejected (`secret_detected`).

## 7. Endpoints

`Auth` column: `none` = anonymous allowed, `optional` = anonymous allowed and the session changes
the result, `required` = `401` without a session.

### Health

| Method | Path      | Auth | Response               |
| ------ | --------- | ---- | ---------------------- |
| GET    | `/health` | none | `200 { "status": "ok" }` |

### Auth

| Method | Path             | Auth     | Body                                                  | Response                                 |
| ------ | ---------------- | -------- | ----------------------------------------------------- | ---------------------------------------- |
| GET    | `/auth/csrf`     | none     | none                                                  | `200 { csrfToken: string }` + `nexus_csrf` cookie |
| POST   | `/auth/register` | none     | `{ name, handle, email, password }`                   | `201 Me` + session cookies               |
| POST   | `/auth/login`    | none     | `{ identifier, password }` (handle or email)          | `200 Me` + session cookies               |
| POST   | `/auth/refresh`  | cookie `nexus_rt` | none                                         | `204` + rotated cookies                  |
| POST   | `/auth/logout`   | optional | none                                                  | `204`, cookies cleared                   |

Register validation:

- `handle`: lowercased, `^[a-z0-9._-]{3,20}$` (`invalid`), unique (`409`, `taken`).
- `email`: trimmed, lowercased, valid address, at most 254 chars, unique (`409`, `taken`).
- `name`: trimmed, 1..60 chars. If it's empty, the handle is used.
- `password`: 8..128 chars (`too_short`, `too_long`).

Saying that an email is already taken reveals that the account exists. The current UI does this,
so the API keeps it, and the register rate limit is what limits probing. Login never reveals it:
both failure cases return `401 INVALID_CREDENTIALS`.

The mock "Entrar como invitado" (guest) account is not part of the API. It was a demo-only shortcut.

### Me (signed-in user)

| Method | Path          | Auth     | Query / Body                                     | Response              |
| ------ | ------------- | -------- | ------------------------------------------------ | --------------------- |
| GET    | `/me`         | required |                                                  | `200 Me`              |
| PATCH  | `/me`         | required | `{ name?: string (1..60), bio?: string (0..160) }` | `200 Me`            |
| GET    | `/me/entries` | required | `limit`, `cursor`                                | `200 Page<EntrySummary>`: all your entries, any visibility, newest `updatedAt` first |
| GET    | `/me/stars`   | required | `limit`, `cursor`                                | `200 Page<EntrySummary>`: entries you starred, most recent star first. Entries that are no longer visible to you are omitted |

### Users (public profiles)

| Method | Path                     | Auth | Query             | Response                                                     |
| ------ | ------------------------ | ---- | ----------------- | ------------------------------------------------------------ |
| GET    | `/users/:handle`         | none |                   | `200 UserProfile` or `404`                                   |
| GET    | `/users/:handle/entries` | none | `limit`, `cursor` | `200 Page<EntrySummary>`: public entries only, newest `updatedAt` first |

### Entries

| Method | Path                     | Auth     | Query / Body | Response |
| ------ | ------------------------ | -------- | ------------ | -------- |
| GET    | `/entries`               | none     | see below    | `200 Page<EntrySummary>` (public only) |
| GET    | `/entries/stats`         | none     |              | `200 { total: number, kinds: Record<Kind, number>, categories: Record<CategoryId, number> }` over public entries |
| GET    | `/entries/random`        | none     | `exclude?: slug` | `200 { slug }` of a random public entry, or `404` if none |
| GET    | `/entries/:slug`         | optional |              | `200 Entry`, `200 SealedEntry` (burn, not owner) or `404` |
| POST   | `/entries/:slug/reveal`  | none     | none         | `200 Entry`. Burn entries only: returns the entry and deletes it in the same transaction. A second call returns `404` |
| POST   | `/entries`               | required | `EntryDraft` | `201 Entry` |
| PUT    | `/entries/:slug`         | required (owner) | `EntryDraft` (full replace) | `200 Entry` (check `slug`, it may change) |
| DELETE | `/entries/:slug`         | required (owner) |      | `204` |

`GET /entries` query (all optional; unknown values give `400`):

| Param      | Values                                           | Notes |
| ---------- | ------------------------------------------------ | ----- |
| `q`        | 1..100 chars                                     | Accent- and case-insensitive match on title, summary, tags and author handle. Every term must match. File contents are not searched |
| `kind`     | `Kind`                                           | |
| `category` | `CategoryId`                                     | |
| `target`   | `AiTarget`                                       | Entries that list this target |
| `sort`     | `relevance` (default when `q` is set), `recent` (default otherwise), `stars`, `uses` | `relevance` ranks title matches above other matches, then stars |
| `limit`, `cursor` | see section 4                             | |

Home page mapping: "Recientes" is `sort=recent&limit=6`, "Más usados" is `sort=uses&limit=4`, and
the activity ticker is `sort=recent&limit=8` plus the realtime event in section 8.

Slugs:

- Public entries get the slugified title (`[a-z0-9-]`, at most 60 chars), with `-2`, `-3`, ... added
  on collision.
- Unlisted and burn entries get the slugified title plus `-` and 10 random base-36 characters.
- Changing the title doesn't change the slug. Switching an entry from `public` to `unlisted` or
  `burn` assigns a new random-suffixed slug, so the old public link stops working. Switching back
  to `public` keeps the current slug. Clients must navigate using the `slug` in the response.

Burn entries:

- The owner sees them as a normal `Entry` and doesn't consume them.
- Anyone else gets `SealedEntry` from `GET /entries/:slug` and must call
  `POST /entries/:slug/reveal` to read it (the "Abrir y destruir" button). After that the slug
  returns `404`.
- Burn entries can't be starred, commented or counted as used.

### Stars, uses and comments

| Method | Path                         | Auth     | Body / Query        | Response |
| ------ | ---------------------------- | -------- | ------------------- | -------- |
| PUT    | `/entries/:slug/star`        | required | none                | `200 { starred: true, stars: number }` (idempotent) |
| DELETE | `/entries/:slug/star`        | required | none                | `200 { starred: false, stars: number }` (idempotent) |
| POST   | `/entries/:slug/uses`        | optional | none                | `200 { uses: number }`. Call it after "Copiar" or a download |
| GET    | `/entries/:slug/comments`    | none     | `limit`, `cursor`   | `200 Page<Comment>`, newest first |
| POST   | `/entries/:slug/comments`    | required | `{ message: string }` (trimmed, 1..500 chars) | `201 Comment` |

These endpoints work on entries the caller can see (public, or unlisted with the slug) and return
`404` otherwise.

### Entry file uploads

| Method | Path                    | Auth             | Body                  | Response |
| ------ | ----------------------- | ---------------- | --------------------- | -------- |
| POST   | `/entries/:slug/files`  | required (owner) | `multipart/form-data` | `201 { files: EntryFile[] }`: the entry's full file list after the upload |

- Field `files`: one or more files. The entry can't exceed 12 files in total (`422`,
  `fields.files = "too_many"`).
- Optional field `paths`: repeated once per file, in the same order, with the target path. Use it
  to keep folders from `webkitRelativePath`. If it's absent, the sanitized file name is used.
- Each file must be at most 200 KB (`413`), valid UTF-8 without NUL bytes, and have an allowed text
  extension (`.md`, `.mdc`, `.txt`, `.json`, `.jsonc`, `.yml`, `.yaml`, `.toml`, `.ts`, `.js`,
  `.mjs`, `.py`, `.sh`, `.ps1`, `.sql`) or be a known extensionless config file such as
  `.cursorrules`. Anything else gets `415`. The path and secret rules from section 6 apply.
- If an uploaded path already exists in the entry, the upload replaces that file.

File contents are stored through a storage interface, which today writes to the backend's local
`uploads/` folder. `POST /entries` and `PUT /entries/:slug` also accept contents inline in
`EntryDraft.files`, which is what the editor uses for typed and pasted files.

### AI targets and Probar

| Method | Path          | Auth     | Body | Response |
| ------ | ------------- | -------- | ---- | -------- |
| GET    | `/ai/targets` | none     |      | `200 { items: AiTargetInfo[] }` |
| POST   | `/ai/run`     | required | `{ target: AiTarget, prompt: string }` | `200 AiRunResult`, or an error |

See section 9.

## 8. Realtime (socket.io)

Realtime is used only for live updates. Everything is also available over HTTP.

- Same host as the API, default path `/socket.io`. Connect with `withCredentials: true`.
- The handshake is authenticated with the `nexus_at` cookie, and its `Origin` must be in `ORIGINS`.
  Without a valid session the connection fails with `connect_error` and
  `err.message === "UNAUTHENTICATED"`. Anonymous visitors use HTTP only. After a token refresh,
  reconnect to pick up the new cookie.
- Events are rate-limited per socket. Clients that flood are disconnected.

| Direction        | Event                     | Payload |
| ---------------- | ------------------------- | ------- |
| server → client  | `activity:entry`          | `{ entry: EntrySummary }` when an entry becomes public (created or switched to public) |
| client → server  | `entry:join`              | `{ slug }`, ack `{ ok: boolean }`. Joining a slug you can't see acks `{ ok: false }` |
| client → server  | `entry:leave`             | `{ slug }` |
| server → client  | `comment:created`         | `{ slug, comment: Comment }` to sockets that joined `slug` |
| server → client  | `entry:stats`             | `{ slug, stars, uses, commentsCount }` to sockets that joined `slug` |

## 9. Probar (run a prompt against an AI)

The frontend fills the variables (as `TestBench.svelte` already does) and sends the final text.
The server sends it as a single user message to the real provider and returns the provider's real
reply. There are no simulated replies. When the provider can't be called, the server returns a
fallback that the frontend uses to open that AI's site with the prompt ready to send.

### Targets

| Target id     | Called through                                          | Enabled by env                                   | Fallback URL                       | Prefilled |
| ------------- | ------------------------------------------------------- | ------------------------------------------------ | ---------------------------------- | --------- |
| `chatgpt`     | OpenAI Chat Completions API                             | `OPENAI_API_KEY` (+ `OPENAI_MODEL`)              | `https://chatgpt.com/?q={prompt}`  | yes       |
| `claude`      | Anthropic Messages API                                  | `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`)        | `https://claude.ai/new?q={prompt}` | yes       |
| `gemini`      | Google Gemini API (`generateContent`)                   | `GEMINI_API_KEY` (+ `GEMINI_MODEL`)              | `https://gemini.google.com/app`    | no        |
| `llama`       | Any OpenAI-compatible host serving Llama (Groq, Together, OpenRouter, ...) | `LLAMA_API_KEY` + `LLAMA_BASE_URL` (+ `LLAMA_MODEL`) | `https://www.meta.ai/` | no |
| `midjourney`  | No public API: fallback only                            | none                                             | `https://www.midjourney.com/imagine` | no      |
| `claude-code` | Coding tool, runs in the user's terminal: fallback only | none                                             | `https://claude.ai/new?q={prompt}` | yes       |
| `codex`       | Coding tool: fallback only                              | none                                             | `https://chatgpt.com/?q={prompt}`  | yes       |
| `copilot`     | Coding tool: fallback only                              | none                                             | `https://github.com/copilot`       | no        |
| `cursor`      | Editor: fallback only                                   | none                                             | `https://cursor.com/`              | no        |
| `kiro`        | Editor: fallback only                                   | none                                             | `https://kiro.dev/`                | no        |

`{prompt}` is the URL-encoded prompt. If the resulting URL would be longer than 8,000 characters,
the server returns the base URL with `prefilled: false`. When `prefilled` is `false`, the frontend
copies the prompt to the clipboard before opening the URL and tells the user to paste it.

API keys are read from env only and never sent to the client. Output length is capped by
`AI_MAX_OUTPUT_TOKENS`, and provider calls time out after `AI_TIMEOUT_MS`.

### `GET /ai/targets`

Lets the UI tell in advance whether a target runs in place or redirects, and build the fallback
for anonymous visitors (who get `401` from `/ai/run`).

```ts
interface AiTargetInfo {
  id: AiTarget;
  mode: 'api' | 'fallback';  // 'api' only when the provider key is configured
  fallback: {
    url: string;               // base URL without the prompt
    prefillParam: 'q' | null;  // append ?{prefillParam}={encoded prompt} when not null
  };
}
```

### `POST /ai/run`

Request:

```json
{ "target": "claude", "prompt": "Eres un revisor de código senior..." }
```

- `target`: an `AiTarget` (`422 invalid` otherwise).
- `prompt`: 1..20,000 characters after trimming (`required`, `too_long`).

Response `200`:

```ts
type AiRunResult =
  | {
      mode: 'api';
      target: AiTarget;
      provider: 'openai' | 'anthropic' | 'google' | 'llama';
      model: string;        // model id that produced the reply
      output: string;       // the provider's reply text, unmodified
      truncated: boolean;   // true when the reply hit AI_MAX_OUTPUT_TOKENS
    }
  | {
      mode: 'fallback';
      target: AiTarget;
      reason: 'no_api_key' | 'no_api';  // key not configured / target has no API
      fallback: { url: string; prefilled: boolean };
    };
```

Example when no key is configured for the target:

```json
{
  "mode": "fallback",
  "target": "claude",
  "reason": "no_api_key",
  "fallback": { "url": "https://claude.ai/new?q=Eres%20un%20revisor...", "prefilled": true }
}
```

Errors: `401` (signed out), `422`, `429` (Probar limits in section 5), and `502 AI_PROVIDER_ERROR`
when the provider fails or times out. The `502` body includes the fallback, so the frontend can
offer the redirect:

```json
{
  "message": "The AI provider did not answer in time",
  "code": "AI_PROVIDER_ERROR",
  "fallback": { "url": "https://chatgpt.com/?q=...", "prefilled": true }
}
```

The reply comes back as a single JSON response, not streamed. The frontend shows a loading state
while it waits, and its "Detener" button aborts the `fetch`.

## 10. Differences from the mocks

- Target ids replace display names (`"Claude Code"` becomes `"claude-code"`). Labels stay in the
  frontend.
- `author` is an `Author` object instead of a handle string, and `comments` moved to their own
  paginated endpoint (`commentsCount` is on the entry).
- Search no longer looks inside file contents.
- Lists are paginated (maximum 50 per page) instead of returning the whole library.
- Unlisted and burn slugs carry a random suffix. Burn entries are revealed with `POST .../reveal`.
- No guest account.
- `simulate.ts` is replaced by `POST /ai/run`.
