# Coding Style Constraints & Engineering Conventions

This document outlines the coding standards, style rules, security guidelines, and design constraints for any developer or AI agent modifying or extending **EduCadTech**.

---

## 1. Core Engineering Principles

1. **Simplicity over Over-Engineering:**
   - Avoid adding heavy dependencies, transpilers, or frontend frameworks unless strictly required.
   - Maintain pure Vanilla JS, HTML, and CSS for client-side pages to preserve instant load times and zero-build operation.

2. **Database Integrity & SQL Injection Prevention:**
   - **Always** use parameterized queries with `better-sqlite3`.
   - **Never** interpolate variables directly into SQL queries using template literals (`SELECT * FROM table WHERE id = ${id}`).
   - Example (Standard):
     ```javascript
     // Correct:
     const user = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

     // Incorrect:
     const user = db.prepare(`SELECT * FROM admins WHERE username = '${username}'`).get();
     ```

3. **Consistent RESTful API Envelope:**
   - Every API endpoint returning JSON should adhere to the standard envelope structure:
     ```json
     // Success Response (HTTP 200 / 201)
     {
       "success": true,
       "message": "Optional descriptive confirmation",
       "data": { ... }
     }

     // Error Response (HTTP 400 / 401 / 403 / 404 / 500)
     {
       "success": false,
       "error": "Descriptive error message for the client"
     }
     ```

4. **Date Formatting Conventions:**
   - Store all business dates in ISO 8601 calendar format: `YYYY-MM-DD` (e.g. `2026-10-21`).
   - Use standard ISO timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`) for audit timestamps.

5. **Identifier Naming Conventions:**
   - **Registration Code:** `REG-YYYY-XXXXX` (e.g., `REG-2026-10001`).
   - **Certificate Number:** `ECT-YYYY-XXXXX` (e.g., `ECT-2026-00101`).
   - **Transaction Reference:** `TXN-DEMO-XXXXXX` (or provider ref).

---

## 2. JavaScript / Node.js Standards

- **Syntax:** Modern ECMAScript 2022+ features (Arrow functions, `async`/`await`, Destructuring, Template literals).
- **Module Format:** CommonJS (`require` / `module.exports`) in the backend, ES6 browser scripts on the client.
- **Naming Conventions:**
  - Files: `camelCase.js` or `kebab-case.html`.
  - Functions & Variables: `camelCase` (e.g. `calculateEligibilityDate`, `studentName`).
  - Constants & Environment Variables: `UPPER_SNAKE_CASE` (e.g. `JWT_SECRET`, `API_BASE`).
  - Database Table Names: `snake_case` plural (e.g. `courses`, `registrations`, `certificates`).
  - Database Column Names: `snake_case` (e.g. `registration_source`, `payment_status`).
- **Error Handling:**
  - Always wrap asynchronous route handlers or file system access in `try/catch` blocks.
  - Avoid unhandled promise rejections.
  - Return clear, actionable status codes (`400 Bad Request`, `401 Unauthorized`, `404 Not Found`).

---

## 3. Frontend & CSS Standards

1. **CSS Token Reuse:**
   - Maintain the design palette consistent with the institute's branding:
     - Primary Crimson/Ruby: `#ac192b`
     - Secondary Navy: `#1a2942`
     - Accent Gold: `#c49b38`
     - Success Green: `#16a34a` / `#10b981`
     - Alert Red: `#dc2626`
     - Neutral Slates: `#1e293b`, `#64748b`, `#f8fafc`
2. **Responsive Mobile-First Viewports:**
   - All interactive controls (modals, forms, buttons) must support mobile screens down to `360px` width.
   - Modals must include accessible close buttons and backdrop dismissals.
3. **Interactive Feedback:**
   - Disable submit buttons during pending network requests and provide visual loading spinners (`<i class="fa fa-spinner fa-spin"></i>`).
   - Display actionable alert banners for errors, validation warnings, and success feedback.

---

## 4. Security & Authentication Constraints

1. **Admin Routes Protection:**
   - Every administrative endpoint (`/api/admin/*`) must invoke `requireAdminAuth` middleware.
   - Do not transmit sensitive fields (e.g., `password_hash`) in JSON API responses.
2. **Student Privacy:**
   - Public certificate verification (`GET /api/certificates/verify/:certNum`) must only output verification metadata (student name, course title, start date, completion date, validity status). It must never expose student phone numbers, email addresses, or payment transaction IDs.
