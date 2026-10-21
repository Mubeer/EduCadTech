const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, initializeDatabase, calculateEligibilityDate, checkAndUpdateAutomaticCompletions } = require('./db/database');
const { generateCertificatePdf } = require('./services/certificateGenerator');

// Initialize database schema & seed data
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'educadtech_secret_key_demo_2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Ensure course uploads directory exists
const courseUploadsDir = path.join(__dirname, 'assets', 'images', 'courses', 'uploads');
if (!fs.existsSync(courseUploadsDir)) {
  fs.mkdirSync(courseUploadsDir, { recursive: true });
}

// Periodic check for automatic completions every 10 minutes
setInterval(() => {
  try {
    checkAndUpdateAutomaticCompletions();
  } catch (err) {
    console.error('Error running automatic completion interval:', err);
  }
}, 10 * 60 * 1000);

// Helper: Authentication Middleware
function requireAdminAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, name: admin.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token,
    admin: { id: admin.id, username: admin.username, name: admin.name }
  });
});

app.get('/api/auth/me', requireAdminAuth, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// -------------------------------------------------------------
// PUBLIC COURSES API
// -------------------------------------------------------------
app.get('/api/courses', (req, res) => {
  const { branch, type, search } = req.query;
  let query = 'SELECT * FROM courses WHERE is_active = 1';
  const params = [];

  if (branch && branch !== 'ALL') {
    query += ' AND branch = ?';
    params.push(branch);
  }
  if (type && type !== 'ALL') {
    query += ' AND (course_type = ? OR category LIKE ?)';
    params.push(type, `%${type}%`);
  }
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY id ASC';
  const courses = db.prepare(query).all(...params);
  res.json({ success: true, courses });
});

app.get('/api/courses/:id', (req, res) => {
  const param = req.params.id;
  let course;
  if (/^\d+$/.test(param)) {
    course = db.prepare('SELECT * FROM courses WHERE id = ?').get(param);
  } else {
    const normalized = param.replace(/-/g, ' ').toLowerCase();
    course = db.prepare('SELECT * FROM courses WHERE LOWER(title) = ? OR LOWER(title) LIKE ?').get(normalized, `%${normalized}%`);
  }
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.json({ success: true, course });
});

// -------------------------------------------------------------
// PUBLIC REGISTRATION & DEMO PAYMENT API
// -------------------------------------------------------------
app.post('/api/register', (req, res) => {
  const { student_name, email, phone, whatsapp, course_id, course_type } = req.body;

  if (!student_name || !email || !phone || !course_id) {
    return res.status(400).json({ error: 'Student name, email, phone, and course are required.' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course || !course.is_active) {
    return res.status(404).json({ error: 'Selected course is unavailable or inactive.' });
  }

  // Generate unique registration reference
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const reg_code = `REG-2026-${randomSuffix}`;

  const todayStr = new Date().toISOString().split('T')[0];
  const durationMonths = course.duration_months || 3;
  const eligibilityDateStr = calculateEligibilityDate(todayStr, durationMonths);

  const insert = db.prepare(`
    INSERT INTO registrations (
      reg_code, student_name, email, phone, whatsapp, course_id,
      registration_source, registration_date, start_date, duration_months,
      eligibility_date, completion_status, payment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_completed', 'pending')
  `);

  const result = insert.run(
    reg_code,
    student_name.trim(),
    email.trim().toLowerCase(),
    phone.trim(),
    (whatsapp || phone).trim(),
    course.id,
    'online',
    todayStr,
    todayStr,
    durationMonths,
    eligibilityDateStr
  );

  const registration = db.prepare(`
    SELECT r.*, c.title as course_title, c.price as course_price, c.duration_months as course_duration
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({
    success: true,
    registration,
    message: 'Registration initiated. Please proceed to payment.'
  });
});

app.post('/api/payments/process-demo', (req, res) => {
  const { registration_id, payment_method, demo_outcome } = req.body;

  if (!registration_id || !demo_outcome) {
    return res.status(400).json({ error: 'Registration ID and demo outcome are required.' });
  }

  const reg = db.prepare(`
    SELECT r.*, c.title as course_title, c.price as course_price
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    WHERE r.id = ?
  `).get(registration_id);

  if (!reg) {
    return res.status(404).json({ error: 'Registration record not found.' });
  }

  if (reg.payment_status === 'paid') {
    return res.status(400).json({ error: 'This registration has already been paid successfully.' });
  }

  const txnSuffix = Math.floor(100000 + Math.random() * 900000);
  const transaction_ref = `TXN-DEMO-${txnSuffix}`;
  const method = payment_method || 'demo_card';

  if (demo_outcome === 'success') {
    // Record successful payment
    db.prepare(`
      INSERT INTO payments (transaction_ref, registration_id, amount, payment_method, payment_status, gateway_response)
      VALUES (?, ?, ?, ?, 'successful', ?)
    `).run(
      transaction_ref,
      reg.id,
      reg.course_price,
      method,
      JSON.stringify({ status: 'success', method, auth_code: 'DEMO_AUTH_99', timestamp: new Date().toISOString() })
    );

    // Update registration status
    db.prepare(`
      UPDATE registrations 
      SET payment_status = 'paid' 
      WHERE id = ?
    `).run(reg.id);

    // Create Company Notification with WhatsApp prefilled link
    const waPhone = (reg.whatsapp || reg.phone).replace(/[^0-9]/g, '');
    const waText = encodeURIComponent(
      `Hello ${reg.student_name},\nYour enrollment in ${reg.course_title} at EduCadTech is confirmed!\n\nRegistration Reference: ${reg.reg_code}\nTransaction ID: ${transaction_ref}\nAmount Paid: ₹${reg.course_price}\nStart Date: ${reg.start_date}\n\nWe look forward to guiding your training journey!`
    );
    const whatsappUrl = `https://wa.me/${waPhone}?text=${waText}`;

    db.prepare(`
      INSERT INTO notifications (
        registration_id, type, title, message, student_name, course_title, amount, payment_status, transaction_ref, whatsapp_url
      ) VALUES (?, 'new_registration', 'New Online Course Payment', ?, ?, ?, ?, 'successful', ?, ?)
    `).run(
      reg.id,
      `Student ${reg.student_name} completed payment of ₹${reg.course_price} for ${reg.course_title}. Ref: ${reg.reg_code}`,
      reg.student_name,
      reg.course_title,
      reg.course_price,
      transaction_ref,
      whatsappUrl
    );

    return res.json({
      success: true,
      payment_status: 'successful',
      transaction_ref,
      reg_code: reg.reg_code,
      student_name: reg.student_name,
      course_title: reg.course_title,
      amount: reg.course_price,
      eligibility_date: reg.eligibility_date,
      message: 'Demo payment simulated successfully! Registration is confirmed.'
    });

  } else if (demo_outcome === 'failed') {
    // Record failed payment attempt
    db.prepare(`
      INSERT INTO payments (transaction_ref, registration_id, amount, payment_method, payment_status, gateway_response)
      VALUES (?, ?, ?, ?, 'failed', ?)
    `).run(
      transaction_ref,
      reg.id,
      reg.course_price,
      method,
      JSON.stringify({ status: 'failed', method, error_code: 'CARD_DECLINED_INSUFFICIENT_FUNDS', timestamp: new Date().toISOString() })
    );

    db.prepare(`UPDATE registrations SET payment_status = 'failed' WHERE id = ?`).run(reg.id);

    return res.status(402).json({
      success: false,
      payment_status: 'failed',
      transaction_ref,
      message: 'Demo Payment Failed: Transaction was declined by the simulated card issuer. You can retry with a different test method.'
    });

  } else {
    // Cancelled payment
    db.prepare(`
      INSERT INTO payments (transaction_ref, registration_id, amount, payment_method, payment_status, gateway_response)
      VALUES (?, ?, ?, ?, 'cancelled', ?)
    `).run(
      transaction_ref,
      reg.id,
      reg.course_price,
      method,
      JSON.stringify({ status: 'cancelled', method, reason: 'USER_ABORTED', timestamp: new Date().toISOString() })
    );

    db.prepare(`UPDATE registrations SET payment_status = 'cancelled' WHERE id = ?`).run(reg.id);

    return res.json({
      success: false,
      payment_status: 'cancelled',
      transaction_ref,
      message: 'Demo payment was cancelled by user. You may re-attempt payment when ready.'
    });
  }
});

// -------------------------------------------------------------
// PUBLIC CERTIFICATE LOOKUP, GENERATION & VERIFICATION
// -------------------------------------------------------------
app.post('/api/certificates/lookup', (req, res) => {
  const { reg_code, email } = req.body;
  if (!reg_code || !email) {
    return res.status(400).json({ error: 'Registration Reference and Registered Email are required.' });
  }

  // Trigger any due automatic completions
  checkAndUpdateAutomaticCompletions();

  const reg = db.prepare(`
    SELECT r.*, c.title as course_title, c.duration_months as course_duration
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    WHERE UPPER(r.reg_code) = UPPER(?) AND LOWER(r.email) = LOWER(?)
  `).get(reg_code.trim(), email.trim());

  if (!reg) {
    return res.status(404).json({
      error: 'No registration found matching the provided Registration Reference and Email address.'
    });
  }

  if (reg.payment_status !== 'paid') {
    return res.status(400).json({
      error: 'Payment for this registration has not been completed. Status: ' + reg.payment_status
    });
  }

  // Check if existing certificate exists
  const cert = db.prepare('SELECT * FROM certificates WHERE registration_id = ?').get(reg.id);

  const today = new Date().toISOString().split('T')[0];
  const isEligible = reg.completion_status === 'completed' || reg.eligibility_date <= today;

  // Auto-complete if eligibility date has arrived
  if (reg.completion_status !== 'completed' && reg.eligibility_date <= today) {
    db.prepare(`
      UPDATE registrations 
      SET completion_status = 'completed', completion_date = eligibility_date, completion_type = 'automatic'
      WHERE id = ?
    `).run(reg.id);
    reg.completion_status = 'completed';
    reg.completion_date = reg.eligibility_date;
  }

  if (!isEligible) {
    const todayDate = new Date(today);
    const eligDate = new Date(reg.eligibility_date);
    const diffTime = eligDate - todayDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return res.json({
      success: true,
      eligible: false,
      registration: {
        reg_code: reg.reg_code,
        student_name: reg.student_name,
        course_title: reg.course_title,
        start_date: reg.start_date,
        duration_months: reg.duration_months,
        eligibility_date: reg.eligibility_date,
        completion_status: 'not_completed'
      },
      reason: `Course in progress. Certificate eligibility date is ${reg.eligibility_date} (${diffDays} day(s) remaining). Courses complete automatically once the configured duration elapses, or when marked complete by your administrator.`
    });
  }

  res.json({
    success: true,
    eligible: true,
    registration: {
      reg_code: reg.reg_code,
      student_name: reg.student_name,
      course_title: reg.course_title,
      start_date: reg.start_date,
      completion_date: reg.completion_date || reg.eligibility_date,
      completion_status: 'completed'
    },
    certificate: cert || null
  });
});

app.post('/api/certificates/generate', (req, res) => {
  const { reg_code, email } = req.body;
  if (!reg_code || !email) {
    return res.status(400).json({ error: 'Registration Reference and Email are required.' });
  }

  checkAndUpdateAutomaticCompletions();

  const reg = db.prepare(`
    SELECT r.*, c.title as course_title 
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    WHERE UPPER(r.reg_code) = UPPER(?) AND LOWER(r.email) = LOWER(?)
  `).get(reg_code.trim(), email.trim());

  if (!reg) {
    return res.status(404).json({ error: 'Registration record not found.' });
  }

  if (reg.payment_status !== 'paid') {
    return res.status(400).json({ error: 'Registration must be paid before generating a certificate.' });
  }

  const today = new Date().toISOString().split('T')[0];
  const isEligible = reg.completion_status === 'completed' || reg.eligibility_date <= today;

  if (!isEligible) {
    return res.status(403).json({
      error: `Certificate generation is not yet eligible. Course duration ends on ${reg.eligibility_date}.`
    });
  }

  // If not yet marked completed, mark it now
  if (reg.completion_status !== 'completed') {
    db.prepare(`
      UPDATE registrations 
      SET completion_status = 'completed', completion_date = eligibility_date, completion_type = 'automatic' 
      WHERE id = ?
    `).run(reg.id);
    reg.completion_date = reg.eligibility_date;
  }

  // Check if certificate already exists (idempotency check)
  let cert = db.prepare('SELECT * FROM certificates WHERE registration_id = ?').get(reg.id);

  if (!cert) {
    const certSuffix = Math.floor(10000 + Math.random() * 90000);
    const certNum = `ECT-2026-${certSuffix}`;

    db.prepare(`
      INSERT INTO certificates (
        certificate_number, registration_id, student_name, course_title, start_date, completion_date, issue_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'valid')
    `).run(
      certNum,
      reg.id,
      reg.student_name,
      reg.course_title,
      reg.start_date,
      reg.completion_date || reg.eligibility_date,
      today
    );

    cert = db.prepare('SELECT * FROM certificates WHERE registration_id = ?').get(reg.id);
  }

  res.json({
    success: true,
    certificate: cert,
    message: 'Certificate successfully generated and ready for download!'
  });
});

app.get('/api/certificates/verify/:certNumber', (req, res) => {
  const { certNumber } = req.params;
  const cert = db.prepare(`
    SELECT certificate_number, student_name, course_title, start_date, completion_date, issue_date, status, revocation_reason
    FROM certificates
    WHERE UPPER(certificate_number) = UPPER(?)
  `).get(certNumber.trim());

  if (!cert) {
    return res.status(404).json({
      verified: false,
      message: 'Certificate Not Found. No authentic credential matches this certificate number.'
    });
  }

  if (cert.status === 'revoked') {
    return res.json({
      verified: false,
      status: 'revoked',
      certificate: cert,
      message: `Certificate Revoked: This credential has been officially invalidated by the institution. Reason: ${cert.revocation_reason || 'Administrative Decision'}`
    });
  }

  res.json({
    verified: true,
    status: 'valid',
    certificate: cert,
    message: 'Certificate Verified. This credential is valid, authentic, and officially issued by EduCadTech.'
  });
});

app.get('/api/certificates/:certNumber/download', async (req, res) => {
  const { certNumber } = req.params;
  const cert = db.prepare('SELECT * FROM certificates WHERE UPPER(certificate_number) = UPPER(?)').get(certNumber.trim());

  if (!cert) {
    return res.status(404).send('Certificate not found.');
  }

  if (cert.status === 'revoked') {
    return res.status(403).send('Certificate has been revoked.');
  }

  try {
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const doc = await generateCertificatePdf(cert, hostUrl);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificate-${cert.certificate_number}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error('Error generating certificate PDF:', err);
    res.status(500).send('Error generating certificate PDF');
  }
});

// -------------------------------------------------------------
// PROTECTED ADMIN API
// -------------------------------------------------------------
app.get('/api/admin/dashboard', requireAdminAuth, (req, res) => {
  checkAndUpdateAutomaticCompletions();

  const totalCourses = db.prepare('SELECT COUNT(*) as c FROM courses').get().c;
  const activeCourses = db.prepare('SELECT COUNT(*) as c FROM courses WHERE is_active = 1').get().c;
  const totalRegistrations = db.prepare('SELECT COUNT(*) as c FROM registrations').get().c;
  const successfulPayments = db.prepare("SELECT COUNT(*) as c FROM payments WHERE payment_status = 'successful'").get().c;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE payment_status = 'successful'").get().s;
  const pendingOrFailedPayments = db.prepare("SELECT COUNT(*) as c FROM payments WHERE payment_status IN ('failed', 'cancelled', 'pending')").get().c;
  const completedCourses = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE completion_status = 'completed'").get().c;
  const awaitingCompletion = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE completion_status = 'not_completed'").get().c;
  const certificatesIssued = db.prepare("SELECT COUNT(*) as c FROM certificates WHERE status = 'valid'").get().c;

  const recentRegistrations = db.prepare(`
    SELECT r.*, c.title as course_title
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    ORDER BY r.id DESC LIMIT 8
  `).all();

  const recentNotifications = db.prepare(`
    SELECT * FROM notifications ORDER BY id DESC LIMIT 8
  `).all();

  res.json({
    success: true,
    stats: {
      totalCourses,
      activeCourses,
      totalRegistrations,
      successfulPayments,
      totalRevenue,
      pendingOrFailedPayments,
      completedCourses,
      awaitingCompletion,
      certificatesIssued
    },
    recentRegistrations,
    recentNotifications
  });
});

// Course image upload endpoint
app.post('/api/admin/upload-image', requireAdminAuth, (req, res) => {
  try {
    const { filename, fileData } = req.body;
    if (!filename || !fileData) {
      return res.status(400).json({ error: 'Image filename and base64 data are required.' });
    }

    const ext = path.extname(filename).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ error: `Unsupported image format (${ext}). Allowed formats: JPG, PNG, WEBP, GIF.` });
    }

    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum allowed limit of 5MB.' });
    }

    const cleanBase = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = `course_${Date.now()}_${cleanBase}${ext}`;
    const targetPath = path.join(courseUploadsDir, safeName);

    fs.writeFileSync(targetPath, buffer);
    const relativeUrl = `assets/images/courses/uploads/${safeName}`;

    res.json({
      success: true,
      imageUrl: relativeUrl,
      message: 'Course image uploaded successfully.'
    });
  } catch (err) {
    console.error('Error in /api/admin/upload-image:', err);
    res.status(500).json({ error: 'Failed to process image upload.' });
  }
});

