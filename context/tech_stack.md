# Technology Stack Details & Environment Specifications

This document defines the complete technology stack, library versions, hardware/runtime prerequisites, and directory responsibilities for **EduCadTech**.

---

## 1. Core Technology Stack

### 1.1 Backend Runtime & Libraries
- **Node.js**: `v18.0.0` or higher (tested on Node.js v18/v20/v22 LTS).
- **Express.js (`^5.3.0`)**: Minimalist web application framework for Node.js. Used for HTTP request parsing, routing, middleware chaining, and static directory serving.
- **better-sqlite3 (`^13.0.3`)**: Synchronous, zero-overhead SQLite3 library. Selected over asynchronous drivers (e.g. `sqlite3`) because SQLite handles local file I/O synchronously, resulting in cleaner code, reduced latency, and direct transaction handling.
- **jsonwebtoken (`^9.0.3`)**: Implementation of RFC 7519 JSON Web Tokens used for admin authorization.
- **bcryptjs (`^3.0.3`)**: Optimized Pure JavaScript Bcrypt implementation without external C++ compilation dependencies.
- **pdfkit (`^0.20.2`)**: PDF generation engine that outputs directly to standard Node readable streams.
- **qrcode (`^1.5.4`)**: QR code generator creating high-density vector or PNG data buffers.
- **cors (`^2.8.6`)**: Express middleware enabling Cross-Origin Resource Sharing.

### 1.2 Development & Testing Tools
- **Playwright (`^1.64.1`)**: End-to-end browser automation framework for Chromium, WebKit, and Firefox testing.
- **Node Watch Flag (`--watch`)**: Native Node.js file watcher for hot-restart development without third-party tools like `nodemon`.

### 1.3 Frontend Architecture
- **HTML5**: Semantic markup (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<dialog>`).
- **CSS3**: Vanilla CSS with custom property tokens (`--primary-color`, etc.), flexbox, CSS grid, and responsive media queries (`@media (max-width: 991px)`).
- **Client JavaScript**: Native ES6+ (Fetch API, Promises, `async`/`await`, `localStorage`, DOM manipulation). No bundler (Webpack, Vite, Rollup) required.

---

## 2. Environment Variables

The application operates with sensible local development defaults, but allows environment variable overrides via `process.env`:

| Variable | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Number | `3000` | Port on which the Express server listens |
| `JWT_SECRET` | String | `'educadtech_secret_key_demo_2026'` | HMAC secret key used for signing and verifying admin JWT tokens |
| `NODE_ENV` | String | `'development'` | Environment profile (`'development'` or `'production'`) |

---

## 3. NPM Scripts & Manifest

```json
{
  "name": "project-2",
  "version": "1.0.0",
  "description": "EduCadTech Training Institute and Certificate Registry",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

---

## 4. Key Directory Responsibilities

| Path | Purpose |
| :--- | :--- |
| `/` | Root static HTML pages (`index.html`, `courses.html`, `certificate.html`, `verify.html`, `about.html`, `contact.html`) |
| `/admin` | Single Page Application for platform administration (`index.html`, `login.html`, `admin.js`, `admin.css`) |
| `/assets` | Static fonts, vendor CSS styles, icons, and course imagery |
| `/context` | Canonical project context, architecture, tech stack, coding standards, and developer runbooks |
| `/db` | SQLite database schema, seeding procedures, and runtime `database.sqlite` file |
| `/images` | Institute logos, branding assets, header banners |
| `/js` | Modular client-side scripts (`enrollment.js`, `script.js`) |
| `/services` | Decoupled backend business services (`certificateGenerator.js`) |
