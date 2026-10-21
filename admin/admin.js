// ========================================================
// EduCadTech Admin Portal Client Logic
// ========================================================

const API_BASE = '/api';
let authToken = localStorage.getItem('admin_token');
let currentAdmin = null;

// Global cache
let cachedCourses = [];
let cachedRegistrations = [];
let cachedCertificates = [];
let cachedNotifications = [];

// --------------------------------------------------------
// AUTHENTICATION CHECK
// --------------------------------------------------------
async function checkAuth() {
  if (!authToken) {
    window.location.href = 'login.html';
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) {
      localStorage.removeItem('admin_token');
      window.location.href = 'login.html';
      return false;
    }
    currentAdmin = data.admin;
    document.getElementById('adminName').textContent = currentAdmin.name || 'Administrator';
    document.getElementById('adminUsername').textContent = `@${currentAdmin.username}`;
    document.getElementById('adminAvatar').textContent = (currentAdmin.name || 'A')[0].toUpperCase();
    return true;
  } catch (err) {
    console.error('Auth verification error:', err);
    return false;
  }
}

// --------------------------------------------------------
// NAVIGATION & SECTION SWITCHING
// --------------------------------------------------------
function switchSection(sectionId) {
  // Update sidebar active link
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === sectionId) {
      link.classList.add('active');
    }
  });

  // Hide all sections
  document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');

  // Show target section
  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.style.display = 'block';
  }

  // Update headers
  const heading = document.getElementById('sectionHeading');
  const subheading = document.getElementById('sectionSubheading');

  const titles = {
    dashboard: ['Dashboard Overview', 'Real-time platform metrics, course enrollments, and payment status'],
    courses: ['Course Management', 'Configure courses, pricing, engineering branches, and eligibility durations'],
    registrations: ['Student Registrations', 'Monitor student enrollments, payment verification, and completion status'],
    offline: ['Manual Offline Registration', 'Record direct in-person enrollments and fee payments'],
    certificates: ['Certificate Registry', 'Manage issued credentials, PDF downloads, and certificate authenticity'],
    notifications: ['Company Notification Log', 'Incoming registration alerts and optional WhatsApp contact handoff']
  };

  if (titles[sectionId]) {
    heading.textContent = titles[sectionId][0];
    subheading.textContent = titles[sectionId][1];
  }

  // Load section data
  if (sectionId === 'dashboard') loadDashboard();
  else if (sectionId === 'courses') loadCourses();
  else if (sectionId === 'registrations') loadRegistrations();
  else if (sectionId === 'offline') setupOfflineForm();
  else if (sectionId === 'certificates') loadCertificates();
  else if (sectionId === 'notifications') loadNotifications();
}

// --------------------------------------------------------
// DASHBOARD METRICS & RECENT ACTIVITIES
// --------------------------------------------------------
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const s = data.stats;
    document.getElementById('statTotalCourses').textContent = s.totalCourses || 0;
    document.getElementById('statTotalRegistrations').textContent = s.totalRegistrations || 0;
    document.getElementById('statSuccessfulPayments').textContent = s.successfulPayments || 0;
    document.getElementById('statRevenueText').textContent = `₹${(s.totalRevenue || 0).toLocaleString()} total revenue`;
    document.getElementById('statPendingFailed').textContent = s.pendingOrFailedPayments || 0;
    document.getElementById('statCompletedCourses').textContent = s.completedCourses || 0;
    document.getElementById('statAwaitingCompletion').textContent = s.awaitingCompletion || 0;
    document.getElementById('statCertificatesIssued').textContent = s.certificatesIssued || 0;

    // Render Recent Registrations
    renderRecentRegistrations(data.recentRegistrations || []);

    // Render Recent Notifications
    renderRecentNotifications(data.recentNotifications || []);
  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
    showToast('Failed to load dashboard metrics', 'error');
  }
}

