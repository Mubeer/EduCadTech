# Workflows, Developer Runbooks & Operational Guides

This document provides step-by-step procedures for local development, operational runbooks, user journeys, and testing workflows for **EduCadTech**.

---

## 1. Local Development Setup

### 1.1 Prerequisites
- **Node.js**: Version 18.0.0 or higher.
- **NPM**: Version 9.0.0 or higher.

### 1.2 Installation Steps
```bash
# Clone or navigate to the project directory
cd "Project 2"

# Install production and development dependencies
npm install
```

### 1.3 Running the Development Server
```bash
# Start in live-watch mode (restarts automatically upon changes to server.js or db files)
npm run dev
```
The server will bind to `http://localhost:3000`.

### 1.4 Database Initialization & Reset
The database engine automatically creates tables and seeds starter data on boot if tables or records are missing:
- Database location: `db/database.sqlite`
- WAL journal files: `db/database.sqlite-shm`, `db/database.sqlite-wal`

To reset the database to a clean default state:
1. Stop the running server.
2. Delete `db/database.sqlite`, `db/database.sqlite-shm`, and `db/database.sqlite-wal`.
3. Start the server (`npm start` or `npm run dev`).
4. The schema, default admin, initial course catalog, and test registrations will be recreated automatically.

---

## 2. End-to-End User Workflows

### 2.1 Student Registration & Payment Journey
1. **Visit Catalog:** Open `http://localhost:3000/courses.html`.
2. **Filter & Select:** Filter by branch (`MECH`, `CIVIL`, `ECE`, `CSE`, `IT`) or search keyword, then click **"Enroll Now"**.
3. **Registration Form:** Complete Student Name, Email, and Phone number.
4. **Simulate Payment:**
   - Choose a payment method (Card, UPI, Netbanking).
   - Click **"Simulate Successful Payment"** (or test declined/cancelled paths).
5. **Confirmation:** The system provides:
   - Generated Registration Reference (e.g. `REG-2026-10001`).
   - Start Date and calculated Certificate Eligibility Date.
   - Link to the Student Certificate Portal.

### 2.2 Certificate Generation Journey
1. **Navigate to Portal:** Open `http://localhost:3000/certificate.html`.
2. **Lookup Eligibility:**
   - Input Registration Reference: `REG-2026-10001`.
   - Input Registered Email: `arun.kumar@example.com`.
   - Click **"Check Certificate Eligibility"**.
3. **Evaluation:**
   - *If course is in progress:* System displays remaining days countdown until the eligibility date.
   - *If course is completed:* System presents the verified badge and a **"Generate & Download Official PDF Certificate"** button.
4. **Download:** Clicking the download button fetches `/api/certificates/:certNum/pdf` which streams the vector PDF with dynamic verification QR code.

### 2.3 Public Verification Journey
1. **Scan QR Code or Navigate:** Open `http://localhost:3000/verify.html?cert=ECT-2026-00101` (or enter certificate ID directly on `verify.html`).
2. **Verification Check:** Click **"Verify Certificate Authenticity"**.
3. **Result:**
   - **Valid:** Displays authentic status, student name, course title, completion date, and official credential badge.
   - **Revoked:** Displays revocation warning, revocation timestamp, and administrative reason.
   - **Not Found:** Displays error indicating credential does not exist.

---

## 3. Administrative Workflows

### 3.1 Logging into Admin Portal
1. Navigate to `http://localhost:3000/admin/login` or click the Admin Portal link in the footer.
2. Enter default credentials:
   - **Username:** `admin`
   - **Password:** `admin123`
3. The dashboard loads real-time KPIs: active courses, total enrollments, completed students, and revenue.

### 3.2 Managing Courses
- **Create Course:** In the "Course Management" tab, click **"Add New Course"**. Fill in title, branch, course type (online/offline), duration in months, fee, and syllabus.
- **Edit/Deactivate:** Update course duration, price, or toggle active status. Inactivating a course hides it from public listings while preserving historical enrollment links.

### 3.3 Recording Offline Registrations
- Navigate to the **"Manual Offline Registration"** tab.
- Enter student details, select an existing course, and specify the payment method (Cash, Bank Transfer, Office POS).
- Submitting immediately creates a paid registration record and initiates eligibility calculation.

### 3.4 Manual Completion Override
- In **"Student Registrations"**, locate an in-progress student.
- Click **"Mark Completed"** to override the duration waiting period (e.g. for accelerated learning or prior assessment).
- The student can immediately generate their official certificate.

### 3.5 Certificate Revocation & Reinstatement
- Under the **"Certificate Registry"** tab, locate any issued credential.
- Click **"Revoke"** and input an audit reason (e.g. "Honor code violation" or "Payment dispute").
- The public verification page will immediately reflect the revoked status.
- Admin can also click **"Restore"** to re-validate the credential if the dispute is resolved.

---

## 4. Automated Testing Guidelines

EduCadTech includes Playwright for end-to-end regression validation.

### 4.1 Running Playwright Tests
Ensure the server is running on `http://localhost:3000`, then run:
```bash
npx playwright test
```

### 4.2 Key Scenarios to Validate
- [x] Home page and Course catalog rendering with branch filters.
- [x] Course enrollment modal submission and demo payment processing.
- [x] In-progress course eligibility rejection with countdown.
- [x] Completed course certificate PDF generation and binary stream integrity.
- [x] Verification portal lookup matching verified and revoked states.
- [x] Admin login authentication, JWT token retention, and protected API routes.
