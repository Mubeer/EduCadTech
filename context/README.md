# EduCadTech Context Directory

Welcome to the **EduCadTech** Context directory. This folder contains the architectural specifications, technical guidelines, coding constraints, and operational runbooks for the project.

---

## Document Index

| Document | Description |
| :--- | :--- |
| **[PROJECT_CONTEXT.md](file:///c:/Users/moham/OneDrive/Desktop/Project%202/context/PROJECT_CONTEXT.md)** | **Master Document**: Comprehensive single-source-of-truth covering project overview, tech stack, database schema, API reference, business rules, and runbook. |
| **[architecture.md](file:///c:/Users/moham/OneDrive/Desktop/Project%202/context/architecture.md)** | **System Architecture**: Detailed client-server structure, data flow, component breakdown, security model, and transaction lifecycles. |
| **[tech_stack.md](file:///c:/Users/moham/OneDrive/Desktop/Project%202/context/tech_stack.md)** | **Technology Stack**: Libraries, exact dependency versions, environment variables, npm scripts, and directory responsibilities. |
| **[coding_guidelines.md](file:///c:/Users/moham/OneDrive/Desktop/Project%202/context/coding_guidelines.md)** | **Coding Conventions**: Coding style constraints, SQL safety rules, REST API response envelope standards, and frontend styling conventions. |
| **[workflows.md](file:///c:/Users/moham/OneDrive/Desktop/Project%202/context/workflows.md)** | **Operational Workflows**: Step-by-step developer setup, registration & checkout flow, certificate generation & QR verification, admin runbook, and testing instructions. |

---

## Quick Reference Summary

- **App URL:** `http://localhost:3000`
- **Admin Portal:** `http://localhost:3000/admin` (Default: `admin` / `admin123`)
- **Student Certificate Portal:** `http://localhost:3000/certificate.html`
- **Public Certificate Verification:** `http://localhost:3000/verify.html`
- **Database:** SQLite at `db/database.sqlite` (accessed synchronously via `better-sqlite3` in WAL mode)
- **Start Command:** `npm run dev` (Node `--watch`) or `npm start`