function renderRecentRegistrations(regs) {
  const tbody = document.getElementById('recentRegistrationsTable');
  if (regs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 25px;">No student enrollments recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = regs.map(r => `
    <tr>
      <td><strong><code>${r.reg_code}</code></strong></td>
      <td>
        <div style="font-weight: 600; color: #fff;">${escapeHtml(r.student_name)}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(r.email)}</div>
      </td>
      <td>${escapeHtml(r.course_title)}</td>
      <td>
        <span class="badge ${r.registration_source === 'offline' ? 'badge-primary' : 'badge-info'}">
          ${r.registration_source}
        </span>
      </td>
      <td>${r.start_date}</td>
      <td><span style="color: #cbd5e1;">${r.eligibility_date}</span></td>
      <td>
        <span class="badge ${r.payment_status === 'paid' ? 'badge-success' : (r.payment_status === 'failed' ? 'badge-danger' : 'badge-warning')}">
          ${r.payment_status}
        </span>
      </td>
      <td>
        <span class="badge status-toggle ${r.completion_status === 'completed' ? 'badge-success' : 'badge-warning'}" 
              onclick="toggleCompletion(${r.id}, '${r.completion_status}')"
              title="Click to toggle status">
          <i class="fa ${r.completion_status === 'completed' ? 'fa-check' : 'fa-clock-o'}"></i>
          ${r.completion_status === 'completed' ? 'Completed' : 'In Progress'}
        </span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewRegistrationDetails(${r.id})">
          <i class="fa fa-eye"></i> Details
        </button>
      </td>
    </tr>
  `).join('');
}

function renderRecentNotifications(notes) {
  const container = document.getElementById('recentNotificationsList');
  if (notes.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">No notifications logged yet.</p>`;
    return;
  }

  container.innerHTML = notes.map(n => `
    <div style="padding: 14px 18px; background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: var(--radius); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <div style="font-weight: 600; color: #fff; font-size: 0.9rem;">
          <i class="fa fa-info-circle" style="color: var(--primary);"></i> ${escapeHtml(n.title)}
        </div>
        <div style="font-size: 0.83rem; color: var(--text-muted); margin-top: 2px;">
          ${escapeHtml(n.message)}
        </div>
        <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">
          Txn: <code>${n.transaction_ref || 'N/A'}</code> &bull; ${new Date(n.created_at).toLocaleString()}
        </div>
      </div>
      <div>
        ${n.whatsapp_url ? `
          <a href="${n.whatsapp_url}" target="_blank" class="btn btn-success btn-sm">
            <i class="fa fa-whatsapp"></i> WhatsApp Handoff
          </a>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// --------------------------------------------------------
// COURSE MANAGEMENT
// --------------------------------------------------------
async function loadCourses() {
  try {
    const res = await fetch(`${API_BASE}/admin/courses`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    cachedCourses = data.courses || [];
    filterAndRenderCourses();

    // Also populate offline form course dropdown
    populateCourseDropdowns();
  } catch (err) {
    console.error('Failed to load courses:', err);
    showToast('Failed to load courses', 'error');
  }
}

function filterAndRenderCourses() {
  const search = document.getElementById('courseSearchInput').value.toLowerCase();
  const branch = document.getElementById('courseBranchFilter').value;
  const type = document.getElementById('courseTypeFilter').value;

  const filtered = cachedCourses.filter(c => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search) || (c.branch && c.branch.toLowerCase().includes(search));
    const matchesBranch = !branch || c.branch === branch;
    const matchesType = !type || c.course_type === type;
    return matchesSearch && matchesBranch && matchesType;
  });

  const tbody = document.getElementById('coursesTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No courses match the filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>
        <div style="font-weight: 600; color: #fff;">${escapeHtml(c.title)}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(c.category || 'Technical')}</div>
      </td>
      <td><span class="badge badge-info">${c.branch || 'General'}</span></td>
      <td>
        <span class="badge ${c.course_type === 'offline' ? 'badge-primary' : 'badge-success'}">
          ${c.course_type === 'offline' ? 'Offline' : 'Online'}
        </span>
      </td>
      <td><strong>${c.duration_months} Months</strong></td>
      <td><strong>₹${Number(c.price).toLocaleString()}</strong></td>
      <td>
        <span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}" style="cursor: pointer;" onclick="toggleCourseActive(${c.id}, ${c.is_active})">
          ${c.is_active ? 'Active' : 'Archived'}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="openEditCourseModal(${c.id})" title="Edit Course">
            <i class="fa fa-pencil"></i>
          </button>
          <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="deleteCourse(${c.id})" title="Archive / Delete">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function setCourseImagePreview(imgSrc, title = '') {
  const preview = document.getElementById('courseImagePreview');
  const nameEl = document.getElementById('courseImagePreviewName');
  const statusEl = document.getElementById('courseImagePreviewStatus');
  const card = document.getElementById('courseImagePreviewCard');

  if (!preview) return;

  if (!imgSrc) {
    if (card) card.style.display = 'none';
    return;
  }

  let formattedSrc = imgSrc;
  if (!imgSrc.startsWith('http') && !imgSrc.startsWith('/') && !imgSrc.startsWith('data:')) {
    formattedSrc = '../' + imgSrc;
  }
  preview.src = formattedSrc;
  preview.onerror = () => { preview.src = '../assets/images/courses/1. mechanical draftman.jpg'; };

  const fileName = imgSrc.split('/').pop();
  if (nameEl) nameEl.textContent = fileName || title || 'Attached Image';
  if (statusEl) statusEl.innerHTML = '<i class="fa fa-check-circle"></i> Image attached';
  if (card) card.style.display = 'flex';
}