app.get('/api/admin/courses', requireAdminAuth, (req, res) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY id DESC').all();
  res.json({ success: true, courses });
});

app.post('/api/admin/courses', requireAdminAuth, (req, res) => {
  const { title, category, branch, course_type, duration_months, price, image, description, syllabus, curriculum, is_active } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Course title is required' });
  }

  const insert = db.prepare(`
    INSERT INTO courses (
      title, category, branch, course_type, duration_months, price, image, description, syllabus, curriculum, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    title.trim(),
    category || 'Technical Course',
    branch || 'General',
    course_type || 'online',
    parseInt(duration_months, 10) || 3,
    parseFloat(price) || 4999.00,
    image || 'assets/images/courses/1. mechanical draftman.jpg',
    description || '',
    syllabus || '',
    curriculum || '',
    is_active !== undefined ? (is_active ? 1 : 0) : 1
  );

  const created = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, course: created });
});

app.put('/api/admin/courses/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { title, category, branch, course_type, duration_months, price, image, description, syllabus, curriculum, is_active } = req.body;

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  db.prepare(`
    UPDATE courses SET
      title = ?,
      category = ?,
      branch = ?,
      course_type = ?,
      duration_months = ?,
      price = ?,
      image = ?,
      description = ?,
      syllabus = ?,
      curriculum = ?,
      is_active = ?
    WHERE id = ?
  `).run(
    title !== undefined ? title.trim() : course.title,
    category !== undefined ? category : course.category,
    branch !== undefined ? branch : course.branch,
    course_type !== undefined ? course_type : course.course_type,
    duration_months !== undefined ? parseInt(duration_months, 10) : course.duration_months,
    price !== undefined ? parseFloat(price) : course.price,
    image !== undefined ? image : course.image,
    description !== undefined ? description : course.description,
    syllabus !== undefined ? syllabus : course.syllabus,
    curriculum !== undefined ? curriculum : course.curriculum,
    is_active !== undefined ? (is_active ? 1 : 0) : course.is_active,
    id
  );

  const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
  res.json({ success: true, course: updated });
});

app.delete('/api/admin/courses/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const regCount = db.prepare('SELECT COUNT(*) as c FROM registrations WHERE course_id = ?').get(id).c;

  if (regCount > 0) {
    // Soft delete/archive
    db.prepare('UPDATE courses SET is_active = 0 WHERE id = ?').run(id);
    return res.json({ success: true, archived: true, message: `Course archived (deactivated) because it has ${regCount} associated student registrations.` });
  }

  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
  res.json({ success: true, deleted: true, message: 'Course deleted successfully.' });
});

app.get('/api/admin/registrations', requireAdminAuth, (req, res) => {
  checkAndUpdateAutomaticCompletions();

  const { search, course_id, completion_status, payment_status, source } = req.query;
  let query = `
    SELECT r.*, c.title as course_title, c.price as course_price, cert.certificate_number
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    LEFT JOIN certificates cert ON r.id = cert.registration_id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (r.student_name LIKE ? OR r.email LIKE ? OR r.phone LIKE ? OR r.reg_code LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (course_id) {
    query += ` AND r.course_id = ?`;
    params.push(course_id);
  }
  if (completion_status) {
    query += ` AND r.completion_status = ?`;
    params.push(completion_status);
  }
  if (payment_status) {
    query += ` AND r.payment_status = ?`;
    params.push(payment_status);
  }
  if (source) {
    query += ` AND r.registration_source = ?`;
    params.push(source);
  }

  query += ` ORDER BY r.id DESC`;
  const registrations = db.prepare(query).all(...params);
  res.json({ success: true, registrations });
});

app.get('/api/admin/registrations/:id', requireAdminAuth, (req, res) => {
  const reg = db.prepare(`
    SELECT r.*, c.title as course_title, c.price as course_price, c.branch as course_branch
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!reg) {
    return res.status(404).json({ error: 'Registration not found' });
  }

  const payments = db.prepare('SELECT * FROM payments WHERE registration_id = ? ORDER BY id DESC').all(reg.id);
  const certificate = db.prepare('SELECT * FROM certificates WHERE registration_id = ?').get(reg.id);

  res.json({
    success: true,
    registration: reg,
    payments,
    certificate: certificate || null
  });
});

app.post('/api/admin/registrations/offline', requireAdminAuth, (req, res) => {
  const { student_name, email, phone, whatsapp, course_id, amount, payment_method, start_date, duration_months, notes } = req.body;

  if (!student_name || !email || !phone || !course_id) {
    return res.status(400).json({ error: 'Student name, email, phone, and course are required.' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) {
    return res.status(404).json({ error: 'Selected course not found.' });
  }

  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const reg_code = `REG-2026-${randomSuffix}`;

  const todayStr = new Date().toISOString().split('T')[0];
  const sDate = start_date || todayStr;
  const dMonths = parseInt(duration_months || course.duration_months || 3, 10);
  const eligDate = calculateEligibilityDate(sDate, dMonths);

  const insert = db.prepare(`
    INSERT INTO registrations (
      reg_code, student_name, email, phone, whatsapp, course_id,
      registration_source, registration_date, start_date, duration_months,
      eligibility_date, completion_status, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?, ?, 'not_completed', 'paid', ?)
  `);

  const result = insert.run(
    reg_code,
    student_name.trim(),
    email.trim().toLowerCase(),
    phone.trim(),
    (whatsapp || phone).trim(),
    course.id,
    todayStr,
    sDate,
    dMonths,
    eligDate,
    notes || 'Offline direct enrollment'
  );

  const regId = result.lastInsertRowid;
  const txnRef = `TXN-OFFLINE-${Math.floor(100000 + Math.random() * 900000)}`;
  const paidAmount = parseFloat(amount) || course.price;

  // Insert payment record
  db.prepare(`
    INSERT INTO payments (transaction_ref, registration_id, amount, payment_method, payment_status, gateway_response)
    VALUES (?, ?, ?, ?, 'successful', ?)
  `).run(
    txnRef,
    regId,
    paidAmount,
    payment_method || 'cash',
    JSON.stringify({ status: 'success', method: payment_method || 'cash', recorded_by: req.admin.username })
  );

  // Notification log
  const waPhone = (whatsapp || phone).replace(/[^0-9]/g, '');
  const waText = encodeURIComponent(
    `Hello ${student_name},\nYour in-person enrollment in ${course.title} at EduCadTech has been officially recorded!\n\nRegistration Reference: ${reg_code}\nTransaction ID: ${txnRef}\nAmount: ₹${paidAmount}\n\nWelcome to EduCadTech!`
  );

  db.prepare(`
    INSERT INTO notifications (
      registration_id, type, title, message, student_name, course_title, amount, payment_status, transaction_ref, whatsapp_url
    ) VALUES (?, 'offline_registration', 'Manual Offline Student Registration', ?, ?, ?, ?, 'successful', ?, ?)
  `).run(
    regId,
    `Admin recorded offline enrollment for ${student_name} in ${course.title}. Amount: ₹${paidAmount} (${payment_method || 'cash'}).`,
    student_name,
    course.title,
    paidAmount,
    txnRef,
    `https://wa.me/${waPhone}?text=${waText}`
  );

  const createdReg = db.prepare(`
    SELECT r.*, c.title as course_title, c.price as course_price
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    WHERE r.id = ?
  `).get(regId);

  res.status(201).json({
    success: true,
    registration: createdReg,
    message: 'Offline registration and payment recorded successfully.'
  });
});

app.put('/api/admin/registrations/:id/completion', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { completion_status, completion_date } = req.body;

  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
  if (!reg) {
    return res.status(404).json({ error: 'Registration not found' });
  }

  const today = new Date().toISOString().split('T')[0];
  let newStatus = completion_status;
  let newCompDate = completion_date;
  let compType = reg.completion_type;

  if (newStatus === 'completed') {
    newCompDate = newCompDate || reg.completion_date || today;
    compType = 'manual';
  } else if (newStatus === 'not_completed') {
    newCompDate = null;
    compType = null;
  }

  db.prepare(`
    UPDATE registrations 
    SET completion_status = ?, completion_date = ?, completion_type = ?
    WHERE id = ?
  `).run(newStatus, newCompDate, compType, id);

  const updated = db.prepare(`
    SELECT r.*, c.title as course_title 
    FROM registrations r 
    JOIN courses c ON r.course_id = c.id 
    WHERE r.id = ?
  `).get(id);

  res.json({
    success: true,
    registration: updated,
    message: `Registration marked as ${newStatus}.`
  });
});

