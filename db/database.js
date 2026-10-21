const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for reliability
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function initializeDatabase() {
  // 1. Admins Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Courses Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Technical Course',
      branch TEXT NOT NULL DEFAULT 'General',
      course_type TEXT NOT NULL DEFAULT 'online', -- 'online' or 'offline'
      duration_months INTEGER NOT NULL DEFAULT 3,
      price REAL NOT NULL DEFAULT 4999.00,
      image TEXT DEFAULT 'assets/images/courses/1. mechanical draftman.jpg',
      description TEXT,
      syllabus TEXT,
      curriculum TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Student Registrations Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_code TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      whatsapp TEXT,
      course_id INTEGER NOT NULL REFERENCES courses(id),
      registration_source TEXT NOT NULL DEFAULT 'online', -- 'online' or 'offline'
      registration_date TEXT NOT NULL, -- YYYY-MM-DD
      start_date TEXT NOT NULL, -- YYYY-MM-DD
      duration_months INTEGER NOT NULL DEFAULT 3,
      eligibility_date TEXT NOT NULL, -- YYYY-MM-DD
      completion_status TEXT NOT NULL DEFAULT 'not_completed', -- 'not_completed' or 'completed'
      completion_date TEXT, -- YYYY-MM-DD
      completion_type TEXT, -- 'manual' or 'automatic'
      payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'cancelled'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Payments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_ref TEXT UNIQUE NOT NULL,
      registration_id INTEGER NOT NULL REFERENCES registrations(id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL, -- 'successful', 'failed', 'cancelled', 'pending'
      gateway_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Certificates Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_number TEXT UNIQUE NOT NULL,
      registration_id INTEGER UNIQUE NOT NULL REFERENCES registrations(id),
      student_name TEXT NOT NULL,
      course_title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      completion_date TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'valid', -- 'valid' or 'revoked'
      revocation_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Company Notification Logs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id INTEGER REFERENCES registrations(id),
      type TEXT NOT NULL DEFAULT 'new_registration',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      student_name TEXT NOT NULL,
      course_title TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_status TEXT NOT NULL,
      transaction_ref TEXT,
      whatsapp_url TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default admin if missing
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
  if (adminCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare(`
      INSERT INTO admins (username, password_hash, name)
      VALUES (?, ?, ?)
    `).run('admin', hash, 'Administrator');
    console.log('Seeded default admin: admin / admin123');
  }

  // Seed courses if empty
  const courseCount = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
  if (courseCount === 0) {
    seedCourses();
  }

  // Seed sample registrations if empty
  const regCount = db.prepare('SELECT COUNT(*) as count FROM registrations').get().count;
  if (regCount === 0) {
    seedSampleRegistrations();
  }

  // Run automatic completion check
  checkAndUpdateAutomaticCompletions();
}

function calculateEligibilityDate(startDateStr, durationMonths) {
  const date = new Date(startDateStr);
  date.setMonth(date.getMonth() + parseInt(durationMonths, 10));
  return date.toISOString().split('T')[0];
}

function seedCourses() {
  const demoCoursesPath = path.join(__dirname, 'demoCourses.json');
  let coursesData = [];
  if (fs.existsSync(demoCoursesPath)) {
    try {
      coursesData = JSON.parse(fs.readFileSync(demoCoursesPath, 'utf8'));
    } catch (e) {
      console.error('Error reading demo courses:', e);
    }
  }

  if (coursesData.length === 0) {
    coursesData = [
      { title: "Mechanical Draftsman", category: "Technical Course", branch: "MECH", course_type: "online", duration_months: 3, price: 3999, image: "assets/images/courses/1. mechanical draftman.jpg" },
      { title: "Design Engineer", category: "Technical Course", branch: "MECH", course_type: "online", duration_months: 6, price: 5999, image: "assets/images/courses/2. Design Engineer.png" },
      { title: "Manufacturing Engineer", category: "Technical Course", branch: "MECH", course_type: "online", duration_months: 4, price: 4999, image: "assets/images/courses/3. Manufacturing Engineer.png" },
      { title: "CFD Analyst", category: "Technical Course", branch: "MECH", course_type: "online", duration_months: 4, price: 5499, image: "assets/images/courses/4. CFD Analysis.png" },
      { title: "Quality Engineer", category: "Technical Course", branch: "MECH", course_type: "online", duration_months: 3, price: 3999, image: "assets/images/courses/5. Quality Engineer.png" }
    ];
  }

  const insertCourse = db.prepare(`
    INSERT INTO courses (title, category, branch, course_type, duration_months, price, image, description, syllabus, curriculum, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  coursesData.forEach((c) => {
    const duration = c.duration_months || 3;
    const price = c.price || 3999;
    const courseType = c.course_type || 'online';
    const description = c.description || `Comprehensive industry-oriented training program in ${c.title}. Master core theoretical principles, hands-on software workflows, and real-world project portfolios guided by experienced mentors.`;
    const syllabus = c.syllabus || `Module 1: Fundamentals & Engineering Standards\nModule 2: Advanced Software Tools & Practical Modeling\nModule 3: Industry Workflows, Quality Auditing & Standards\nModule 4: Capstone Project & Certification Assessment`;
    const curriculum = c.curriculum || `40 Hours of Live Mentorship\nReal-World Case Studies\nHands-on Software Lab Exercises\nFinal Project Review & Portfolio Assistance`;

    insertCourse.run(
      c.title,
      c.category || 'Technical Course',
      c.branch || 'General',
      courseType,
      duration,
      price,
      c.image || 'assets/images/courses/1. mechanical draftman.jpg',
      description,
      syllabus,
      curriculum,
      1
    );
  });

  console.log(`Seeded ${coursesData.length} courses into database.`);
}

function seedSampleRegistrations() {
  const courses = db.prepare('SELECT id, title, duration_months, price FROM courses LIMIT 4').all();
  if (courses.length === 0) return;

  const today = new Date();

  // 1. Completed & eligible student (registered 4 months ago)
  const reg1Date = new Date(today);
  reg1Date.setMonth(reg1Date.getMonth() - 4);
  const reg1DateStr = reg1Date.toISOString().split('T')[0];
  const comp1DateStr = calculateEligibilityDate(reg1DateStr, 3);

  const reg1 = db.prepare(`
    INSERT INTO registrations (
      reg_code, student_name, email, phone, whatsapp, course_id, 
      registration_source, registration_date, start_date, duration_months, 
      eligibility_date, completion_status, completion_date, completion_type, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'REG-2026-10001',
    'Arun Kumar',
    'arun.kumar@example.com',
    '+91 9876543210',
    '+91 9876543210',
    courses[0].id,
    'online',
    reg1DateStr,
    reg1DateStr,
    3,
    comp1DateStr,
    'completed',
    comp1DateStr,
    'automatic',
    'paid',
    'Completed with distinction'
  );

  // Payment for student 1
  db.prepare(`
    INSERT INTO payments (transaction_ref, registration_id, amount, payment_method, payment_status, gateway_response)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'TXN-DEMO-99001',
    reg1.lastInsertRowid,
    courses[0].price,
    'demo_card',
    'successful',
    JSON.stringify({ status: 'success', method: 'demo_card', code: 'AUTH_APPROVED' })
  );

  // Issue certificate for student 1
  db.prepare(`
    INSERT INTO certificates (
      certificate_number, registration_id, student_name, course_title, start_date, completion_date, issue_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'ECT-2026-00101',
    reg1.lastInsertRowid,
    'Arun Kumar',
    courses[0].title,
    reg1DateStr,
    comp1DateStr,
    comp1DateStr,
    'valid'
  );

  // 2. Student currently in progress (registered 15 days ago, duration 3 months)
  const reg2Date = new Date(today);
  reg2Date.setDate(reg2Date.getDate() - 15);
  const reg2DateStr = reg2Date.toISOString().split('T')[0];
  const comp2DateStr = calculateEligibilityDate(reg2DateStr, 3);

  const reg2 = db.prepare(`
    INSERT INTO registrations (
      reg_code, student_name, email, phone, whatsapp, course_id, 
      registration_source, registration_date, start_date, duration_months, 
      eligibility_date, completion_status, completion_date, completion_type, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'REG-2026-10002',
    'Sneha Patel',
    'sneha.patel@example.com',
    '+91 9845123456',
    '+91 9845123456',
    courses[1].id,
    'online',
    reg2DateStr,
    reg2DateStr,
    3,
    comp2DateStr,
    'not_completed',
    null,
    null,
    'paid',
    'Batch A-2026'
  );

  db.prepare(`
    INSERT INTO payments (transaction_ref, registration_id, amount, payment_method, payment_status, gateway_response)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'TXN-DEMO-99002',
    reg2.lastInsertRowid,
    courses[1].price,
    'demo_upi',
    'successful',
    JSON.stringify({ status: 'success', method: 'demo_upi', upi_id: 'sneha@okhdfc' })
  );

  // Notification for student 2
  const waText = encodeURIComponent(`Hello Sneha Patel, your registration for ${courses[1].title} (Reference: REG-2026-10002) is confirmed! Thank you for choosing EduCadTech.`);
  db.prepare(`
    INSERT INTO notifications (registration_id, type, title, message, student_name, course_title, amount, payment_status, transaction_ref, whatsapp_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reg2.lastInsertRowid,
    'new_registration',
    'New Online Course Registration',
    `Student Sneha Patel registered for ${courses[1].title}. Payment of ₹${courses[1].price} received successfully.`,
    'Sneha Patel',
    courses[1].title,
    courses[1].price,
    'successful',
    'TXN-DEMO-99002',
    `https://wa.me/919845123456?text=${waText}`
  );

  // 3. Offline registration (manual entry example)
  const reg3Date = new Date(today);
  reg3Date.setDate(reg3Date.getDate() - 5);
  const reg3DateStr = reg3Date.toISOString().split('T')[0];
  const comp3DateStr = calculateEligibilityDate(reg3DateStr, 2);

  const reg3 = db.prepare(`
    INSERT INTO registrations (
      reg_code, student_name, email, phone, whatsapp, course_id, 
      registration_source, registration_date, start_date, duration_months, 
      eligibility_date, completion_status, completion_date, completion_type, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'REG-2026-10003',
    'Venkatesh Rao',
    'venkat.rao@example.com',
    '+91 9765432109',
    '+91 9765432109',
    courses[2].id,
    'offline',
    reg3DateStr,
    reg3DateStr,
    2,
    comp3DateStr,
    'not_completed',
    null,
    null,
    'paid',
    'Paid in cash at Ambattur center'
  );

  db.prepare(`
    INSERT INTO payments (transaction_ref, registration_id, amount, payment_method, payment_status, gateway_response)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'TXN-OFFLINE-99003',
    reg3.lastInsertRowid,
    courses[2].price,
    'cash',
    'successful',
    JSON.stringify({ status: 'success', method: 'cash', collected_by: 'Admin' })
  );

  console.log('Seeded sample registrations and certificates.');
}

function checkAndUpdateAutomaticCompletions() {
  const today = new Date().toISOString().split('T')[0];
  const eligible = db.prepare(`
    SELECT id, eligibility_date, duration_months FROM registrations 
    WHERE completion_status = 'not_completed' 
      AND payment_status = 'paid'
      AND eligibility_date <= ?
  `).all(today);

  if (eligible.length > 0) {
    const updateStmt = db.prepare(`
      UPDATE registrations 
      SET completion_status = 'completed', 
          completion_date = eligibility_date, 
          completion_type = 'automatic' 
      WHERE id = ?
    `);

    for (const reg of eligible) {
      updateStmt.run(reg.id);
    }
    console.log(`Automatically completed ${eligible.length} eligible registrations as of ${today}.`);
  }
}

module.exports = {
  db,
  initializeDatabase,
  calculateEligibilityDate,
  checkAndUpdateAutomaticCompletions
};