async function handleCourseImageFile(file) {
  if (!file) return;

  const errorEl = document.getElementById('courseImageError');
  const uploadEl = document.getElementById('courseImageUploading');
  if (errorEl) errorEl.style.display = 'none';

  // Validate format
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validExtensions.includes(ext)) {
    if (errorEl) {
      errorEl.textContent = `Unsupported image format (${ext}). Allowed formats: JPG, PNG, WEBP, GIF.`;
      errorEl.style.display = 'block';
    }
    showToast('Invalid image type. Please select a JPG, PNG, WEBP, or GIF file.', 'error');
    return;
  }

  // Validate size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    if (errorEl) {
      errorEl.textContent = `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum 5MB limit.`;
      errorEl.style.display = 'block';
    }
    showToast('Image size exceeds 5MB limit.', 'error');
    return;
  }

  // Immediate preview via FileReader
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    setCourseImagePreview(dataUrl, file.name);
    if (uploadEl) uploadEl.style.display = 'block';

    try {
      const res = await fetch(`${API_BASE}/admin/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          filename: file.name,
          fileData: dataUrl
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      document.getElementById('courseImage').value = data.imageUrl;
      const statusEl = document.getElementById('courseImagePreviewStatus');
      if (statusEl) statusEl.innerHTML = '<i class="fa fa-check-circle"></i> Uploaded & ready';
      showToast('Course image uploaded successfully!', 'success');
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Failed to upload image to server.';
        errorEl.style.display = 'block';
      }
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      if (uploadEl) uploadEl.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}

function openAddCourseModal() {
  document.getElementById('courseModalTitle').innerHTML = '<i class="fa fa-plus-circle"></i> Add New Course';
  document.getElementById('courseForm').reset();
  document.getElementById('courseEditId').value = '';
  document.getElementById('courseIsActive').checked = true;

  // Reset image uploader
  document.getElementById('courseImage').value = 'assets/images/courses/1. mechanical draftman.jpg';
  const fileInput = document.getElementById('courseImageFileInput');
  if (fileInput) fileInput.value = '';
  const errorEl = document.getElementById('courseImageError');
  if (errorEl) errorEl.style.display = 'none';
  const uploadEl = document.getElementById('courseImageUploading');
  if (uploadEl) uploadEl.style.display = 'none';
  setCourseImagePreview('assets/images/courses/1. mechanical draftman.jpg', 'Default Course Image');

  openModal('courseModal');
}

function openEditCourseModal(courseId) {
  const course = cachedCourses.find(c => c.id === courseId);
  if (!course) return;

  document.getElementById('courseModalTitle').innerHTML = '<i class="fa fa-pencil-square-o"></i> Edit Course';
  document.getElementById('courseEditId').value = course.id;
  document.getElementById('courseModalTitleInput').value = course.title;
  document.getElementById('courseCategory').value = course.category || 'Technical Course';
  document.getElementById('courseBranch').value = course.branch || 'General';
  document.getElementById('courseType').value = course.course_type || 'online';
  document.getElementById('courseDurationMonths').value = course.duration_months || 3;
  document.getElementById('coursePrice').value = course.price || 4999;
  document.getElementById('courseImage').value = course.image || 'assets/images/courses/1. mechanical draftman.jpg';
  document.getElementById('courseDescription').value = course.description || '';
  document.getElementById('courseSyllabus').value = course.syllabus || '';
  document.getElementById('courseCurriculum').value = course.curriculum || '';
  document.getElementById('courseIsActive').checked = !!course.is_active;

  // Setup preview
  const fileInput = document.getElementById('courseImageFileInput');
  if (fileInput) fileInput.value = '';
  const errorEl = document.getElementById('courseImageError');
  if (errorEl) errorEl.style.display = 'none';
  const uploadEl = document.getElementById('courseImageUploading');
  if (uploadEl) uploadEl.style.display = 'none';
  setCourseImagePreview(course.image, course.title);

  openModal('courseModal');
}

document.getElementById('courseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('courseEditId').value;
  const isEdit = !!id;

  const payload = {
    title: document.getElementById('courseModalTitleInput').value.trim(),
    category: document.getElementById('courseCategory').value.trim(),
    branch: document.getElementById('courseBranch').value,
    course_type: document.getElementById('courseType').value,
    duration_months: parseInt(document.getElementById('courseDurationMonths').value, 10),
    price: parseFloat(document.getElementById('coursePrice').value),
    image: document.getElementById('courseImage').value.trim(),
    description: document.getElementById('courseDescription').value.trim(),
    syllabus: document.getElementById('courseSyllabus').value.trim(),
    curriculum: document.getElementById('courseCurriculum').value.trim(),
    is_active: document.getElementById('courseIsActive').checked ? 1 : 0
  };

  try {
    const url = isEdit ? `${API_BASE}/admin/courses/${id}` : `${API_BASE}/admin/courses`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    closeModal('courseModal');
    showToast(isEdit ? 'Course updated successfully!' : 'New course added successfully!', 'success');
    loadCourses();
  } catch (err) {
    showToast(err.message || 'Error saving course', 'error');
  }
});

async function toggleCourseActive(courseId, currentStatus) {
  try {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast(`Course ${currentStatus ? 'archived' : 'activated'}`, 'info');
    loadCourses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCourse(courseId) {
  if (!confirm('Are you sure you want to delete/archive this course?')) return;

  try {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast(data.message, 'info');
    loadCourses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --------------------------------------------------------
// STUDENT REGISTRATION MANAGEMENT
// --------------------------------------------------------
async function loadRegistrations() {
  try {
    const res = await fetch(`${API_BASE}/admin/registrations`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    cachedRegistrations = data.registrations || [];
    populateCourseFilterDropdown();
    filterAndRenderRegistrations();
  } catch (err) {
    console.error('Failed to load registrations:', err);
    showToast('Failed to load registrations', 'error');
  }
}

function populateCourseFilterDropdown() {
  const select = document.getElementById('regCourseFilter');
  const selected = select.value;
  const uniqueCourses = [...new Map(cachedRegistrations.map(r => [r.course_id, r.course_title])).entries()];

  select.innerHTML = '<option value="">All Courses</option>' +
    uniqueCourses.map(([id, title]) => `<option value="${id}">${escapeHtml(title)}</option>`).join('');
  select.value = selected;
}

function filterAndRenderRegistrations() {
  const search = document.getElementById('regSearchInput').value.toLowerCase();
  const courseId = document.getElementById('regCourseFilter').value;
  const compStatus = document.getElementById('regCompletionFilter').value;
  const payStatus = document.getElementById('regPaymentFilter').value;
  const source = document.getElementById('regSourceFilter').value;

  const filtered = cachedRegistrations.filter(r => {
    const matchesSearch = !search ||
      r.student_name.toLowerCase().includes(search) ||
      r.email.toLowerCase().includes(search) ||
      r.phone.toLowerCase().includes(search) ||
      r.reg_code.toLowerCase().includes(search);

    const matchesCourse = !courseId || String(r.course_id) === courseId;
    const matchesComp = !compStatus || r.completion_status === compStatus;
    const matchesPay = !payStatus || r.payment_status === payStatus;
    const matchesSource = !source || r.registration_source === source;

    return matchesSearch && matchesCourse && matchesComp && matchesPay && matchesSource;
  });

  const tbody = document.getElementById('registrationsTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 30px;">No registrations match the selected criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td><strong><code>${r.reg_code}</code></strong></td>
      <td>
        <div style="font-weight: 600; color: #fff;">${escapeHtml(r.student_name)}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(r.email)}</div>
        <div style="font-size: 0.74rem; color: #94a3b8;"><i class="fa fa-phone"></i> ${escapeHtml(r.phone)}</div>
      </td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(r.course_title)}</div>
        <div style="font-size: 0.74rem; color: var(--primary);">₹${Number(r.course_price).toLocaleString()}</div>
      </td>
      <td>
        <span class="badge ${r.registration_source === 'offline' ? 'badge-primary' : 'badge-info'}">
          ${r.registration_source}
        </span>
      </td>
      <td>
        <div style="font-size: 0.8rem;">Start: <strong>${r.start_date}</strong></div>
        <div style="font-size: 0.78rem; color: #94a3b8;">Eligible: ${r.eligibility_date} (${r.duration_months} mo)</div>
        ${r.completion_date ? `<div style="font-size: 0.76rem; color: var(--success);">Completed: ${r.completion_date}</div>` : ''}
      </td>
      <td>
        <span class="badge ${r.payment_status === 'paid' ? 'badge-success' : (r.payment_status === 'failed' ? 'badge-danger' : 'badge-warning')}">
          ${r.payment_status}
        </span>
      </td>
      <td>
        <span class="badge status-toggle ${r.completion_status === 'completed' ? 'badge-success' : 'badge-warning'}" 
              onclick="toggleCompletion(${r.id}, '${r.completion_status}')"
              title="Click to toggle completion status">
          <i class="fa ${r.completion_status === 'completed' ? 'fa-check' : 'fa-clock-o'}"></i>
          ${r.completion_status === 'completed' ? 'Completed' : 'Not Completed'}
        </span>
      </td>
      <td>
        ${r.certificate_number ? `
          <a href="/api/certificates/${r.certificate_number}/download" target="_blank" class="badge badge-success" style="text-decoration: none;">
            <i class="fa fa-download"></i> ${r.certificate_number}
          </a>
        ` : (r.completion_status === 'completed' ? `
          <span class="badge badge-info">Eligible</span>
        ` : `
          <span class="badge badge-warning">In Progress</span>
        `)}
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewRegistrationDetails(${r.id})">
          <i class="fa fa-eye"></i> Details
        </button>
      </td>
    </tr>
  `).join('');
}