app.get('/api/admin/notifications', requireAdminAuth, (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all();
  res.json({ success: true, notifications });
});

app.put('/api/admin/notifications/:id/read', requireAdminAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/certificates', requireAdminAuth, (req, res) => {
  const certificates = db.prepare(`
    SELECT c.*, r.reg_code, r.email as student_email, r.phone as student_phone
    FROM certificates c
    JOIN registrations r ON c.registration_id = r.id
    ORDER BY c.id DESC
  `).all();
  res.json({ success: true, certificates });
});

app.put('/api/admin/certificates/:id/status', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { status, revocation_reason } = req.body;

  if (!['valid', 'revoked'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either "valid" or "revoked".' });
  }

  db.prepare(`
    UPDATE certificates 
    SET status = ?, revocation_reason = ? 
    WHERE id = ?
  `).run(status, revocation_reason || null, id);

  const updated = db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
  res.json({
    success: true,
    certificate: updated,
    message: `Certificate status updated to ${status}.`
  });
});

// -------------------------------------------------------------
// SERVE STATIC FILES & PAGE ROUTES
// -------------------------------------------------------------
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

// Explicit Clean Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/courses', (req, res) => {
  res.sendFile(path.join(__dirname, 'courses.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'verify.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/certificate', (req, res) => {
  res.sendFile(path.join(__dirname, 'certificate.html'));
});

app.get('/course-content', (req, res) => {
  res.sendFile(path.join(__dirname, 'course-content.html'));
});

app.get('/course-details', (req, res) => {
  res.sendFile(path.join(__dirname, 'course-content.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.listen(PORT, () => {
  console.log(`EduCadTech Full-Stack Server running at http://localhost:${PORT}`);
});