async function toggleCompletion(regId, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'not_completed' : 'completed';
  try {
    const res = await fetch(`${API_BASE}/admin/registrations/${regId}/completion`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ completion_status: newStatus })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`Status updated: ${newStatus === 'completed' ? 'Completed (Eligible for Certificate)' : 'Not Completed'}`, 'success');
    
    // Refresh both tables
    loadRegistrations();
    loadDashboard();
  } catch (err) {
    showToast(err.message || 'Error updating status', 'error');
  }
}

async function viewRegistrationDetails(regId) {
  openModal('regDetailModal');
  const body = document.getElementById('regDetailBody');
  body.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 30px;">Loading details...</p>';

  try {
    const res = await fetch(`${API_BASE}/admin/registrations/${regId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const r = data.registration;
    const payments = data.payments || [];
    const cert = data.certificate;

    body.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid var(--card-border); padding-bottom: 15px;">
        <div>
          <h2 style="font-size: 1.3rem; color: #fff;">${escapeHtml(r.student_name)}</h2>
          <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa fa-envelope"></i> ${escapeHtml(r.email)} &bull; <i class="fa fa-phone"></i> ${escapeHtml(r.phone)}</span>
        </div>
        <div>
          <span class="badge ${r.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}" style="font-size: 0.85rem;">
            Payment: ${r.payment_status}
          </span>
        </div>
      </div>

      <div class="form-row" style="margin-bottom: 20px;">
        <div style="flex: 1; background: rgba(255,255,255,0.02); padding: 14px; border-radius: var(--radius); border: 1px solid var(--card-border);">
          <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">Registration Code</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary); margin-top: 4px;"><code>${r.reg_code}</code></div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">Source: <strong>${r.registration_source}</strong></div>
        </div>

        <div style="flex: 1; background: rgba(255,255,255,0.02); padding: 14px; border-radius: var(--radius); border: 1px solid var(--card-border);">
          <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">Enrolled Course</div>
          <div style="font-size: 1.05rem; font-weight: 600; color: #fff; margin-top: 4px;">${escapeHtml(r.course_title)}</div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">Fee: ₹${Number(r.course_price).toLocaleString()}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="padding: 12px 18px;">
          <h4 style="font-size: 0.95rem; color: #fff;"><i class="fa fa-calendar"></i> Duration &amp; Completion Timeline</h4>
          <button class="btn btn-primary btn-sm" onclick="toggleCompletion(${r.id}, '${r.completion_status}')">
            Toggle Completion
          </button>
        </div>
        <div class="card-body" style="padding: 16px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.86rem;">
            <div><strong>Registered Date:</strong> ${r.registration_date}</div>
            <div><strong>Start Date:</strong> ${r.start_date}</div>
            <div><strong>Duration:</strong> ${r.duration_months} Months</div>
            <div><strong>Eligibility Date:</strong> <span style="color: var(--primary); font-weight: 600;">${r.eligibility_date}</span></div>
            <div><strong>Completion Status:</strong> <span class="badge ${r.completion_status === 'completed' ? 'badge-success' : 'badge-warning'}">${r.completion_status}</span></div>
            <div><strong>Completion Date:</strong> ${r.completion_date || 'Pending'}</div>
          </div>
          ${r.notes ? `<div style="margin-top: 12px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 0.82rem; color: #cbd5e1;"><strong>Notes:</strong> ${escapeHtml(r.notes)}</div>` : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="padding: 12px 18px;">
          <h4 style="font-size: 0.95rem; color: #fff;"><i class="fa fa-credit-card"></i> Payment Transactions</h4>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Txn Ref</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length > 0 ? payments.map(p => `
                <tr>
                  <td><code>${p.transaction_ref}</code></td>
                  <td><strong>₹${Number(p.amount).toLocaleString()}</strong></td>
                  <td>${p.payment_method}</td>
                  <td><span class="badge ${p.payment_status === 'successful' ? 'badge-success' : 'badge-danger'}">${p.payment_status}</span></td>
                  <td style="font-size: 0.8rem; color: #94a3b8;">${new Date(p.created_at).toLocaleString()}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 15px;">No transactions found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="padding: 12px 18px;">
          <h4 style="font-size: 0.95rem; color: #fff;"><i class="fa fa-certificate"></i> Certificate Status</h4>
        </div>
        <div class="card-body" style="padding: 16px;">
          ${cert ? `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="font-weight: 700; color: var(--success); font-size: 1.05rem;"><i class="fa fa-check-circle"></i> Certificate Issued</div>
                <div style="font-size: 0.85rem; color: #fff; margin-top: 4px;">Certificate ID: <strong><code>${cert.certificate_number}</code></strong></div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Issue Date: ${cert.issue_date} &bull; Status: <span class="badge ${cert.status === 'valid' ? 'badge-success' : 'badge-danger'}">${cert.status}</span></div>
              </div>
              <div>
                <a href="/api/certificates/${cert.certificate_number}/download" target="_blank" class="btn btn-primary btn-sm">
                  <i class="fa fa-download"></i> Download PDF
                </a>
                <a href="../verify.html?cert=${cert.certificate_number}" target="_blank" class="btn btn-secondary btn-sm">
                  <i class="fa fa-external-link"></i> Public Verify
                </a>
              </div>
            </div>
          ` : `
            <div style="color: var(--text-muted); font-size: 0.88rem;">
              ${r.completion_status === 'completed' ? `
                <i class="fa fa-info-circle" style="color: var(--info);"></i> Student is eligible! The certificate will be generated when the student accesses the certificate portal or downloads it.
              ` : `
                <i class="fa fa-clock-o" style="color: var(--warning);"></i> Course in progress. Certificate will become eligible on <strong>${r.eligibility_date}</strong>.
              `}
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<p style="color: var(--danger); text-align: center;">Error loading details: ${err.message}</p>`;
  }
}

// --------------------------------------------------------
// MANUAL OFFLINE REGISTRATION
// --------------------------------------------------------
function setupOfflineForm() {
  const dateInput = document.getElementById('offStartDate');
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  populateCourseDropdowns();
}

function populateCourseDropdowns() {
  const select = document.getElementById('offCourseSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select Course --</option>' +
    cachedCourses.filter(c => c.is_active).map(c => `
      <option value="${c.id}" data-price="${c.price}" data-duration="${c.duration_months}">
        ${escapeHtml(c.title)} (${c.branch} - ₹${c.price})
      </option>
    `).join('');

  select.value = currentVal;
}

function onOfflineCourseChanged() {
  const select = document.getElementById('offCourseSelect');
  const selectedOpt = select.options[select.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) return;

  const price = selectedOpt.dataset.price;
  const duration = selectedOpt.dataset.duration;

  if (price) document.getElementById('offAmount').value = price;
  if (duration) document.getElementById('offDuration').value = duration;
}

document.getElementById('offlineRegForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveOfflineBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';

  const payload = {
    student_name: document.getElementById('offStudentName').value.trim(),
    email: document.getElementById('offEmail').value.trim(),
    phone: document.getElementById('offPhone').value.trim(),
    whatsapp: document.getElementById('offWhatsApp').value.trim(),
    course_id: parseInt(document.getElementById('offCourseSelect').value, 10),
    start_date: document.getElementById('offStartDate').value,
    duration_months: parseInt(document.getElementById('offDuration').value, 10),
    amount: parseFloat(document.getElementById('offAmount').value),
    payment_method: document.getElementById('offPaymentMethod').value,
    notes: document.getElementById('offNotes').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/admin/registrations/offline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`Offline registration confirmed! Ref: ${data.registration.reg_code}`, 'success');
    document.getElementById('offlineRegForm').reset();
    document.getElementById('offStartDate').value = new Date().toISOString().split('T')[0];

    // Refresh data
    loadDashboard();
    switchSection('registrations');
  } catch (err) {
    showToast(err.message || 'Failed to record offline registration', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-check"></i> Confirm &amp; Save Registration';
  }
});

// --------------------------------------------------------
// MODAL: OFFLINE STUDENT REGISTRATION (ISSUE 10)
// --------------------------------------------------------
function openOfflineModal() {
  const form = document.getElementById('offlineRegModalForm');
  if (form) form.reset();

  const dateInput = document.getElementById('modalOffStartDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  populateModalOfflineCourseDropdown();
  openModal('offlineRegModal');
}

function closeOfflineModal() {
  const form = document.getElementById('offlineRegModalForm');
  if (form) form.reset();
  closeModal('offlineRegModal');
}

function populateModalOfflineCourseDropdown() {
  const select = document.getElementById('modalOffCourseSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select Course --</option>' +
    cachedCourses.filter(c => c.is_active).map(c => `
      <option value="${c.id}" data-price="${c.price}" data-duration="${c.duration_months}">
        ${escapeHtml(c.title)} (${c.branch} - ₹${c.price})
      </option>
    `).join('');
  select.value = currentVal;
}

function onModalOfflineCourseChanged() {
  const select = document.getElementById('modalOffCourseSelect');
  const selectedOpt = select.options[select.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) return;

  const price = selectedOpt.dataset.price;
  const duration = selectedOpt.dataset.duration;

  if (price) document.getElementById('modalOffAmount').value = price;
  if (duration) document.getElementById('modalOffDuration').value = duration;
}

const offlineModalFormEl = document.getElementById('offlineRegModalForm');
if (offlineModalFormEl) {
  offlineModalFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveOfflineModalBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Registering...';

    const payload = {
      student_name: document.getElementById('modalOffStudentName').value.trim(),
      email: document.getElementById('modalOffEmail').value.trim(),
      phone: document.getElementById('modalOffPhone').value.trim(),
      whatsapp: document.getElementById('modalOffWhatsApp').value.trim(),
      course_id: parseInt(document.getElementById('modalOffCourseSelect').value, 10),
      start_date: document.getElementById('modalOffStartDate').value,
      duration_months: parseInt(document.getElementById('modalOffDuration').value, 10),
      amount: parseFloat(document.getElementById('modalOffAmount').value),
      payment_method: document.getElementById('modalOffPaymentMethod').value,
      notes: document.getElementById('modalOffNotes').value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/admin/registrations/offline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Student registered successfully! Ref: ${data.registration.reg_code}`, 'success');
      closeOfflineModal();

      // Refresh data
      loadDashboard();
      loadRegistrations();
    } catch (err) {
      showToast(err.message || 'Failed to record offline registration', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-check"></i> Register Student';
    }
  });
}

// --------------------------------------------------------
// CERTIFICATES REGISTRY
// --------------------------------------------------------
async function loadCertificates() {
  try {
    const res = await fetch(`${API_BASE}/admin/certificates`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    cachedCertificates = data.certificates || [];
    filterAndRenderCertificates();
  } catch (err) {
    console.error('Failed to load certificates:', err);
    showToast('Failed to load certificates', 'error');
  }
}

function filterAndRenderCertificates() {
  const search = document.getElementById('certSearchInput').value.toLowerCase();
  const status = document.getElementById('certStatusFilter').value;

  const filtered = cachedCertificates.filter(c => {
    const matchesSearch = !search ||
      c.certificate_number.toLowerCase().includes(search) ||
      c.student_name.toLowerCase().includes(search) ||
      (c.reg_code && c.reg_code.toLowerCase().includes(search)) ||
      c.course_title.toLowerCase().includes(search);

    const matchesStatus = !status || c.status === status;
    return matchesSearch && matchesStatus;
  });

  const tbody = document.getElementById('certificatesTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No certificates match the filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td><strong><code>${c.certificate_number}</code></strong></td>
      <td>
        <div style="font-weight: 600; color: #fff;">${escapeHtml(c.student_name)}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">Reg: <code>${c.reg_code}</code></div>
      </td>
      <td>${escapeHtml(c.course_title)}</td>
      <td>${c.start_date}</td>
      <td>${c.completion_date}</td>
      <td>${c.issue_date}</td>
      <td>
        <span class="badge ${c.status === 'valid' ? 'badge-success' : 'badge-danger'}">
          ${c.status === 'valid' ? 'Authentic / Valid' : 'Revoked'}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <a href="/api/certificates/${c.certificate_number}/download" target="_blank" class="btn btn-primary btn-sm" title="Download PDF">
            <i class="fa fa-download"></i> PDF
          </a>
          <a href="../verify.html?cert=${c.certificate_number}" target="_blank" class="btn btn-secondary btn-sm" title="Public Verification Page">
            <i class="fa fa-check"></i>
          </a>
          <button class="btn btn-secondary btn-sm" style="color: ${c.status === 'valid' ? 'var(--danger)' : 'var(--success)'};" 
                  onclick="toggleCertStatus(${c.id}, '${c.status}')" title="${c.status === 'valid' ? 'Revoke Certificate' : 'Reactivate Certificate'}">
            <i class="fa ${c.status === 'valid' ? 'fa-ban' : 'fa-refresh'}"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function toggleCertStatus(certId, currentStatus) {
  const newStatus = currentStatus === 'valid' ? 'revoked' : 'valid';
  let reason = '';
  if (newStatus === 'revoked') {
    reason = prompt('Please enter the reason for certificate revocation (e.g. Incomplete assessment or administrative review):');
    if (reason === null) return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/certificates/${certId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: newStatus, revocation_reason: reason })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`Certificate is now ${newStatus}`, 'info');
    loadCertificates();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --------------------------------------------------------
// NOTIFICATIONS & WHATSAPP LOG
// --------------------------------------------------------
async function loadNotifications() {
  try {
    const res = await fetch(`${API_BASE}/admin/notifications`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    cachedNotifications = data.notifications || [];
    renderAllNotifications(cachedNotifications);
  } catch (err) {
    console.error('Failed to load notifications:', err);
    showToast('Failed to load notifications', 'error');
  }
}

function renderAllNotifications(notes) {
  const container = document.getElementById('allNotificationsList');
  if (notes.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 30px;">No notifications recorded yet.</p>`;
    return;
  }

  container.innerHTML = notes.map(n => `
    <div style="background: #111827; border: 1px solid var(--card-border); border-radius: var(--radius); padding: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
      <div style="flex: 1; min-width: 280px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <span class="badge ${n.type === 'offline_registration' ? 'badge-primary' : 'badge-success'}">${n.type === 'offline_registration' ? 'Offline' : 'Online Demo'}</span>
          <strong style="color: #fff; font-size: 0.98rem;">${escapeHtml(n.title)}</strong>
        </div>
        <p style="font-size: 0.88rem; color: #d1d5db; margin-bottom: 6px;">${escapeHtml(n.message)}</p>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Student: <strong>${escapeHtml(n.student_name)}</strong> &bull; Amount: <span style="color: var(--success); font-weight: 600;">₹${Number(n.amount).toLocaleString()}</span> &bull; Txn: <code>${n.transaction_ref || 'N/A'}</code> &bull; ${new Date(n.created_at).toLocaleString()}
        </div>
      </div>
      <div>
        ${n.whatsapp_url ? `
          <a href="${n.whatsapp_url}" target="_blank" class="btn btn-success">
            <i class="fa fa-whatsapp"></i> Open WhatsApp Web / App
          </a>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// --------------------------------------------------------
// MODALS, TOASTS & UTILS
// --------------------------------------------------------
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// Global modal dismiss on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      closeModal(modal.id);
    });
  }
});

// Global modal dismiss on Backdrop click
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

// Drag and drop initializer
function initCourseImageUploader() {
  const dropzone = document.getElementById('courseImageDropzone');
  const fileInput = document.getElementById('courseImageFileInput');
  if (!dropzone || !fileInput) return;

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleCourseImageFile(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'dragend'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleCourseImageFile(e.dataTransfer.files[0]);
    }
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle')}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAuth();
  if (!ok) return;

  // Initialize course image uploader
  initCourseImageUploader();

  // Sidebar navigation click
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    if (link.dataset.section) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        switchSection(link.dataset.section);
      });
    }
  });

  // Mobile toggle
  const mobileToggle = document.getElementById('mobileMenuToggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      document.getElementById('adminSidebar').classList.toggle('open');
    });
  }

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    const activeLink = document.querySelector('.sidebar-nav .nav-link.active');
    const sec = activeLink ? activeLink.dataset.section : 'dashboard';
    switchSection(sec);
    showToast('Data refreshed', 'info');
  });

  // Logout button (properly clear sessions and redirect)
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.replace('login.html');
  });

  // Course filters
  document.getElementById('courseSearchInput').addEventListener('input', filterAndRenderCourses);
  document.getElementById('courseBranchFilter').addEventListener('change', filterAndRenderCourses);
  document.getElementById('courseTypeFilter').addEventListener('change', filterAndRenderCourses);

  // Registration filters
  document.getElementById('regSearchInput').addEventListener('input', filterAndRenderRegistrations);
  document.getElementById('regCourseFilter').addEventListener('change', filterAndRenderRegistrations);
  document.getElementById('regCompletionFilter').addEventListener('change', filterAndRenderRegistrations);
  document.getElementById('regPaymentFilter').addEventListener('change', filterAndRenderRegistrations);
  document.getElementById('regSourceFilter').addEventListener('change', filterAndRenderRegistrations);

  // Certificate filters
  document.getElementById('certSearchInput').addEventListener('input', filterAndRenderCertificates);
  document.getElementById('certStatusFilter').addEventListener('change', filterAndRenderCertificates);

  // Initial load
  loadDashboard();
  loadCourses();
});
